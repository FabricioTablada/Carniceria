/**
 * tests/unit/inventoryWaste.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 2. Cubre `createWaste` (modules/inventoryWaste/service.ts) —
 * prioridad "Mermas". Casos criticos cubiertos:
 *  - Validaciones previas: producto/sucursal/usuario/linea de devolucion
 *    de origen inexistentes.
 *  - CASO LIMITE (stock insuficiente): la cantidad a mermar NUNCA puede
 *    superar el stock disponible, releido DENTRO de la transaccion.
 *  - Reversion completa: si la cantidad excede el stock, NO se llama
 *    `recordMovement` ni se crea el documento de merma.
 *  - CALCULO CORRECTO DE INVENTARIO: `InventoryWaste` nunca modifica stock
 *    directamente — el UNICO movimiento de inventario lo emite
 *    `recordMovement`, con `InventoryMovementType.WASTE` y cantidad
 *    NEGATIVA.
 *  - Valorizacion: `unitValue`/`totalValue` se calculan desde
 *    `Product.cost` (costo de referencia), NUNCA desde el precio de venta.
 *  - Arquitectura de dos origenes: `sourceReturnItemId` opcional, validado
 *    por existencia (integridad), sin generar logica de integracion
 *    automatica con Devoluciones (fuera de alcance del Bloque 5.3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryMovementType } from '@prisma/client';
import { AuditAction, InventoryReferenceType } from '@/shared/constants';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';

vi.mock('@/database', () => ({
  prisma: { $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({})) },
}));

vi.mock('@/modules/inventoryWaste/repository', () => ({
  findProductById: vi.fn(),
  findSucursalById: vi.fn(),
  findUserById: vi.fn(),
  findSaleReturnItemById: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/modules/inventory/repository', () => ({
  findByProductAndSucursal: vi.fn(),
}));

vi.mock('@/shared/services/inventoryMovement.service', () => ({
  recordMovement: vi.fn().mockResolvedValue({ movementId: 'mov-1', balanceAfter: 0 }),
}));

vi.mock('@/shared/services/audit.service', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

import * as inventoryWasteRepository from '@/modules/inventoryWaste/repository';
import * as inventoryRepository from '@/modules/inventory/repository';
import { recordMovement } from '@/shared/services/inventoryMovement.service';
import { auditService } from '@/shared/services/audit.service';
import { createWaste } from '@/modules/inventoryWaste/service';

const baseDto = {
  sucursalId: 'sucursal-1',
  productId: 'product-1',
  performedByUserId: 'user-1',
  reason: 'DAMAGED' as const,
  notes: 'Se cayó en el piso',
  quantity: 3,
};

function mockWasteCreated() {
  vi.mocked(inventoryWasteRepository.create).mockImplementation(
    (data) =>
      Promise.resolve({
        id: 'waste-1',
        ...data,
        sucursal: { id: 'sucursal-1', name: 'Sucursal 1' },
        product: { id: 'product-1', name: 'Producto 1', sku: null, unitOfMeasure: 'UNIT' },
        user: { id: 'user-1', fullName: 'Usuario Uno' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as never,
  );
}

describe('createWaste — validaciones previas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWasteCreated();
  });

  it('lanza NotFoundError si el producto no existe', async () => {
    vi.mocked(inventoryWasteRepository.findProductById).mockResolvedValue(null);

    await expect(createWaste(baseDto)).rejects.toBeInstanceOf(NotFoundError);
    expect(recordMovement).not.toHaveBeenCalled();
  });

  it('lanza NotFoundError si la sucursal no existe', async () => {
    vi.mocked(inventoryWasteRepository.findProductById).mockResolvedValue({
      id: 'product-1',
      cost: 100,
    } as never);
    vi.mocked(inventoryWasteRepository.findSucursalById).mockResolvedValue(null);

    await expect(createWaste(baseDto)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lanza NotFoundError si el usuario no existe', async () => {
    vi.mocked(inventoryWasteRepository.findProductById).mockResolvedValue({
      id: 'product-1',
      cost: 100,
    } as never);
    vi.mocked(inventoryWasteRepository.findSucursalById).mockResolvedValue({ id: 'sucursal-1' } as never);
    vi.mocked(inventoryWasteRepository.findUserById).mockResolvedValue(null);

    await expect(createWaste(baseDto)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lanza NotFoundError si sourceReturnItemId se indica pero no existe (integridad, no integracion automatica)', async () => {
    vi.mocked(inventoryWasteRepository.findProductById).mockResolvedValue({
      id: 'product-1',
      cost: 100,
    } as never);
    vi.mocked(inventoryWasteRepository.findSucursalById).mockResolvedValue({ id: 'sucursal-1' } as never);
    vi.mocked(inventoryWasteRepository.findUserById).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(inventoryWasteRepository.findSaleReturnItemById).mockResolvedValue(null);

    await expect(
      createWaste({ ...baseDto, sourceReturnItemId: 'return-item-inexistente' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('createWaste — dentro de la transaccion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWasteCreated();
    vi.mocked(inventoryWasteRepository.findProductById).mockResolvedValue({
      id: 'product-1',
      cost: 150,
    } as never);
    vi.mocked(inventoryWasteRepository.findSucursalById).mockResolvedValue({ id: 'sucursal-1' } as never);
    vi.mocked(inventoryWasteRepository.findUserById).mockResolvedValue({ id: 'user-1' } as never);
  });

  it('CASO LIMITE: rechaza mermar mas cantidad que el stock disponible', async () => {
    vi.mocked(inventoryRepository.findByProductAndSucursal).mockResolvedValue({
      quantity: 2,
    } as never);

    await expect(createWaste({ ...baseDto, quantity: 3 })).rejects.toBeInstanceOf(
      ValidationError,
    );

    // Reversion completa: nada se registra si la validacion de stock falla.
    expect(recordMovement).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('acepta mermar exactamente el stock disponible (limite inclusive)', async () => {
    vi.mocked(inventoryRepository.findByProductAndSucursal).mockResolvedValue({
      quantity: 3,
    } as never);

    await expect(createWaste({ ...baseDto, quantity: 3 })).resolves.toBeDefined();
  });

  it('trata la ausencia de fila de Inventory como stock 0 (rechaza cualquier merma)', async () => {
    vi.mocked(inventoryRepository.findByProductAndSucursal).mockResolvedValue(null);

    await expect(createWaste({ ...baseDto, quantity: 1 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('CALCULO DE INVENTARIO: emite un unico InventoryMovement WASTE con cantidad NEGATIVA (nunca escribe Inventory directamente)', async () => {
    vi.mocked(inventoryRepository.findByProductAndSucursal).mockResolvedValue({
      quantity: 10,
    } as never);

    await createWaste({ ...baseDto, quantity: 3 });

    expect(recordMovement).toHaveBeenCalledTimes(1);
    expect(recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'product-1',
        type: InventoryMovementType.WASTE,
        quantity: -3,
        referenceType: InventoryReferenceType.INVENTORY_WASTE,
      }),
    );
  });

  it('VALORIZACION: unitValue/totalValue se calculan desde Product.cost, no desde el precio de venta', async () => {
    vi.mocked(inventoryRepository.findByProductAndSucursal).mockResolvedValue({
      quantity: 10,
    } as never);

    const result = await createWaste({ ...baseDto, quantity: 3 });

    expect(result.unitValue).toBe(150);
    expect(result.totalValue).toBe(450); // 3 * 150
  });

  it('audita la merma dentro de la misma transaccion', async () => {
    vi.mocked(inventoryRepository.findByProductAndSucursal).mockResolvedValue({
      quantity: 10,
    } as never);

    await createWaste(baseDto);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        // Sprint QA 3.3 (regresion): ya NO usa el generico legacy
        // `AuditAction.INVENTORY_MOVEMENT` — usa la accion especifica
        // `INVENTORY_WASTE`.
        action: AuditAction.INVENTORY_WASTE,
        entity: 'InventoryWaste',
        metadata: expect.objectContaining({ type: 'WASTE' }),
      }),
    );
  });

  it('traduce la colision de unicidad de sourceReturnItemId (P2002) a ConflictError legible', async () => {
    vi.mocked(inventoryRepository.findByProductAndSucursal).mockResolvedValue({
      quantity: 10,
    } as never);
    vi.mocked(inventoryWasteRepository.findSaleReturnItemById).mockResolvedValue({
      id: 'return-item-1',
    } as never);

    const { Prisma } = await import('@prisma/client');
    const collisionError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['source_return_item_id'] },
    });
    vi.mocked(inventoryWasteRepository.create).mockRejectedValue(collisionError);

    await expect(
      createWaste({ ...baseDto, sourceReturnItemId: 'return-item-1' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
