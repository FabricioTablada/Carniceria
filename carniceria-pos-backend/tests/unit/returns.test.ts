/**
 * tests/unit/returns.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 2. Cubre `createReturn` (modules/returns/service.ts) — prioridad
 * "Devoluciones". Casos criticos cubiertos:
 *  - Validaciones previas: venta inexistente, anulada, ya reemplazada por
 *    correccion, sesion de caja inexistente, linea que no pertenece a la
 *    venta.
 *  - CASO LIMITE (devolucion parcial): la cantidad solicitada NUNCA puede
 *    superar el REMANENTE (original menos lo ya devuelto), releido DENTRO
 *    de la transaccion — no antes.
 *  - CONDICION DE CARRERA (regresion del fix de Sprint QA 1): si la venta
 *    fue anulada por otra operacion mientras esta transaccion esperaba, se
 *    aborta al releer el estado DENTRO de la transaccion.
 *  - Arquitectura de dos orígenes (`restock`): con `restock: false` NO se
 *    emite movimiento de inventario (merma, sin tabla propia todavia).
 *  - Caja: `CashMovement` tipo `REFUND` SOLO cuando el reembolso es en
 *    efectivo — tarjeta/SINPE/transferencia no generan movimiento de caja.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CashMovementType, InventoryMovementType } from '@prisma/client';
import { AuditAction, InventoryReferenceType } from '@/shared/constants';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';

vi.mock('@/database', () => ({
  prisma: { $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({})) },
}));

vi.mock('@/modules/returns/repository', () => ({
  findSaleForValidation: vi.fn(),
  findCashSessionById: vi.fn(),
  sumReturnedQuantityByItemIds: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  createCashMovement: vi.fn().mockResolvedValue({}),
  // Bloque 4.4: usado por `findById`/`findMany`/`createReturn` (via
  // `getRestockedProductIdsSet`) para reconstruir `restock` al leer —
  // devuelve "sin movimientos de reingreso" por defecto en estas pruebas.
  findRestockedProductIdsByReturnIds: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/shared/services/inventoryMovement.service', () => ({
  recordMovements: vi.fn().mockResolvedValue([{ movementId: 'mov-1', balanceAfter: 0 }]),
}));

vi.mock('@/shared/services/audit.service', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import * as returnsRepository from '@/modules/returns/repository';
import { recordMovements } from '@/shared/services/inventoryMovement.service';
import { auditService } from '@/shared/services/audit.service';
import { createReturn } from '@/modules/returns/service';

function buildSale(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sale-1',
    sucursalId: 'sucursal-1',
    status: 'COMPLETED',
    correctedBySale: null,
    items: [
      { id: 'item-1', productId: 'product-1', quantity: 5, unitPrice: 100, lineTotal: 500 },
    ],
    ...overrides,
  };
}

const baseDto = {
  saleId: 'sale-1',
  cashSessionId: 'session-1',
  performedByUserId: 'user-1',
  reason: 'Cliente no quedó satisfecho',
  refundMethod: 'CASH' as const,
  items: [{ saleItemId: 'item-1', quantity: 2 }],
};

describe('createReturn — validaciones previas a la transaccion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(returnsRepository.create).mockResolvedValue({
      id: 'return-1',
      saleId: 'sale-1',
      sucursalId: 'sucursal-1',
      cashSessionId: 'session-1',
      userId: 'user-1',
      reason: baseDto.reason,
      refundMethod: 'CASH',
      totalAmount: 200,
      sucursal: { id: 'sucursal-1', name: 'Sucursal 1' },
      user: { id: 'user-1', fullName: 'Cajero Uno' },
      items: [
        { id: 'ri-1', saleItemId: 'item-1', quantity: 2, unitPrice: 100, lineTotal: 200 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
  });

  it('lanza NotFoundError si la venta no existe', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(null);

    await expect(createReturn(baseDto)).rejects.toBeInstanceOf(NotFoundError);
    expect(recordMovements).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si la venta esta anulada', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(
      buildSale({ status: 'CANCELLED' }) as never,
    );

    await expect(createReturn(baseDto)).rejects.toBeInstanceOf(ConflictError);
  });

  it('lanza ConflictError si la venta ya fue reemplazada por una correccion', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(
      buildSale({ correctedBySale: { id: 'sale-2' } }) as never,
    );

    await expect(createReturn(baseDto)).rejects.toBeInstanceOf(ConflictError);
  });

  it('lanza NotFoundError si la sesion de caja no existe', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.findCashSessionById).mockResolvedValue(null);

    await expect(createReturn(baseDto)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lanza ValidationError si una linea no pertenece a la venta', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.findCashSessionById).mockResolvedValue({ id: 'session-1' } as never);

    await expect(
      createReturn({ ...baseDto, items: [{ saleItemId: 'item-ajena', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('createReturn — dentro de la transaccion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(returnsRepository.findCashSessionById).mockResolvedValue({ id: 'session-1' } as never);
    vi.mocked(returnsRepository.create).mockImplementation(
      (data) =>
        Promise.resolve({
          id: 'return-1',
          ...data,
          sucursal: { id: 'sucursal-1', name: 'Sucursal 1' },
          user: { id: 'user-1', fullName: 'Cajero Uno' },
          // `saleItem: { productId }` (Bloque 4.4): el repositorio real
          // incluye este dato anidado para poder reconstruir `restock` al
          // leer — se mockea aca con el mismo `productId` de `item-1` en
          // `buildSale()`, unico `saleItemId` usado en estas pruebas.
          items: (data as { items: { create: { saleItemId: string }[] } }).items.create.map(
            (item, index) => ({
              id: `ri-${index}`,
              ...item,
              saleItem: { productId: 'product-1' },
            }),
          ),
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as never,
    );
  });

  it('CASO LIMITE: rechaza una devolucion que supera la cantidad remanente (parcial ya devuelta antes)', async () => {
    // La venta original tiene 5 unidades; 4 ya se devolvieron en una
    // devolucion previa — solo queda 1 disponible.
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([
      { saleItemId: 'item-1', _sum: { quantity: 4 } },
    ] as never);

    await expect(
      createReturn({ ...baseDto, items: [{ saleItemId: 'item-1', quantity: 2 }] }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(recordMovements).not.toHaveBeenCalled();
  });

  it('acepta una devolucion parcial que respeta el remanente exacto', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([
      { saleItemId: 'item-1', _sum: { quantity: 4 } },
    ] as never);

    const result = await createReturn({
      ...baseDto,
      items: [{ saleItemId: 'item-1', quantity: 1 }],
    });

    expect(result.id).toBe('return-1');
    // Bloque B: una sola llamada batched con el array de lineas restock=true
    // (aqui, una sola linea), en vez de una llamada por linea.
    expect(recordMovements).toHaveBeenCalledTimes(1);
    expect(recordMovements).toHaveBeenCalledWith([expect.objectContaining({ productId: 'product-1' })]);
  });

  it('CONDICION DE CARRERA (regresion QA1): aborta si la venta fue anulada por otra operacion durante la espera', async () => {
    // Lectura previa a la transaccion: venta todavia activa.
    vi.mocked(returnsRepository.findSaleForValidation)
      .mockResolvedValueOnce(buildSale() as never)
      // Relectura DENTRO de la transaccion: alguien la anulo mientras tanto.
      .mockResolvedValueOnce(buildSale({ status: 'CANCELLED' }) as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([]);

    await expect(createReturn(baseDto)).rejects.toBeInstanceOf(ConflictError);
    expect(recordMovements).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('restock=false NO emite movimiento de inventario (merma, sin reingreso)', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([]);

    await createReturn({
      ...baseDto,
      items: [{ saleItemId: 'item-1', quantity: 2, restock: false }],
    });

    expect(recordMovements).not.toHaveBeenCalled();
  });

  it('restock=true (default) SI emite RETURN positivo', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([]);

    await createReturn(baseDto);

    expect(recordMovements).toHaveBeenCalledWith([
      expect.objectContaining({
        productId: 'product-1',
        type: InventoryMovementType.RETURN,
        quantity: 2,
        referenceType: InventoryReferenceType.SALE_RETURN,
      }),
    ]);
  });

  it('REGRESION (Sprint QA 3.3): audita con la accion especifica SALE_RETURN, no el generico legacy SALE', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([]);

    await createReturn(baseDto);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.SALE_RETURN,
        entity: 'SaleReturn',
      }),
    );
  });

  it('reembolso en EFECTIVO genera CashMovement tipo REFUND', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([]);

    await createReturn({ ...baseDto, refundMethod: 'CASH' });

    expect(returnsRepository.createCashMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: CashMovementType.REFUND, cashSessionId: 'session-1' }),
      expect.anything(),
    );
  });

  it('reembolso por TARJETA no mueve efectivo del cajon (sin CashMovement)', async () => {
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([]);

    await createReturn({ ...baseDto, refundMethod: 'CARD' });

    expect(returnsRepository.createCashMovement).not.toHaveBeenCalled();
  });

  it('calcula el monto devuelto prorrateado sobre el lineTotal original (incluye descuento/impuesto)', async () => {
    // lineTotal original 500 por 5 unidades => 100/unidad; se devuelven 2.
    vi.mocked(returnsRepository.findSaleForValidation).mockResolvedValue(buildSale() as never);
    vi.mocked(returnsRepository.sumReturnedQuantityByItemIds).mockResolvedValue([]);

    const result = await createReturn(baseDto);

    expect(result.totalAmount).toBe(200);
  });
});
