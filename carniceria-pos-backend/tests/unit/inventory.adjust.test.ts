/**
 * tests/unit/inventory.adjust.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 2. Cubre `update` (modules/inventory/service.ts) — prioridad
 * "Ajustes de inventario". Casos criticos cubiertos:
 *  - Inventario inexistente (validacion).
 *  - Conflicto de unicidad producto+sucursal al reasignar la fila.
 *  - CALCULO CORRECTO DE INVENTARIO: el ajuste se expresa como DIFERENCIA
 *    con signo entre la cantidad nueva y la actual — nunca como valor
 *    absoluto escrito directo en `Inventory.quantity`.
 *  - Si `quantity` no cambia (o no viene en el body), NO se emite ningun
 *    `InventoryMovement` — un PATCH que solo toca `reorderPoint` no debe
 *    generar un movimiento fantasma de cantidad 0.
 *  - Reutiliza `recordMovement` (tipo `ADJUSTMENT`), nunca escribe
 *    `Inventory.quantity` por su cuenta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryMovementType } from '@prisma/client';
import { ConflictError, NotFoundError } from '@/shared/errors';
import { InventoryReferenceType } from '@/shared/constants';

vi.mock('@/database', () => ({
  prisma: { $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({})) },
}));

vi.mock('@/modules/inventory/repository', () => ({
  findById: vi.fn(),
  findByProductAndSucursal: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/shared/services/inventoryMovement.service', () => ({
  recordMovement: vi.fn().mockResolvedValue({ movementId: 'mov-1', balanceAfter: 0 }),
}));

import * as inventoryRepository from '@/modules/inventory/repository';
import { recordMovement } from '@/shared/services/inventoryMovement.service';
import { update } from '@/modules/inventory/service';

function buildInventory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    sucursalId: 'sucursal-1',
    productId: 'product-1',
    quantity: 10,
    reorderPoint: 5,
    sucursal: { id: 'sucursal-1', code: 'S1', name: 'Sucursal 1' },
    product: { id: 'product-1', name: 'Producto 1', sku: null, unitOfMeasure: 'UNIT' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('inventory update (ajuste manual)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(inventoryRepository.update).mockImplementation(
      (id, data) => Promise.resolve({ ...buildInventory(), ...data }) as never,
    );
  });

  it('lanza NotFoundError si la existencia no existe', async () => {
    vi.mocked(inventoryRepository.findById).mockResolvedValue(null);

    await expect(update('inv-inexistente', { quantity: 5 }, 'user-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(recordMovement).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si ya existe una fila para el nuevo producto+sucursal', async () => {
    vi.mocked(inventoryRepository.findById).mockResolvedValue(buildInventory() as never);
    vi.mocked(inventoryRepository.findByProductAndSucursal).mockResolvedValue(
      buildInventory({ id: 'otra-fila' }) as never,
    );

    await expect(
      update('inv-1', { productId: 'otro-producto' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('CALCULO DE INVENTARIO: registra la DIFERENCIA (positiva) entre cantidad nueva y actual, no el valor absoluto', async () => {
    vi.mocked(inventoryRepository.findById).mockResolvedValue(
      buildInventory({ quantity: 10 }) as never,
    );

    await update('inv-1', { quantity: 15 }, 'user-1');

    expect(recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: InventoryMovementType.ADJUSTMENT,
        quantity: 5, // 15 - 10, NUNCA "15"
        referenceType: InventoryReferenceType.INVENTORY_ADJUSTMENT,
      }),
    );
  });

  it('CALCULO DE INVENTARIO: registra la diferencia NEGATIVA cuando la cantidad nueva es menor', async () => {
    vi.mocked(inventoryRepository.findById).mockResolvedValue(
      buildInventory({ quantity: 10 }) as never,
    );

    await update('inv-1', { quantity: 4 }, 'user-1');

    expect(recordMovement).toHaveBeenCalledWith(expect.objectContaining({ quantity: -6 }));
  });

  it('CASO LIMITE: si la cantidad no cambia, NO emite ningun InventoryMovement', async () => {
    vi.mocked(inventoryRepository.findById).mockResolvedValue(
      buildInventory({ quantity: 10 }) as never,
    );

    await update('inv-1', { quantity: 10, reorderPoint: 8 }, 'user-1');

    expect(recordMovement).not.toHaveBeenCalled();
    // El resto de los campos (reorderPoint) igual se actualiza.
    expect(inventoryRepository.update).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({ reorderPoint: 8 }),
      expect.anything(),
    );
  });

  it('CASO LIMITE: si `quantity` no viene en el body, NO emite ningun movimiento (solo ajusta otros campos)', async () => {
    vi.mocked(inventoryRepository.findById).mockResolvedValue(
      buildInventory({ quantity: 10 }) as never,
    );

    await update('inv-1', { reorderPoint: 20 }, 'user-1');

    expect(recordMovement).not.toHaveBeenCalled();
  });
});
