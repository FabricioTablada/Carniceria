/**
 * modules/processing/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos del modulo de Despiece (Bloque 2 del plan v3, corregido
 * tras la revision de mermas/costo/parentBatchId). Es infraestructura pura:
 * no valida datos de entrada y no contiene reglas de negocio (eso vive en
 * `service.ts`). Usa unicamente la instancia singleton de Prisma expuesta en
 * `@/database`, salvo cuando participa de la transaccion abierta por
 * `service.ts::complete` (parametro `db` opcional, mismo criterio que
 * `batches/repository.ts`/`inventoryWaste/repository.ts`).
 *
 * `findProductById`/`findSucursalById`/`findUserById` leen directamente las
 * tablas `Product`/`Sucursal`/`User` -- mismo criterio ya usado en
 * `inventoryWaste/repository.ts`: cada modulo consulta lo que necesita para
 * validar, sin cruzar la frontera de otro modulo importando su
 * `service.ts`/`controller.ts`.
 *
 * `createWasteRecord` crea el `InventoryWaste` documental de cada linea de
 * merma (razon de la linea) SIN llamar a `recordMovement` -- ver la
 * justificacion completa en `service.ts::complete` (el descuento de stock ya
 * quedo completo con el movimiento `PROCESSING_OUT` del canal de entrada;
 * volver a descontar aca duplicaria la perdida). Mismo principio de
 * documentacion-sin-movimiento ya aplicado por
 * `inventoryWaste/service.ts::createWasteFromReturn` para su propio caso.
 *
 * `linkOutputBatchParent` (correccion aprobada: se evito modificar
 * `batches/types.ts`/`batches/service.ts`) escribe `Batch.parentBatchId`
 * directamente via el cliente Prisma compartido, DENTRO de la misma
 * transaccion de `complete()` -- ese campo no tiene ninguna regla de negocio
 * asociada en el modulo `batches` (no dispara ninguna transicion de estado,
 * no participa del invariante `SUM(availableQuantity) = Inventory.quantity`),
 * asi que escribirlo directamente aca no requiere conocer ni duplicar logica
 * de ese modulo -- mismo criterio que `createWasteRecord` de arriba.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { ListProcessingOperationsFilters } from './types';

const processingOutputItemInclude = {
  outputProduct: {
    select: { id: true, name: true, sku: true, unitOfMeasure: true },
  },
} satisfies Prisma.ProcessingOutputItemInclude;

const processingOperationWithRelationsInclude = {
  sucursal: { select: { id: true, code: true, name: true } },
  user: { select: { id: true, fullName: true } },
  inputProduct: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
  outputItems: {
    include: processingOutputItemInclude,
    orderBy: { createdAt: 'asc' },
  },
  wasteLines: {
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProcessingOperationInclude;

/** Busca el producto por su ID, para validar su existencia y leer sus
 * campos de negocio (`requiresBatch`, `cost`, `salePrice`) antes de crear o
 * modificar una operacion. */
export function findProductById(id: string, db: DbClient = prisma) {
  return db.product.findFirst({ where: { id } });
}

/** Busca la sucursal por su ID, para validar su existencia antes de crear
 * una operacion. */
export function findSucursalById(id: string, db: DbClient = prisma) {
  return db.sucursal.findFirst({ where: { id } });
}

/** Busca el usuario por su ID, para validar su existencia antes de crear
 * una operacion. */
export function findUserById(id: string, db: DbClient = prisma) {
  return db.user.findFirst({ where: { id } });
}

/** Crea una operacion de despiece en estado `DRAFT`. */
export function create(
  data: Prisma.ProcessingOperationUncheckedCreateInput,
  db: DbClient = prisma,
) {
  return db.processingOperation.create({
    data,
    include: processingOperationWithRelationsInclude,
  });
}

/** Busca una operacion por su ID, con todas sus lineas de salida y de
 * merma. Acepta un `DbClient` opcional para releerla DENTRO de la
 * transaccion de `service.ts::complete`. */
export function findById(id: string, db: DbClient = prisma) {
  return db.processingOperation.findFirst({
    where: { id },
    include: processingOperationWithRelationsInclude,
  });
}

/** Actualiza campos de cabecera de una operacion (`notes`, o `status`/
 * `completedAt` al completar/cancelar). Nunca escribe `inputQuantity`/
 * `inputUnitCost`/`inputProductId`/`inputBatchId` (snapshots fijados una
 * unica vez al crear, mismo criterio que `Batch`). */
export function update(
  id: string,
  data: Prisma.ProcessingOperationUncheckedUpdateInput,
  db: DbClient = prisma,
) {
  return db.processingOperation.update({
    where: { id },
    data,
    include: processingOperationWithRelationsInclude,
  });
}

function buildWhere(
  filters?: ListProcessingOperationsFilters,
): Prisma.ProcessingOperationWhereInput {
  return {
    ...(filters?.sucursalId && { sucursalId: filters.sucursalId }),
    ...(filters?.inputProductId && { inputProductId: filters.inputProductId }),
    ...(filters?.status && { status: filters.status }),
  };
}

export function findMany(params: {
  skip: number;
  take: number;
  filters?: ListProcessingOperationsFilters;
}) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.processingOperation.findMany({
      where,
      include: processingOperationWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.processingOperation.count({ where }),
  ]);
}

/** Genera el siguiente codigo de operacion (`DESP-000001`, `DESP-000002`,
 * ...), reutilizando `DocumentSequence` -- mismo mecanismo ya usado por
 * Lotes (`batches/repository.ts::incrementBatchCodeSequence`) y Ventas. */
export async function incrementProcessingCodeSequence(db: DbClient = prisma) {
  const sequence = await db.documentSequence.upsert({
    where: { name: 'PROCESSING' },
    update: { value: { increment: 1 } },
    create: { name: 'PROCESSING', value: 1 },
  });

  return sequence.value;
}

/** Agrega una linea de salida (corte/subproducto) a una operacion `DRAFT`. */
export function createOutputItem(
  data: Prisma.ProcessingOutputItemUncheckedCreateInput,
  db: DbClient = prisma,
) {
  return db.processingOutputItem.create({
    data,
    include: processingOutputItemInclude,
  });
}

/** Busca una linea de salida por su ID, validando que pertenezca a la
 * operacion indicada (`processingOperationId`) -- mismo criterio de
 * pertenencia ya usado en otros modulos con lineas de detalle. */
export function findOutputItemById(
  id: string,
  processingOperationId: string,
  db: DbClient = prisma,
) {
  return db.processingOutputItem.findFirst({
    where: { id, processingOperationId },
    include: processingOutputItemInclude,
  });
}

/** Actualiza la cantidad (y, al completar, el costo asignado / lote de
 * salida) de una linea de salida existente. */
export function updateOutputItem(
  id: string,
  data: Prisma.ProcessingOutputItemUncheckedUpdateInput,
  db: DbClient = prisma,
) {
  return db.processingOutputItem.update({
    where: { id },
    data,
    include: processingOutputItemInclude,
  });
}

/** Elimina una linea de salida (solo permitido mientras la operacion sigue
 * `DRAFT` -- validado en `service.ts`). */
export function deleteOutputItem(id: string, db: DbClient = prisma) {
  return db.processingOutputItem.delete({ where: { id } });
}

/** Agrega una linea de merma a una operacion `DRAFT`. */
export function createWasteItem(
  data: Prisma.ProcessingWasteItemUncheckedCreateInput,
  db: DbClient = prisma,
) {
  return db.processingWasteItem.create({ data });
}

/** Busca una linea de merma por su ID, validando que pertenezca a la
 * operacion indicada -- mismo criterio de pertenencia que
 * `findOutputItemById`. */
export function findWasteItemById(
  id: string,
  processingOperationId: string,
  db: DbClient = prisma,
) {
  return db.processingWasteItem.findFirst({ where: { id, processingOperationId } });
}

/** Actualiza cantidad/motivo/notas de una linea de merma existente. */
export function updateWasteItem(
  id: string,
  data: Prisma.ProcessingWasteItemUncheckedUpdateInput,
  db: DbClient = prisma,
) {
  return db.processingWasteItem.update({ where: { id }, data });
}

/** Elimina una linea de merma (solo permitido mientras la operacion sigue
 * `DRAFT` -- validado en `service.ts`). */
export function deleteWasteItem(id: string, db: DbClient = prisma) {
  return db.processingWasteItem.delete({ where: { id } });
}

/**
 * Crea el registro documental de UNA linea de merma completada (razon de la
 * linea, `processingOperationId` presente). Ver nota de archivo: NO llama a
 * `recordMovement` -- el descuento de stock del canal completo (incluyendo
 * la porcion que se pierde como merma) ya ocurrio con el movimiento
 * `PROCESSING_OUT` que consume `inputQuantity`.
 */
export function createWasteRecord(
  data: Prisma.InventoryWasteUncheckedCreateInput,
  db: DbClient = prisma,
) {
  return db.inventoryWaste.create({ data });
}

/** Ver nota de archivo, "linkOutputBatchParent": fija el linaje de un lote
 * de salida recien creado, sin pasar por `batches/service.ts`. */
export function linkOutputBatchParent(
  batchId: string,
  parentBatchId: string | null,
  db: DbClient,
) {
  return db.batch.update({
    where: { id: batchId },
    data: { parentBatchId },
    select: { id: true },
  });
}
