/**
 * modules/purchases/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de compras.
 * Es infraestructura pura: no valida datos de entrada y no contiene reglas
 * de negocio (eso vive en `purchases.service.ts`). Usa unicamente la
 * instancia singleton de Prisma expuesta en `@/database`.
 *
 * `create` acepta un cliente `DbClient` opcional (por defecto el singleton
 * `prisma`) para poder ejecutarse dentro de la transaccion que
 * `purchases.service.ts` abre al crear una compra, junto con el registro
 * de los movimientos de inventario correspondientes
 * (`shared/services/inventoryMovement.service.ts`). El resto de funciones
 * de este archivo no participa de esa transaccion y no necesita el
 * parametro.
 *
 * Incluye `findProductsByIds` y `findTaxesByIds`: lecturas necesarias para
 * que `purchases.service.ts` calcule los totales de la compra (subtotal,
 * impuestos y total) usando datos reales de la base de datos en lugar de
 * confiar en valores enviados por el cliente. Se mantienen aqui, y no en los
 * repositorios de Products/Taxes, para no modificar modulos ya aprobados y
 * para que toda consulta Prisma de este modulo siga viviendo unicamente en
 * este archivo.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Purchase` se registre en
 * `SOFT_DELETE_MODELS`.
 *
 * NOTA: `Purchase` no tiene ninguna restriccion `@@unique` en `schema.prisma`,
 * por lo que este repositorio no expone un finder de duplicados (a diferencia
 * de Categories, Products, Taxes, Suppliers e Inventory).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { ListPurchasesFilters } from './types';

/** Incluye los resumenes de sucursal, proveedor, usuario y los detalles
 * asociados a la compra. */
const purchaseWithRelationsInclude = {
  sucursal: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
      fullName: true,
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      taxId: true,
      quantity: true,
      unitCost: true,
      taxRate: true,
      // Bloque COST-06.1: `select` explicito, asi que hay que agregarla
      // aca para que la API la devuelva (a diferencia de `include`, que
      // trae todos los escalares automaticamente).
      expectedWastePercent: true,
      // Bloque LOTES-09: mismo motivo que `expectedWastePercent` -- `select`
      // explicito, hay que agregarlas para que la API las devuelva.
      supplierLotCode: true,
      productionDate: true,
      expiryDate: true,
      lineSubtotal: true,
      lineTax: true,
      lineTotal: true,
      // Bloque Motor de Documentos (PURCHASE_ORDER): resumen de producto/
      // impuesto por linea, mismo criterio ya usado por Sales
      // (`sales/repository.ts`, `product`/`tax` de `SaleItem`) -- sin esto
      // el documento (y cualquier otra vista) solo tiene `productId`/
      // `taxId` crudos, sin nombre para mostrar.
      product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
      tax: { select: { id: true, name: true } },
    },
  },
} as const;

export function create(data: Prisma.PurchaseUncheckedCreateInput, db: DbClient = prisma) {
  return db.purchase.create({
    data,
    include: purchaseWithRelationsInclude,
  });
}

export function findById(id: string) {
  return prisma.purchase.findFirst({
    where: { id },
    include: purchaseWithRelationsInclude,
  });
}

/** Busca los productos referenciados por sus IDs. Se usa para validar que
 * cada `productId` de los detalles exista antes de calcular los totales. */
export function findProductsByIds(ids: string[]) {
  return prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
}

/** Busca los impuestos referenciados por sus IDs. Se usa para obtener la
 * tasa (`rate`) real con la que el servicio calcula `lineTax` y `taxTotal`. */
export function findTaxesByIds(ids: string[]) {
  return prisma.tax.findMany({
    where: { id: { in: ids } },
    select: { id: true, rate: true },
  });
}

/** Bloque 14.8 (Actualizacion automatica de costos): costo VIGENTE de cada
 * producto, leido DENTRO de la transaccion (`tx`) que recibe la compra —
 * mismo criterio que `inventoryRepository.findManyByProductsAndSucursal`
 * (nunca confiar en un valor leido antes de abrir la transaccion). Funcion
 * nueva y separada de `findProductsByIds` (que solo trae `id`, para
 * validar existencia): no se le agrega `cost` para no cambiar la forma que
 * ya devuelve a sus llamadores existentes. */
export function findProductCostsByIds(ids: string[], db: DbClient = prisma) {
  return db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, cost: true },
  });
}

/** Bloque LOTES-02 (Modulo de Lotes, integracion con Compras): indica que
 * productos de la compra tienen `Product.requiresBatch = true`, leido
 * DENTRO de la transaccion que recibe la compra -- mismo criterio que
 * `findProductCostsByIds`. Funcion nueva y separada de `findProductsByIds`
 * por el mismo motivo: no cambiar la forma que ya devuelve a sus
 * llamadores existentes. */
export function findProductBatchFlagsByIds(ids: string[], db: DbClient = prisma) {
  return db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, requiresBatch: true },
  });
}

/** Bloque 14.8: escribe el nuevo costo promedio ponderado de un producto.
 * Acepta `tx` para participar de la misma transaccion que crea la compra y
 * registra sus movimientos de inventario — actualiza UNICAMENTE `cost`. */
export function updateProductCost(
  id: string,
  cost: Prisma.Decimal,
  db: DbClient = prisma,
) {
  return db.product.update({
    where: { id },
    data: { cost },
    select: { id: true },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListPurchasesFilters): Prisma.PurchaseWhereInput {
  if (!filters) return {};

  return {
    sucursalId: filters.sucursalId,
    supplierId: filters.supplierId,
    status: filters.status,
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListPurchasesFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.purchase.findMany({
      where,
      include: purchaseWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchase.count({ where }),
  ]);
}

/** Bloque 14.8 (correccion, transicion DRAFT/CANCELLED -> RECEIVED via
 * `update()`): acepta un `DbClient` opcional (por defecto el singleton
 * `prisma`), mismo criterio que `create()` — cuando la compra transiciona
 * a `RECEIVED`, esta escritura debe participar de la MISMA transaccion que
 * recalcula `Product.cost` y registra los movimientos de inventario. El
 * resto de llamadas a `update()` (que no transicionan a `RECEIVED`) no
 * necesitan el parametro y siguen usando el singleton, sin cambio de
 * comportamiento. */
export function update(
  id: string,
  data: Prisma.PurchaseUncheckedUpdateInput,
  db: DbClient = prisma,
) {
  return db.purchase.update({
    where: { id },
    data,
    include: purchaseWithRelationsInclude,
  });
}
