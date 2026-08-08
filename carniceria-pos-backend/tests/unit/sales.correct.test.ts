/**
 * tests/unit/sales.correct.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 2. Cubre las validaciones de guarda de `correctSale`
 * (modules/sales/service.ts) — prioridad "Correccion de ventas". Estas
 * validaciones ocurren ANTES de abrir la transaccion, por lo que no
 * requieren mockear `prisma.$transaction`/`createSaleTransaction` para
 * probarlas: son la primera linea de defensa contra corregir una venta que
 * ya no deberia poder corregirse.
 *
 * El camino feliz completo (anular + crear venta correctiva enlazada) no
 * se cubre aqui: requeriria mockear ademas todo el flujo de creacion de
 * venta (`computeItems`, `assertSufficientStock`, generacion de numero de
 * documento) — la reversion completa ante fallas de ESE flujo ya la cubre
 * `sales.void.test.ts` para su parte compartida (`voidSaleTransaction`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictError, NotFoundError } from '@/shared/errors';

vi.mock('@/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('@/modules/sales/repository', () => ({
  findById: vi.fn(),
  tryCancel: vi.fn(),
}));

vi.mock('@/modules/inventory/repository', () => ({
  findByProductAndSucursal: vi.fn(),
}));

vi.mock('@/shared/services/inventoryMovement.service', () => ({
  recordMovements: vi.fn(),
}));

vi.mock('@/shared/services/audit.service', () => ({
  auditService: { log: vi.fn() },
}));

import { prisma } from '@/database';
import * as salesRepository from '@/modules/sales/repository';
import { correctSale } from '@/modules/sales/service';

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
    taxTotal: 0,
    discountType: 'NONE',
    discountValue: 0,
    discountTotal: 0,
    total: 1000,
    amountPaid: 1000,
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
        quantity: 1,
        unitPrice: 1000,
        taxRate: 0,
        discount: 0,
        lineSubtotal: 1000,
        lineTax: 0,
        lineTotal: 1000,
        product: { id: 'product-1', name: 'Producto 1', sku: null, unitOfMeasure: 'UNIT' },
        tax: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const correctDto = {
  reason: 'Precio incorrecto',
  performedByUserId: 'user-1',
  paymentMethod: 'CASH' as const,
  items: [{ productId: 'product-1', quantity: 1, unitPrice: 900 }],
};

describe('correctSale — validaciones de guarda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lanza NotFoundError si la venta no existe', async () => {
    vi.mocked(salesRepository.findById).mockResolvedValue(null);

    await expect(correctSale('sale-inexistente', correctDto)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si la venta ya esta anulada (CANCELLED)', async () => {
    vi.mocked(salesRepository.findById).mockResolvedValue(
      buildSale({ status: 'CANCELLED' }) as never,
    );

    await expect(correctSale('sale-1', correctDto)).rejects.toBeInstanceOf(ConflictError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si la venta ya fue corregida anteriormente (correctedBySale existe)', async () => {
    vi.mocked(salesRepository.findById).mockResolvedValue(
      buildSale({ correctedBySale: { id: 'sale-2', documentNumber: 'VTA-000002', status: 'COMPLETED' } }) as never,
    );

    await expect(correctSale('sale-1', correctDto)).rejects.toBeInstanceOf(ConflictError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
