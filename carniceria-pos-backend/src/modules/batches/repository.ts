/**
 * modules/batches/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de Lotes (Bloque LOTES-01).
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `service.ts`). Usa unicamente
 * la instancia singleton de Prisma expuesta en `@/database`.
 *
 * Este archivo es el UNICO dueno del acceso a la tabla `Batch` en todo el
 * proyecto. `create`, `findByPurchaseItemId`, `update`,
 * `incrementAvailableQuantity` e `incrementBatchCodeSequence` aceptan un
 * cliente `DbClient` opcional (por defecto el singleton `prisma`) por el
 * mismo motivo que `inventory/repository.ts`: `shared/services/
 * inventoryMovement.service.ts` las invocara dentro de su propia
 * transaccion (LOTES-02/03 son quienes empiezan a hacerlo).
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. `Batch` NO se registra en `SOFT_DELETE_MODELS`
 * (mismo criterio que `Purchase`/`Inventory`: es un documento transaccional,
 * no un catalogo) -- `findFirst` se usa igual, por consistencia con el resto
 * de repositorios de este dominio.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { ListBatchFilters } from './types';

/** Incluye los resumenes de producto, sucursal y proveedor asociados al lote. */
const batchWithRelationsInclude = {
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      unitOfMeasure: true,
    },
  },
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
} as const;

export function create(data: Prisma.BatchUncheckedCreateInput, db: DbClient = prisma) {
  return db.batch.create({
    data,
    include: batchWithRelationsInclude,
  });
}

export function findById(id: string, db: DbClient = prisma) {
  return db.batch.findFirst({
    where: { id },
    include: batchWithRelationsInclude,
  });
}

/** Busca el lote ya creado para una linea de compra puntual -- mecanismo de
 * idempotencia de la creacion automatica (LOTES-02, ver `Batch.purchaseItemId
 * @unique` en `schema.prisma` y `service.ts::create`): antes de crear, el
 * servicio verifica que no exista ya uno para esa linea, y si existe lo
 * devuelve tal cual -- por eso incluye las mismas relaciones que `findById`,
 * para poder mapearse a `BatchResponse` sin una segunda consulta. */
export function findByPurchaseItemId(purchaseItemId: string, db: DbClient = prisma) {
  return db.batch.findFirst({
    where: { purchaseItemId },
    include: batchWithRelationsInclude,
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListBatchFilters): Prisma.BatchWhereInput {
  if (!filters) return {};

  return {
    productId: filters.productId,
    sucursalId: filters.sucursalId,
    supplierId: filters.supplierId,
    status: filters.status,
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListBatchFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.batch.findMany({
      where,
      include: batchWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { receivedAt: 'desc' },
    }),
    prisma.batch.count({ where }),
  ]);
}

export function update(id: string, data: Prisma.BatchUncheckedUpdateInput, db: DbClient = prisma) {
  return db.batch.update({
    where: { id },
    data,
    include: batchWithRelationsInclude,
  });
}

/**
 * Incrementa `Batch.availableQuantity` de forma atomica
 * (`UPDATE ... SET available_quantity = available_quantity + delta`),
 * identificando el lote por su `id` -- mismo patron de proteccion contra
 * "lost update" que ya usa `inventory/repository.ts::updateQuantityByProductAndSucursal`.
 * Usado por `shared/services/inventoryMovement.service.ts` cuando un
 * movimiento incluye `batchId` (LOTES-02/03, sin llamadores todavia en este
 * bloque).
 */
export function incrementAvailableQuantity(
  id: string,
  delta: Prisma.Decimal | number,
  db: DbClient = prisma,
) {
  return db.batch.update({
    where: { id },
    data: { availableQuantity: { increment: delta } },
    select: { id: true, availableQuantity: true, status: true },
  });
}

/**
 * Bloque LOTES-03 (Modulo de Lotes, integracion con Ventas): lotes
 * disponibles para CONSUMIR de un producto/sucursal, en orden FEFO
 * (First-Expired-First-Out) -- vencimiento ascendente primero (los que no
 * tienen `expiryDate` van al final, por convencion se asumen de vida util
 * mas larga/indefinida), y a igualdad de vencimiento, `receivedAt`
 * ascendente (FIFO) como desempate. Solo devuelve lotes `ACTIVE` con
 * `availableQuantity > 0` -- los `DEPLETED`/`EXPIRED`/`BLOCKED` nunca
 * participan de una venta. Acepta `tx` para leer los saldos DENTRO de la
 * misma transaccion que luego los consume (mismo criterio que
 * `inventory/repository.ts::findManyByProductsAndSucursal`).
 */
export function findActiveForConsumption(
  productId: string,
  sucursalId: string,
  db: DbClient = prisma,
) {
  return db.batch.findMany({
    where: {
      productId,
      sucursalId,
      status: 'ACTIVE',
      availableQuantity: { gt: 0 },
    },
    select: { id: true, availableQuantity: true },
    orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
  });
}

/**
 * Bloque LOTES-05 (reglas oficiales de transicion de estados, ver
 * `batches/service.ts` para la politica completa): transiciona a
 * `EXPIRED` cualquier lote `ACTIVE` cuya `expiryDate` ya paso -- barrido
 * "lazy" (bajo demanda, en el momento en que algo relee lotes), no un job
 * programado. `expiryDate: { lt: new Date() }` excluye naturalmente los
 * lotes sin fecha de vencimiento (`NULL` nunca satisface `lt`), asi que un
 * lote sin `expiryDate` jamas expira automaticamente.
 *
 * `filters.id`/`filters.productId`/`filters.sucursalId` acotan el barrido
 * al alcance minimo necesario segun quien llama (una sola fila en
 * `findById`, un producto/sucursal puntual en el consumo FEFO de Ventas o
 * la validacion de una merma) -- sin filtros, el barrido es global (usado
 * por `findMany` cuando el listado no trae esos filtros), aceptable porque
 * la tabla esta indexada por `status` y el volumen esperado es bajo.
 */
export function expireOverdueBatches(
  filters: { id?: string; productId?: string; sucursalId?: string },
  db: DbClient = prisma,
) {
  return db.batch.updateMany({
    where: {
      status: 'ACTIVE',
      expiryDate: { lt: new Date() },
      ...(filters.id && { id: filters.id }),
      ...(filters.productId && { productId: filters.productId }),
      ...(filters.sucursalId && { sucursalId: filters.sucursalId }),
    },
    data: { status: 'EXPIRED', closedAt: new Date() },
  });
}

/**
 * Genera el siguiente codigo de lote (`LOT-000001`, `LOT-000002`, ...),
 * reutilizando `DocumentSequence` -- mismo mecanismo ya usado por Ventas
 * para `documentNumber` (`sales/repository.ts::incrementSaleDocumentSequence`).
 * A diferencia de Ventas, no hace falta calcular un "baseline" desde el
 * maximo `code` existente: `Batch` es una tabla nueva, sin codigos creados
 * antes de que existiera este generador.
 */
export async function incrementBatchCodeSequence(db: DbClient = prisma) {
  const sequence = await db.documentSequence.upsert({
    where: { name: 'BATCH' },
    update: { value: { increment: 1 } },
    create: { name: 'BATCH', value: 1 },
  });

  return sequence.value;
}
