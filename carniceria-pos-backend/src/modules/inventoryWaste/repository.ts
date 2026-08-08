/**
 * modules/inventoryWaste/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos del modulo de Mermas (Bloque 5.3). Es infraestructura
 * pura: no valida datos de entrada y no contiene reglas de negocio (eso
 * vive en `inventoryWaste.service.ts`). Usa unicamente la instancia
 * singleton de Prisma expuesta en `@/database`.
 *
 * `findProductById`/`findSucursalById`/`findUserById`/
 * `findSaleReturnItemById` leen directamente las tablas `Product`/
 * `Sucursal`/`User`/`SaleReturnItem` — mismo criterio ya usado en
 * `sales/repository.ts` (que a su vez lee `Product`/`Tax`/`CashSession`
 * directamente) y `returns/repository.ts`: cada modulo consulta lo que
 * necesita para validar, sin cruzar la frontera de otro modulo importando
 * su `service.ts`/`controller.ts`.
 *
 * El stock disponible NO se lee aca: `inventoryWaste.service.ts` reutiliza
 * `inventoryRepository.findByProductAndSucursal` de `modules/inventory/
 * repository.ts` directamente — mismo precedente ya establecido por
 * `sales/service.ts` (`assertSufficientStock`), que hace exactamente lo
 * mismo para validar stock antes de una venta.
 *
 * `create` acepta un `DbClient` opcional (por defecto el singleton
 * `prisma`), mismo patron que `sales/repository.ts`/`returns/repository.ts`,
 * para participar de la transaccion que `inventoryWaste.service.ts` abre
 * al registrar una merma junto con su `InventoryMovement`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { ListInventoryWastesFilters } from './types';

const inventoryWasteWithRelationsInclude = {
  sucursal: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
  user: { select: { id: true, fullName: true } },
} satisfies Prisma.InventoryWasteInclude;

/** Busca el producto por su ID, para validar su existencia y leer su
 * costo de referencia (`cost`, usado para el snapshot `unitValue`) antes
 * de registrar una merma. */
export function findProductById(id: string, db: DbClient = prisma) {
  return db.product.findFirst({ where: { id } });
}

/** Busca la sucursal por su ID, para validar su existencia antes de
 * registrar una merma. */
export function findSucursalById(id: string, db: DbClient = prisma) {
  return db.sucursal.findFirst({ where: { id } });
}

/** Busca el usuario por su ID, para validar su existencia antes de
 * registrar una merma. */
export function findUserById(id: string, db: DbClient = prisma) {
  return db.user.findFirst({ where: { id } });
}

/**
 * Busca la linea de devolucion referenciada por `sourceReturnItemId`, si
 * se proporciono — valida que exista antes de enlazar la merma a ella.
 * Lectura directa de `SaleReturnItem` (propiedad del modulo `returns`),
 * mismo criterio de archivo que el resto de este repositorio: NO se
 * importa `returns/service.ts` ni `returns/controller.ts`.
 *
 * Bloque 5.3: esta validacion es solo de INTEGRIDAD (el id, si se manda,
 * debe existir) — la arquitectura queda preparada para el origen
 * "automatico desde una devolucion", pero NADA todavia genera esta
 * relacion automaticamente (eso es explicitamente responsabilidad de un
 * bloque futuro que modifique `returns/service.ts`).
 */
export function findSaleReturnItemById(id: string, db: DbClient = prisma) {
  return db.saleReturnItem.findFirst({ where: { id } });
}

/** Crea una merma. Acepta un `DbClient` opcional para participar de la
 * transaccion abierta por `inventoryWaste.service.ts`. */
export function create(data: Prisma.InventoryWasteUncheckedCreateInput, db: DbClient = prisma) {
  return db.inventoryWaste.create({
    data,
    include: inventoryWasteWithRelationsInclude,
  });
}

/** Acepta un `DbClient` opcional (Bloque "Eliminación de Mermas"): permite
 * releer el registro DENTRO de la misma transacción que lo elimina, mismo
 * criterio que `create` de arriba. */
export function findById(id: string, db: DbClient = prisma) {
  return db.inventoryWaste.findFirst({
    where: { id },
    include: inventoryWasteWithRelationsInclude,
  });
}

/** Elimina físicamente una merma (Bloque "Eliminación de Mermas", ADMIN
 * únicamente — ver `inventoryWaste.service.ts::deleteWaste`). Acepta un
 * `DbClient` opcional para participar de la transacción que también
 * revierte el `InventoryMovement` correspondiente. */
export function deleteById(id: string, db: DbClient = prisma) {
  return db.inventoryWaste.delete({ where: { id } });
}

export function findMany(params: {
  skip: number;
  take: number;
  filters?: ListInventoryWastesFilters;
}) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.inventoryWaste.findMany({
      where,
      include: inventoryWasteWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inventoryWaste.count({ where }),
  ]);
}

function buildWhere(filters?: ListInventoryWastesFilters): Prisma.InventoryWasteWhereInput {
  return {
    ...(filters?.sucursalId && { sucursalId: filters.sucursalId }),
    ...(filters?.productId && { productId: filters.productId }),
    ...(filters?.userId && { userId: filters.userId }),
    ...(filters?.reason && { reason: filters.reason }),
  };
}
