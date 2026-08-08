/**
 * modules/inventory/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de inventario.
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `inventory.service.ts`). Usa
 * unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * Este archivo es el UNICO dueno del acceso a la tabla `Inventory` en todo
 * el proyecto. `create`, `findByProductAndSucursal` y `update` aceptan un
 * cliente `DbClient` opcional (por defecto el singleton `prisma`)
 * precisamente por eso: `shared/services/inventoryMovement.service.ts` (el
 * servicio transversal que sincroniza el saldo al registrar un movimiento
 * de inventario) las invoca dentro de su propia transaccion, en lugar de
 * duplicar el acceso a `Inventory` en otro archivo. En particular, `create`
 * es la que usa `recordMovement()` para auto-provisionar la fila de
 * `Inventory` (con `quantity: 0`) cuando el primer movimiento de un
 * producto en una sucursal ocurre antes de que exista una fila previa (ver
 * `inventoryMovement.service.ts`).
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Inventory` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { ListInventoryFilters } from './types';

/** Incluye los resumenes de sucursal y producto asociados a la existencia. */
const inventoryWithRelationsInclude = {
  sucursal: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      unitOfMeasure: true,
    },
  },
} as const;

export function create(data: Prisma.InventoryUncheckedCreateInput, db: DbClient = prisma) {
  return db.inventory.create({
    data,
    include: inventoryWithRelationsInclude,
  });
}

export function findById(id: string) {
  return prisma.inventory.findFirst({
    where: { id },
    include: inventoryWithRelationsInclude,
  });
}

export function findByProductAndSucursal(
  productId: string,
  sucursalId: string,
  db: DbClient = prisma,
) {
  return db.inventory.findFirst({
    where: { productId, sucursalId },
    include: inventoryWithRelationsInclude,
  });
}

/**
 * Version batched de `findByProductAndSucursal()`: lee la existencia de
 * varios productos en una sola consulta (`WHERE product_id IN (...)`), para
 * llamadores que necesitan el estado de varios productos a la vez
 * (`assertSufficientStock` en sales/service.ts, `recordMovements()` en
 * `inventoryMovement.service.ts`). Sin `include` de relaciones: estos
 * llamadores solo necesitan `productId`/`quantity`, no `sucursal`/`product`.
 */
export function findManyByProductsAndSucursal(
  productIds: string[],
  sucursalId: string,
  db: DbClient = prisma,
) {
  return db.inventory.findMany({
    where: { productId: { in: productIds }, sucursalId },
    select: { productId: true, quantity: true },
  });
}

/**
 * Crea varias filas de `Inventory` (quantity: 0) en una sola sentencia,
 * para los productos de un lote que aun no tienen existencia registrada en
 * la sucursal. `skipDuplicates`: si una transaccion concurrente ya creo la
 * fila para el mismo `(productId, sucursalId)` entre la lectura previa y
 * este `createMany`, se omite esa fila en vez de fallar con `P2002` (mismo
 * resultado final -- la fila existe -- pero mas tolerante a la carrera que
 * un `create()` individual sin capturar ese error).
 */
export function createManyMissing(
  data: Prisma.InventoryUncheckedCreateInput[],
  db: DbClient = prisma,
) {
  return db.inventory.createMany({ data, skipDuplicates: true });
}

/**
 * Hallazgo de rendimiento #2 (auditoria 31/07/2026, condicion de carrera):
 * "reserva" atomica de stock -- un `UPDATE` condicional
 * (`quantity >= requiredQuantity`) que NO cambia el valor (`increment: 0`),
 * pero SI adquiere el bloqueo de fila de Postgres para el resto de la
 * transaccion: Postgres toma el mismo bloqueo de escritura en un `UPDATE`
 * sin importar si el valor resultante es identico al anterior. Cumple el
 * mismo rol que un `SELECT ... FOR UPDATE` sin necesitar SQL crudo (el
 * proyecto evita `$queryRaw` deliberadamente, ver `reports.repository.ts`).
 *
 * Devuelve `{ count: 1 }` si habia stock suficiente (y el bloqueo quedo
 * tomado hasta el commit/rollback de la transaccion de `db`), `{ count: 0 }`
 * si no alcanzaba o no existe la fila -- en NINGUN caso modifica `quantity`,
 * asi que el descuento real sigue siendo responsabilidad exclusiva de
 * `shared/services/inventoryMovement.service.ts` (`recordMovement`/
 * `recordMovements`), sin duplicar logica de negocio ni tocar ese archivo.
 */
export function reserveIfSufficient(
  productId: string,
  sucursalId: string,
  requiredQuantity: number,
  db: DbClient = prisma,
) {
  return db.inventory.updateMany({
    where: { productId, sucursalId, quantity: { gte: requiredQuantity } },
    data: { quantity: { increment: 0 } },
  });
}

/**
 * Incrementa `quantity` de una fila de `Inventory` identificandola por su
 * llave natural `(productId, sucursalId)` (indice `@@unique` de
 * `schema.prisma`), sin necesitar su `id` -- evita una lectura previa solo
 * para obtenerlo. Mismo `UPDATE ... SET quantity = quantity + delta`
 * atomico que ya usa `update()`, misma proteccion contra "lost update".
 */
export function updateQuantityByProductAndSucursal(
  productId: string,
  sucursalId: string,
  data: Prisma.InventoryUncheckedUpdateInput,
  db: DbClient = prisma,
) {
  return db.inventory.update({
    where: { productId_sucursalId: { productId, sucursalId } },
    data,
    select: { quantity: true },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListInventoryFilters): Prisma.InventoryWhereInput {
  if (!filters) return {};

  return {
    sucursalId: filters.sucursalId,
    productId: filters.productId,
    // Bloque 7.29A: mismo patron que `products.repository.ts` (`OR` +
    // `contains`/`insensitive`), pero sobre la relacion `product` -- a
    // diferencia de Productos, `Inventory` no tiene sus propias columnas
    // de nombre/SKU/codigo de barras, asi que el filtro se aplica sobre
    // el producto asociado a cada existencia.
    ...(filters.search && {
      product: {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { sku: { contains: filters.search, mode: 'insensitive' } },
          { barcode: { contains: filters.search, mode: 'insensitive' } },
        ],
      },
    }),
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListInventoryFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.inventory.findMany({
      where,
      include: inventoryWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      // Bloque 7.29A: orden alfabetico por nombre de producto ascendente
      // (comportamiento por defecto pedido, sin selector de orden) --
      // reemplaza el `createdAt desc` anterior, sin parametro nuevo.
      orderBy: { product: { name: 'asc' } },
    }),
    prisma.inventory.count({ where }),
  ]);
}

export function update(
  id: string,
  data: Prisma.InventoryUncheckedUpdateInput,
  db: DbClient = prisma,
) {
  return db.inventory.update({
    where: { id },
    data,
    include: inventoryWithRelationsInclude,
  });
}
