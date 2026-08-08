/**
 * modules/inventory/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de inventario.
 *
 * Responsabilidades:
 *  - Validar existencia del registro de inventario antes de leer/actualizar.
 *  - Validar que la combinacion `productId` + `sucursalId` no este duplicada
 *    al crear o actualizar (restriccion `@@unique([productId, sucursalId])`
 *    de `schema.prisma`: una existencia por producto y sucursal).
 *  - Traducir los registros de Prisma a la forma publica `InventoryResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `inventory.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { InventoryMovementType, Prisma } from '@prisma/client';
import { prisma } from '@/database';
import { transactionConfig } from '@/config';
import { ConflictError, NotFoundError } from '@/shared/errors';
import { InventoryReferenceType } from '@/shared/constants';
import { recordMovement } from '@/shared/services/inventoryMovement.service';
import * as inventoryRepository from './repository';
import type {
  CreateInventoryDto,
  InventoryResponse,
  ListInventoryQuery,
  ListInventoryResult,
  UnitOfMeasure,
  UpdateInventoryDto,
} from './types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type InventoryRecord = {
  id: string;
  sucursalId: string;
  productId: string;
  quantity: Prisma.Decimal;
  reorderPoint: Prisma.Decimal | null;
  sucursal: { id: string; code: string; name: string };
  product: { id: string; name: string; sku: string | null; unitOfMeasure: string };
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica de la existencia de inventario. */
function toInventoryResponse(inventory: InventoryRecord): InventoryResponse {
  return {
    id: inventory.id,
    sucursalId: inventory.sucursalId,
    productId: inventory.productId,
    quantity: Number(inventory.quantity),
    reorderPoint: inventory.reorderPoint === null ? null : Number(inventory.reorderPoint),
    sucursal: inventory.sucursal,
    product: {
      id: inventory.product.id,
      name: inventory.product.name,
      sku: inventory.product.sku,
      unitOfMeasure: inventory.product.unitOfMeasure as UnitOfMeasure,
    },
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,
  };
}

export async function create(dto: CreateInventoryDto): Promise<InventoryResponse> {
  const existingByProductAndSucursal = await inventoryRepository.findByProductAndSucursal(
    dto.productId,
    dto.sucursalId,
  );

  if (existingByProductAndSucursal) {
    throw new ConflictError(
      'Ya existe un registro de inventario para este producto en esta sucursal.',
    );
  }

  const created = await inventoryRepository.create({
    sucursalId: dto.sucursalId,
    productId: dto.productId,
    quantity: dto.quantity ?? 0,
    reorderPoint: dto.reorderPoint ?? null,
  });

  return toInventoryResponse(created);
}

export async function findById(id: string): Promise<InventoryResponse> {
  const inventory = await inventoryRepository.findById(id);

  if (!inventory) {
    throw new NotFoundError('Inventario');
  }

  return toInventoryResponse(inventory);
}

export async function findMany(query: ListInventoryQuery): Promise<ListInventoryResult> {
  const [items, total] = await inventoryRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toInventoryResponse(item)),
    total,
  };
}

export async function update(
  id: string,
  dto: UpdateInventoryDto,
  userId: string,
): Promise<InventoryResponse> {
  const existing = await inventoryRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Inventario');
  }

  const nextProductId = dto.productId ?? existing.productId;
  const nextSucursalId = dto.sucursalId ?? existing.sucursalId;

  if (nextProductId !== existing.productId || nextSucursalId !== existing.sucursalId) {
    const existingByProductAndSucursal = await inventoryRepository.findByProductAndSucursal(
      nextProductId,
      nextSucursalId,
    );

    if (existingByProductAndSucursal) {
      throw new ConflictError(
        'Ya existe un registro de inventario para este producto en esta sucursal.',
      );
    }
  }

  // Diferencia con signo entre la cantidad nueva y la actual. Si `quantity`
  // no vino en el body, o coincide con la actual, no hay ajuste real que
  // registrar (ej. un PATCH que solo cambia `reorderPoint`).
  const quantityDiff = dto.quantity !== undefined ? dto.quantity - Number(existing.quantity) : 0;

  const updated = await prisma.$transaction(async (tx) => {
    if (quantityDiff !== 0) {
      // Registra el ajuste como InventoryMovement (type: ADJUSTMENT) y
      // sincroniza Inventory.quantity de forma atomica -- recordMovement
      // ya actualiza la fila internamente (ver
      // shared/services/inventoryMovement.service.ts), asi que este
      // service no vuelve a escribir `quantity` por su cuenta.
      await recordMovement({
        tx,
        sucursalId: nextSucursalId,
        productId: nextProductId,
        userId,
        type: InventoryMovementType.ADJUSTMENT,
        quantity: quantityDiff,
        referenceType: InventoryReferenceType.INVENTORY_ADJUSTMENT,
        referenceId: existing.id,
        reason: 'Ajuste manual de inventario',
      });
    }

    // El resto de los campos (sucursalId/productId/reorderPoint) se
    // actualiza aparte: recordMovement solo toca `quantity`. Esta
    // llamada tambien sirve para releer el registro completo (con
    // relaciones) para la respuesta, haya habido o no cambio de cantidad.
    return inventoryRepository.update(
      id,
      {
        sucursalId: dto.sucursalId,
        productId: dto.productId,
        reorderPoint: dto.reorderPoint,
      },
      tx,
    );
  }, transactionConfig.standard);

  return toInventoryResponse(updated);
}
