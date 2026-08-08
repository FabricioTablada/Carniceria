/**
 * modules/returns/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos del modulo de devoluciones (Bloque 4.2). Es infraestructura
 * pura: no valida datos de entrada y no contiene reglas de negocio (eso vive
 * en `returns.service.ts`). Usa unicamente la instancia singleton de Prisma
 * expuesta en `@/database`.
 *
 * `findSaleForValidation`/`findCashSessionById`/`sumReturnedQuantityByItemIds`
 * leen directamente las tablas `Sale`/`CashSession`/`SaleReturnItem` — mismo
 * criterio ya usado en `sales/repository.ts` (que a su vez lee `Product`/
 * `Tax`/`CashSession` directamente, sin importar los modulos de Products/
 * Taxes/Cash): cada modulo consulta lo que necesita para validar, sin cruzar
 * la frontera de otro modulo.
 *
 * `create`/`createCashMovement` aceptan un `DbClient` opcional (por defecto
 * el singleton `prisma`), mismo patron que `sales/repository.ts`, para poder
 * participar de la transaccion que `returns.service.ts` abre al registrar
 * una devolucion junto con su reverso de inventario (via el servicio
 * transversal `shared/services/inventoryMovement.service.ts`) y su
 * movimiento de caja.
 *
 * NOTA (Bloque 4.2, ver analisis del Bloque 4): `createCashMovement` es una
 * escritura directa a `CashMovement`, no un servicio transversal como
 * `recordMovement` — hoy no existe un equivalente para movimientos de caja
 * en `shared/services/`; `sales/service.ts` tampoco pasa por el modulo de
 * Cash para nada relacionado a `CashSession`/`CashMovement`, mismo criterio
 * aca.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { InventoryReferenceType } from '@/shared/constants';
import type { ListSaleReturnsFilters } from './types';

const saleReturnWithRelationsInclude = {
  sucursal: { select: { id: true, name: true } },
  user: { select: { id: true, fullName: true } },
  // Bloque 4.4 ("hacer visibles las devoluciones ya registradas"): antes
  // `items: true` traia solo el detalle crudo de la devolucion, sin el
  // producto de la linea de venta original. Se necesita `productId` (no se
  // guarda en `SaleReturnItem`, solo en `SaleItem`) para poder cruzarlo
  // contra `InventoryMovement` y saber si esa linea volvio a stock — ver
  // `findRestockedProductIdsByReturnIds` mas abajo. Solo LECTURA: no
  // cambia la transaccion de creacion ni ningun calculo.
  items: {
    include: {
      saleItem: { select: { productId: true } },
    },
  },
} satisfies Prisma.SaleReturnInclude;

/** Forma minima de venta necesaria para validar una devolucion: sus
 * detalles (para verificar pertenencia y cantidad original de cada linea)
 * y si ya fue reemplazada por una correccion (Bloque 3). */
const saleForReturnValidationInclude = {
  items: true,
  correctedBySale: { select: { id: true } },
} satisfies Prisma.SaleInclude;

/** Busca una venta con los datos minimos necesarios para validar una
 * devolucion contra ella. */
export function findSaleForValidation(saleId: string, db: DbClient = prisma) {
  return db.sale.findFirst({
    where: { id: saleId },
    include: saleForReturnValidationInclude,
  });
}

/** Busca la sesion de caja que emitiria el reembolso, para validar su
 * existencia antes de registrar la devolucion — mismo criterio que
 * `sales/repository.ts` `findCashSessionById` (no valida que este OPEN,
 * mismo alcance que esa validacion en Sales). */
export function findCashSessionById(id: string, db: DbClient = prisma) {
  return db.cashSession.findFirst({ where: { id } });
}

/**
 * Auditoria de riesgos criticos (Hallazgo 1, 07/08/2026) — bloqueo de fila
 * de los `SaleItem` involucrados en una devolucion, ANTES de leer cuanto se
 * devolvio previamente (`sumReturnedQuantityByItemIds`, justo abajo).
 *
 * Sin esto, esa lectura era un `SELECT`/`groupBy` simple dentro de la
 * transaccion — bajo el nivel de aislamiento por defecto de Postgres (READ
 * COMMITTED), eso NO bloquea la fila contra otra transaccion concurrente:
 * dos devoluciones para la MISMA linea de venta, casi simultaneas, podian
 * leer ambas "0 ya devuelto" antes de que cualquiera confirmara, permitiendo
 * devolver mas cantidad de la realmente vendida (condicion de carrera real,
 * no teorica).
 *
 * Mismo patron ya aprobado y probado en Ventas
 * (`modules/inventory/repository.ts::reserveIfSufficient`): un `UPDATE`
 * que no cambia el valor (`increment: 0`) pero SI toma el bloqueo de fila de
 * Postgres hasta el commit/rollback de la transaccion — sin necesitar SQL
 * crudo (el proyecto lo evita deliberadamente, ver comentario de
 * `reserveIfSufficient`). Aca se aplica sobre `SaleItem` (no `Inventory`,
 * distinto invariante) porque lo que hay que serializar es "cuanto se
 * devolvio de ESTA linea de venta", no el stock general del producto.
 *
 * Debe llamarse DENTRO de la misma transaccion que crea la devolucion,
 * ANTES de `sumReturnedQuantityByItemIds` — cualquier otra transaccion que
 * intente lo mismo sobre alguna de estas mismas lineas espera hasta que
 * esta transaccion termine, con lo cual su propia lectura de "cuanto ya se
 * devolvio" siempre ve el efecto de la anterior ya confirmado.
 */
export function lockSaleItemsForUpdate(saleItemIds: string[], db: DbClient) {
  if (saleItemIds.length === 0) {
    return Promise.resolve({ count: 0 });
  }

  return db.saleItem.updateMany({
    where: { id: { in: saleItemIds } },
    data: { quantity: { increment: 0 } },
  });
}

/**
 * Suma, por `saleItemId`, la cantidad ya devuelta en devoluciones previas
 * (`groupBy`, sin SQL crudo, mismo criterio que `reports.repository.ts`) —
 * usada para validar que una nueva devolucion no supere lo vendido. Debe
 * leerse DENTRO de la misma transaccion que crea la devolucion nueva, y
 * DESPUES de `lockSaleItemsForUpdate` (arriba) — esa lectura por si sola
 * nunca bloqueo nada contra concurrencia (Hallazgo 1, ver ese comentario).
 */
export function sumReturnedQuantityByItemIds(saleItemIds: string[], db: DbClient = prisma) {
  if (saleItemIds.length === 0) {
    return Promise.resolve([]);
  }

  return db.saleReturnItem.groupBy({
    by: ['saleItemId'],
    where: { saleItemId: { in: saleItemIds } },
    _sum: { quantity: true },
  });
}

/** Crea una devolucion junto con sus detalles (`items`), en una sola
 * operacion anidada de Prisma. Acepta un `DbClient` opcional para
 * participar de la transaccion abierta por `returns.service.ts`. */
export function create(data: Prisma.SaleReturnUncheckedCreateInput, db: DbClient = prisma) {
  return db.saleReturn.create({
    data,
    include: saleReturnWithRelationsInclude,
  });
}

export function findById(id: string) {
  return prisma.saleReturn.findFirst({
    where: { id },
    include: saleReturnWithRelationsInclude,
  });
}

export function findMany(params: { skip: number; take: number; filters?: ListSaleReturnsFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.saleReturn.findMany({
      where,
      include: saleReturnWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.saleReturn.count({ where }),
  ]);
}

function buildWhere(filters?: ListSaleReturnsFilters): Prisma.SaleReturnWhereInput {
  return {
    ...(filters?.saleId && { saleId: filters.saleId }),
    ...(filters?.sucursalId && { sucursalId: filters.sucursalId }),
    ...(filters?.cashSessionId && { cashSessionId: filters.cashSessionId }),
    ...(filters?.userId && { userId: filters.userId }),
  };
}

/**
 * Bloque LOTES-05 (integracion con Devoluciones): indica que productos de
 * ESTA devolucion tienen `Product.requiresBatch = true`, y su costo de
 * referencia VIGENTE (`cost`) -- leido DENTRO de la transaccion que crea
 * la devolucion, mismo criterio que
 * `purchases/repository.ts::findProductBatchFlagsByIds`/
 * `sales/repository.ts::findProductBatchFlagsByIds`. El `cost` es
 * UNICAMENTE el respaldo para el lote de reingreso cuando la
 * `SaleItem.unitCost` original quedo `null` (ventas anteriores al Bloque
 * 14.2) -- `returns/service.ts` prefiere siempre el snapshot original de
 * la venta quando existe.
 */
export function findProductBatchInfoByIds(ids: string[], db: DbClient = prisma) {
  return db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, requiresBatch: true, cost: true },
  });
}

/** Registra el movimiento de caja del reembolso (`type: REFUND`), solo
 * cuando el reembolso es en efectivo — ver `returns.service.ts`. Escritura
 * directa a `CashMovement` (ver nota de archivo): no existe un servicio
 * transversal equivalente a `recordMovement` para movimientos de caja. */
export function createCashMovement(data: Prisma.CashMovementUncheckedCreateInput, db: DbClient) {
  return db.cashMovement.create({ data });
}

/**
 * Bloque 4.4 ("Destino del producto: Inventario o Merma"). El `restock`
 * por linea (ver `CreateSaleReturnItemDto`) NUNCA se persiste — solo
 * decide, en el momento de crear la devolucion, si `returns.service.ts`
 * emite o no el `InventoryMovement` de tipo `RETURN` (Bloque 4.2, sin
 * cambios aca). Para mostrarlo despues, se reconstruye leyendo esos
 * mismos movimientos: si existe un `InventoryMovement` con
 * `referenceType: 'SALE_RETURN'` y `referenceId` igual al id de la
 * devolucion para ese producto, esa linea SI volvio a stock; si no existe,
 * fue merma. Pura lectura sobre datos ya escritos por la transaccion del
 * Bloque 4.2 — no se crea, muta ni recalcula ningun movimiento aca.
 */
export function findRestockedProductIdsByReturnIds(saleReturnIds: string[], db: DbClient = prisma) {
  if (saleReturnIds.length === 0) {
    return Promise.resolve([]);
  }

  return db.inventoryMovement.findMany({
    where: { referenceType: InventoryReferenceType.SALE_RETURN, referenceId: { in: saleReturnIds } },
    select: { referenceId: true, productId: true },
  });
}
