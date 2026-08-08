/**
 * tests/unit/sales.void.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 2. Cubre `voidSale` (modules/sales/service.ts) — prioridad
 * "Anulacion de ventas". Casos criticos cubiertos:
 *  - Venta inexistente / ya anulada (validacion).
 *  - CONDICION DE CARRERA: dos anulaciones concurrentes de la misma venta
 *    (regression test del fix de Sprint QA 1 — `tryCancel`, compare-and-swap).
 *  - Reversion completa: si pierde la carrera, NO se llama `recordMovement`
 *    ni `auditService.log` (transaccion abortada antes de tocar inventario).
 *  - Camino feliz: reversa inventario con `InventoryMovementType.RETURN`
 *    (cantidad POSITIVA, una vez por cada linea) y registra auditoria.
 *
 * Todas las dependencias externas (`@/database`, el repositorio del propio
 * modulo, el servicio compartido de inventario y el de auditoria) se
 * mockean: esta es una prueba de LOGICA DE NEGOCIO, no de integracion con
 * Postgres — mismo criterio que permite que la suite corra sin una base de
 * datos real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryMovementType } from '@prisma/client';
import { AuditAction, InventoryReferenceType } from '@/shared/constants';
import { ConflictError, NotFoundError } from '@/shared/errors';

vi.mock('@/database', () => ({
  prisma: { $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({})) },
}));

vi.mock('@/modules/sales/repository', () => ({
  findById: vi.fn(),
  tryCancel: vi.fn(),
}));

vi.mock('@/shared/services/inventoryMovement.service', () => ({
  recordMovements: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/shared/services/audit.service', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import * as salesRepository from '@/modules/sales/repository';
import { recordMovements } from '@/shared/services/inventoryMovement.service';
import { auditService } from '@/shared/services/audit.service';
import { voidSale } from '@/modules/sales/service';

function buildSale(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sale-1',
    sucursalId: 'sucursal-1',
    userId: 'user-1',
    cashSessionId: 'session-1',
    documentNumber: 'VTA-000001',
    status: 'COMPLETED',
    paymentMethod: 'CASH',
    paymentReference: null,
    saleDate: new Date(),
    subtotal: 1000,
    taxTotal: 130,
    discountType: 'NONE',
    discountValue: 0,
    discountTotal: 0,
    total: 1130,
    amountPaid: 1130,
    changeGiven: 0,
    notes: null,
    originalSaleId: null,
    originalSale: null,
    correctedBySale: null,
    sucursal: { id: 'sucursal-1', code: 'S1', name: 'Sucursal 1' },
    user: { id: 'user-1', fullName: 'Cajero Uno' },
    cashSession: { id: 'session-1', status: 'OPEN' },
    items: [
      {
        id: 'item-1',
        productId: 'product-1',
        taxId: null,
        quantity: 2,
        unitPrice: 500,
        taxRate: 0,
        discount: 0,
        lineSubtotal: 1000,
        lineTax: 0,
        lineTotal: 1000,
        product: { id: 'product-1', name: 'Producto 1', sku: null, unitOfMeasure: 'UNIT' },
        tax: null,
      },
    ],
    // Bloque P.2 (Motor de Promociones, exposicion de la auditoria):
    // `toSaleResponse()` ahora mapea `appliedPromotions` — el fixture debe
    // incluir el campo (vacio, sin promociones en este escenario) para
    // que el mock siga representando la forma real de `SaleRecord`.
    appliedPromotions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('voidSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lanza NotFoundError si la venta no existe', async () => {
    vi.mocked(salesRepository.findById).mockResolvedValue(null);

    await expect(voidSale('sale-inexistente', { reason: 'motivo', performedByUserId: 'user-1' }))
      .rejects.toBeInstanceOf(NotFoundError);

    expect(recordMovements).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si la venta ya esta CANCELLED', async () => {
    vi.mocked(salesRepository.findById).mockResolvedValue(buildSale({ status: 'CANCELLED' }) as never);

    await expect(voidSale('sale-1', { reason: 'motivo', performedByUserId: 'user-1' }))
      .rejects.toBeInstanceOf(ConflictError);

    expect(recordMovements).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('CONDICION DE CARRERA: si otra anulacion concurrente ya gano (tryCancel.count === 0), aborta sin tocar inventario ni auditoria', async () => {
    // La lectura previa a la transaccion todavia ve la venta como COMPLETED
    // (la otra transaccion concurrente no habia confirmado en ese momento).
    vi.mocked(salesRepository.findById).mockResolvedValue(buildSale() as never);
    // Pero al llegar el UPDATE condicional dentro de la transaccion, la otra
    // transaccion ya gano la carrera: 0 filas afectadas.
    vi.mocked(salesRepository.tryCancel).mockResolvedValue({ count: 0 } as never);

    await expect(voidSale('sale-1', { reason: 'motivo', performedByUserId: 'user-1' }))
      .rejects.toBeInstanceOf(ConflictError);

    // Reversion completa: ni el inventario ni la auditoria se tocaron.
    expect(recordMovements).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('camino feliz: reversa inventario con RETURN positivo por cada linea y audita', async () => {
    const sale = buildSale({
      items: [
        { ...buildSale().items[0], productId: 'product-1', quantity: 2 },
        { ...buildSale().items[0], id: 'item-2', productId: 'product-2', quantity: 5 },
      ],
    });
    vi.mocked(salesRepository.findById)
      .mockResolvedValueOnce(sale as never) // lectura previa a la transaccion
      .mockResolvedValueOnce(sale as never); // relectura dentro de la transaccion (tx)
    vi.mocked(salesRepository.tryCancel).mockResolvedValue({ count: 1 } as never);

    const result = await voidSale('sale-1', {
      reason: 'Producto equivocado',
      performedByUserId: 'user-1',
    });

    expect(result.status).toBe('COMPLETED'); // el mock de findById no cambia el status devuelto, solo se verifica que se uso
    expect(salesRepository.tryCancel).toHaveBeenCalledWith('sale-1', {});

    // Bloque B (optimizacion de round-trips): `voidSaleTransaction` ahora
    // agrupa la reversa de TODAS las lineas en una unica llamada batched a
    // `recordMovements`, en vez de una llamada a `recordMovement` por linea.
    expect(recordMovements).toHaveBeenCalledTimes(1);
    expect(recordMovements).toHaveBeenCalledWith([
      expect.objectContaining({
        productId: 'product-1',
        type: InventoryMovementType.RETURN,
        quantity: 2, // POSITIVO: reversa la salida original de la venta
        referenceType: InventoryReferenceType.SALE_VOID,
        referenceId: 'sale-1',
      }),
      expect.objectContaining({
        productId: 'product-2',
        quantity: 5,
        type: InventoryMovementType.RETURN,
      }),
    ]);

    expect(auditService.log).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        // Sprint QA 3.3 (regresion): ya NO usa el generico legacy
        // `AuditAction.SALE` — usa la accion especifica `SALE_VOID`.
        action: AuditAction.SALE_VOID,
        entity: 'Sale',
        entityId: 'sale-1',
        metadata: expect.objectContaining({ type: 'VOID', reason: 'Producto equivocado' }),
      }),
    );
  });
});
