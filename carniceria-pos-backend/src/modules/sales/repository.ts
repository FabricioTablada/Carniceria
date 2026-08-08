/**
 * modules/sales/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de ventas.
 * Es infraestructura pura: no valida datos de entrada y no contiene reglas
 * de negocio (eso vive en `sales.service.ts`). Usa unicamente la instancia
 * singleton de Prisma expuesta en `@/database`.
 *
 * `create` acepta un cliente `DbClient` opcional (por defecto el singleton
 * `prisma`) para poder ejecutarse dentro de la transaccion que
 * `sales.service.ts` abre al crear una venta, junto con el registro de los
 * movimientos de inventario correspondientes
 * (`shared/services/inventoryMovement.service.ts`). El resto de funciones
 * de este archivo no participa de esa transaccion y no necesita el
 * parametro.
 *
 * Incluye `findProductsByIds`, `findTaxesByIds`, `findSucursalById`,
 * `findUserById` y `findCashSessionById`: lecturas necesarias para que
 * `sales.service.ts` valide la existencia de todas las entidades referidas
 * por la venta y calcule sus totales usando datos reales de la base de
 * datos en lugar de confiar en valores enviados por el cliente. Se
 * mantienen aqui, y no en los repositorios de Products/Taxes, para no
 * modificar modulos ya aprobados y para que toda consulta Prisma de este
 * modulo siga viviendo unicamente en este archivo.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Sale` se registre en
 * `SOFT_DELETE_MODELS`.
 *
 * NOTA: `Sale` tiene la restriccion `@@unique([sucursalId, documentNumber])`
 * en `schema.prisma`, por lo que `findByDocumentNumber` existe para validar
 * duplicados (a diferencia de Purchases, que no tiene ninguna `@@unique`).
 */
import { CashMovementType, Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { InventoryReferenceType } from '@/shared/constants';
import type { ListSalesFilters } from './types';

const saleWithRelationsInclude = {
  sucursal: { select: { id: true, code: true, name: true } },
  user: { select: { id: true, fullName: true } },
  cashSession: { select: { id: true, status: true } },
  // Bloque 8.3: cliente asociado (modulo de Clientes, Bloque 8.2) — `null`
  // = "Publico General". Mismo criterio de resumen liviano que
  // `sucursal`/`user`, nunca el registro completo.
  customer: {
    select: { id: true, name: true, identificationType: true, identificationNumber: true, email: true },
  },
  // Bloque 3 ("Detalle de Venta"): antes `items: true` traia cada detalle
  // crudo (solo `productId`/`taxId`, sin nombre) — el detalle completo de
  // venta necesita el nombre/SKU/unidad del producto y el nombre del
  // impuesto para cada linea, no solo sus ids. `unitPrice`/`taxRate`/
  // `discount`/`lineTotal` siguen siendo el snapshot ya guardado en
  // `SaleItem`, sin cambios.
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
      tax: { select: { id: true, name: true } },
    },
  },
  // Trazabilidad de correccion (Bloque 3): resumen minimo de la venta
  // original (si esta es una venta correctiva) y de la venta correctiva
  // (si esta ya fue corregida) — nunca el objeto completo, para no anidar
  // indefinidamente.
  originalSale: { select: { id: true, documentNumber: true, status: true } },
  correctedBySale: { select: { id: true, documentNumber: true, status: true } },
  // Bloque P.2 (Motor de Promociones, exposicion de la auditoria): cada
  // descuento realmente aplicado a esta venta — hoy, a lo sumo uno (el
  // descuento manual de carrito, Bloque P.1). `appliedByUser` resuelve el
  // nombre de quien lo aplico (solo tiene valor cuando `source: MANUAL`).
  appliedPromotions: {
    include: {
      appliedByUser: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.SaleInclude;

/** Crea una venta junto con sus detalles (`items`), en una sola operacion
 * anidada de Prisma. Acepta un `DbClient` opcional para participar de la
 * transaccion abierta por `sales.service.ts`. */
export function create(data: Prisma.SaleUncheckedCreateInput, db: DbClient = prisma) {
  return db.sale.create({
    data,
    include: saleWithRelationsInclude,
  });
}

/** Bloque P.1 (Motor de Promociones, infraestructura de auditoria): registra
 * los descuentos realmente aplicados a la venta (el manual de carrito, si
 * hubo, mas cada promocion automatica que aplico). Acepta un `DbClient`
 * opcional para participar de la MISMA transaccion que `create()` — si la
 * venta hace rollback, estas filas de auditoria tambien. Escritura directa
 * a `SaleAppliedPromotion`: todavia no existe un modulo propio de
 * promociones (sin endpoints, sin catalogo `Promotion`), asi que vive aca
 * junto al unico flujo que hoy la genera.
 *
 * Bloque "reduccion de tiempo en transaccion" (crash bajo carga concurrente,
 * 2026-08-03): antes era `createAppliedPromotion()`, invocada una vez POR
 * FILA (un `INSERT` por descuento aplicado) dentro de la transaccion de
 * venta. `createMany` inserta el mismo conjunto de filas, con los mismos
 * valores, en una unica escritura — reduce cuantos round-trips a la base
 * de datos mantienen abierta la transaccion sin cambiar que se persiste. */
export function createAppliedPromotions(
  data: Prisma.SaleAppliedPromotionUncheckedCreateInput[],
  db: DbClient = prisma,
) {
  return db.saleAppliedPromotion.createMany({ data });
}

/** Acepta un `DbClient` opcional (por defecto el singleton `prisma`) para
 * poder releerse DENTRO de la misma transaccion que `tryCancel` — ver
 * `voidSaleTransaction` en `sales.service.ts` (Sprint QA 1: fix de
 * concurrencia). */
export function findById(id: string, db: DbClient = prisma) {
  return db.sale.findFirst({
    where: { id },
    include: saleWithRelationsInclude,
  });
}

/**
 * Sprint QA 1 (fix de concurrencia): cancela la venta SOLO SI su estado
 * actual todavia no es `CANCELLED` — `UPDATE ... WHERE id = ? AND status
 * != 'CANCELLED'` (compare-and-swap atomico a nivel de fila, resuelto por
 * Postgres via bloqueo de fila en el propio `UPDATE`, no por una
 * comprobacion previa en la aplicacion). Antes de este fix,
 * `voidSaleTransaction` escribia `status: 'CANCELLED'` incondicionalmente
 * y la validacion "la venta no esta ya anulada" se leia ANTES de abrir la
 * transaccion (`voidSale`/`correctSale` en `sales.service.ts`) — dos
 * solicitudes concurrentes sobre la MISMA venta (doble click, reintento de
 * red, dos usuarios) podian ambas pasar esa lectura y ambas ejecutar la
 * reversa completa de inventario, duplicando el stock acreditado y el
 * registro de auditoria. Con este `UPDATE` condicional, solo una de las
 * dos transacciones concurrentes puede afectar una fila (`count === 1`);
 * la otra ve `count === 0` y su transaccion completa hace rollback (ver
 * `voidSaleTransaction`), sin tocar inventario ni auditoria.
 */
export function tryCancel(id: string, db: DbClient = prisma) {
  return db.sale.updateMany({
    where: { id, status: { not: 'CANCELLED' } },
    data: { status: 'CANCELLED' },
  });
}

/** Busca una venta por su sucursal y numero de documento, usados en
 * conjunto por la restriccion `@@unique([sucursalId, documentNumber])`. */
export function findByDocumentNumber(sucursalId: string, documentNumber: string) {
  return prisma.sale.findFirst({
    where: { sucursalId, documentNumber },
  });
}

/** Busca el mayor `documentNumber` con formato `VTA-######` ya existente
 * en `Sale`. Los numeros estan rellenados con ceros a la izquierda a 6
 * digitos, por lo que el orden LEXICOGRAFICO de estos strings coincide
 * exactamente con el orden NUMERICO — no hace falta parsear ni usar SQL
 * crudo, un simple `ORDER BY documentNumber DESC LIMIT 1` alcanza. */
export function findMaxSaleDocumentNumber(db: DbClient = prisma) {
  return db.sale.findFirst({
    where: { documentNumber: { startsWith: 'VTA-' } },
    orderBy: { documentNumber: 'desc' },
    select: { documentNumber: true },
  });
}

/** Incrementa en 1 el consecutivo global de documentos de venta (fila
 * `DocumentSequence` con `name: 'SALE'`) y devuelve el nuevo valor.
 * Acepta un `DbClient` opcional para participar de la misma transaccion
 * que `create()`, igual que ese metodo: si la venta hace rollback, el
 * incremento tambien lo hace, sin dejar huecos en la numeracion. El
 * `upsert` de Postgres es atomico (`INSERT ... ON CONFLICT DO UPDATE`),
 * por lo que dos transacciones concurrentes no pueden generar el mismo
 * numero.
 *
 * La rama `create` (solo se ejecuta la PRIMERA vez que se usa la
 * secuencia, cuando la fila `name: 'SALE'` todavia no existe) arranca
 * despues del mayor `documentNumber` real ya existente en `Sale`
 * (`findMaxSaleDocumentNumber`), en vez de arrancar siempre en 1 — asi el
 * primer numero autogenerado nunca choca con uno creado manualmente
 * antes de que existiera este generador. Una vez que la fila existe, esta
 * rama nunca vuelve a ejecutarse: todas las llamadas siguientes solo
 * incrementan. */
export async function incrementSaleDocumentSequence(db: DbClient = prisma) {
  const lastSale = await findMaxSaleDocumentNumber(db);
  const baseline = lastSale?.documentNumber
    ? Number(lastSale.documentNumber.slice('VTA-'.length))
    : 0;

  const sequence = await db.documentSequence.upsert({
    where: { name: 'SALE' },
    update: { value: { increment: 1 } },
    create: { name: 'SALE', value: baseline + 1 },
  });

  return sequence.value;
}

/** Busca los productos referenciados por sus IDs. Se usa para validar que
 * cada `productId` de los detalles exista antes de calcular los totales. */
export function findProductsByIds(ids: string[]) {
  return prisma.product.findMany({
    where: { id: { in: ids } },
  });
}

/** Bloque LOTES-03 (Modulo de Lotes, integracion con Ventas): indica que
 * productos del carrito tienen `Product.requiresBatch = true`, leido
 * DENTRO de la transaccion que crea la venta -- mismo criterio y misma
 * forma que `purchases/repository.ts::findProductBatchFlagsByIds`. Funcion
 * nueva y separada de `findProductsByIds` (que ya trae la fila completa,
 * pero cuyo tipo de retorno declarado en `computeItems()` no expone este
 * campo): evita ensanchar el tipo compartido `SaleQuoteCalculation`
 * (`computeSaleQuoteCalculation()`, usado tambien por la cotizacion de solo lectura,
 * `POST /sales/quote`) solo para esta necesidad puntual de
 * `createSaleTransaction`. */
export function findProductBatchFlagsByIds(ids: string[], db: DbClient = prisma) {
  return db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, requiresBatch: true, cost: true },
  });
}

/** Busca los impuestos referenciados por sus IDs. Se usa para validar que
 * cada `taxId` de los detalles exista y para obtener su tasa vigente. */
export function findTaxesByIds(ids: string[]) {
  return prisma.tax.findMany({
    where: { id: { in: ids } },
  });
}

/** Busca la sucursal por su ID, para validar su existencia antes de crear
 * o actualizar una venta. */
export function findSucursalById(id: string) {
  return prisma.sucursal.findFirst({
    where: { id },
  });
}

/** Busca el usuario por su ID, para validar su existencia antes de crear
 * o actualizar una venta. */
export function findUserById(id: string) {
  return prisma.user.findFirst({
    where: { id },
  });
}

/** Busca la sesion de caja por su ID, para validar su existencia antes de
 * crear o actualizar una venta. */
export function findCashSessionById(id: string) {
  return prisma.cashSession.findFirst({
    where: { id },
  });
}

/** Busca el cliente por su ID, para validar su existencia antes de crear
 * una venta con `customerId` (Bloque 8.3) — mismo criterio de acceso
 * directo a otro modulo ya usado por `findProductsByIds`/`findTaxesByIds`
 * en este mismo archivo (ver `ARCHITECTURE.md` §5). */
export function findCustomerById(id: string) {
  return prisma.customer.findFirst({
    where: { id },
  });
}

export function findMany(params: { skip: number; take: number; filters?: ListSalesFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.sale.findMany({
      where,
      include: saleWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.count({ where }),
  ]);
}

function buildWhere(filters?: ListSalesFilters): Prisma.SaleWhereInput {
  return {
    ...(filters?.sucursalId && { sucursalId: filters.sucursalId }),
    ...(filters?.userId && { userId: filters.userId }),
    ...(filters?.cashSessionId && { cashSessionId: filters.cashSessionId }),
    ...(filters?.status && { status: filters.status }),
  };
}

/** Acepta un `DbClient` opcional (por defecto el singleton `prisma`), mismo
 * criterio que `create()`: `voidSale`/`correctSale` en `sales.service.ts`
 * (Bloque 3) necesitan que esta escritura participe de la misma
 * transaccion que reversa el inventario y registra la auditoria. */
export function update(
  id: string,
  data: Prisma.SaleUncheckedUpdateInput,
  db: DbClient = prisma,
) {
  return db.sale.update({
    where: { id },
    data,
    include: saleWithRelationsInclude,
  });
}

/**
 * Version 1.0.3, Bloque 1 (vuelto en efectivo): registra el `CashMovement`
 * tipo `CHANGE` de una venta en efectivo con vuelto > 0. Mismo patron que
 * `returns/repository.ts::createCashMovement` (REFUND) — escritura directa
 * a `CashMovement`, sin servicio transversal (no existe uno en
 * `shared/services/` para movimientos de caja). Acepta un `DbClient`
 * opcional para participar de la misma transaccion que crea/edita la venta.
 */
export function createCashMovement(data: Prisma.CashMovementUncheckedCreateInput, db: DbClient = prisma) {
  return db.cashMovement.create({ data });
}

/**
 * Busca el `CashMovement` tipo `CHANGE` ACTIVO (`deletedAt: null`) de una
 * venta. `CashMovement` no esta en `SOFT_DELETE_MODELS`
 * (`database/extensions/softDelete.ext.ts`), asi que el filtro se aplica a
 * mano aca. Nunca puede haber mas de uno (indice unico parcial, ver
 * migracion `add_cash_movement_change_unique_index`).
 */
export function findActiveChangeMovement(saleId: string, db: DbClient = prisma) {
  return db.cashMovement.findFirst({
    where: {
      referenceType: InventoryReferenceType.SALE,
      referenceId: saleId,
      type: CashMovementType.CHANGE,
      deletedAt: null,
    },
  });
}

/** Borrado logico de un `CashMovement` — mismo criterio ya usado en el
 * resto del proyecto (`deletedAt: new Date()`, nunca un DELETE fisico). */
export function softDeleteCashMovement(id: string, db: DbClient = prisma) {
  return db.cashMovement.update({ where: { id }, data: { deletedAt: new Date() } });
}
