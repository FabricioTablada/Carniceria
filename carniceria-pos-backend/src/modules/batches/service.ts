/**
 * modules/batches/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de Lotes (Bloque LOTES-01).
 *
 * Responsabilidades:
 *  - Validar existencia del lote antes de leer/actualizar.
 *  - Validar las reglas de negocio de creacion/ajuste (cantidades, fechas)
 *    antes de persistir.
 *  - Generar el codigo interno del lote (`LOT-000001`, ...) reutilizando
 *    `DocumentSequence`.
 *  - Traducir los registros de Prisma a la forma publica `BatchResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de `repository.ts`; este
 * servicio no ejecuta queries de Prisma directamente.
 *
 * `create()` HOY solo se invoca internamente -- no existe `POST /batches`
 * en este bloque (ver `routes.ts`). La creacion automatica de lotes desde
 * Compras (LOTES-02) construira un `CreateBatchDto` y llamara a esta misma
 * funcion DENTRO de su propia transaccion (parametro `db`), sin necesitar
 * ningun cambio de firma cuando eso ocurra.
 *
 * `update()` (`PATCH /batches/:id`), cuando el body incluye
 * `availableQuantity`, NUNCA escribe esa columna directamente: la diferencia
 * con signo se registra via `recordMovement()` (`type: ADJUSTMENT`,
 * `batchId` presente) -- el MISMO mecanismo unico y atomico que sincroniza
 * `Inventory.quantity` y `Batch.availableQuantity` juntos (ver
 * `shared/services/inventoryMovement.service.ts`). Esto es lo que mantiene
 * el invariante correcto tambien para el ajuste manual, no solo para
 * Compras/Ventas -- si este servicio escribiera `availableQuantity` por su
 * cuenta (como hace `status`/`notes`, que no afectan el invariante),
 * quedaria desincronizado de `Inventory.quantity` sin que nada lo notara.
 *
 * INVARIANTE (corregido en el Bloque LOTES-05, ver la nota de
 * `expireOverdueBatches()`/la politica de estados mas abajo): la formula
 * EXACTA es `SUM(Batch.availableQuantity WHERE status != DEPLETED) =
 * Inventory.quantity` -- NO "solo ACTIVA", como se documento hasta el
 * Bloque LOTES-04 (entonces era equivalente, porque nada transicionaba un
 * lote a `EXPIRED`/`BLOCKED` con saldo aun positivo). Desde que este
 * bloque introduce la transicion automatica `ACTIVE -> EXPIRED` sobre
 * lotes con saldo SIN CONSUMIR, un lote `EXPIRED` (o `BLOCKED`, bloqueado
 * manualmente) sigue representando existencia FISICA real en la sucursal
 * -- todavia no se derramo el asiento de merma que la retire -- por lo que
 * su `availableQuantity` DEBE seguir sumando al total. Solo `DEPLETED`
 * significa "sin existencia real" (por construccion, un lote solo llega a
 * `DEPLETED` cuando su saldo YA es 0).
 */
import { InventoryMovementType, Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { transactionConfig } from '@/config';
import { NotFoundError, ValidationError } from '@/shared/errors';
import { InventoryReferenceType } from '@/shared/constants';
import { recordMovement } from '@/shared/services/inventoryMovement.service';
import * as batchesRepository from './repository';
import type {
  BatchResponse,
  CreateBatchDto,
  ListBatchQuery,
  ListBatchResult,
  UpdateBatchDto,
} from './types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type BatchRecord = {
  id: string;
  code: string;
  supplierLotCode: string | null;
  productId: string;
  sucursalId: string;
  purchaseItemId: string | null;
  supplierId: string | null;
  receivedAt: Date;
  productionDate: Date | null;
  expiryDate: Date | null;
  initialQuantity: Prisma.Decimal;
  availableQuantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  expectedWastePercent: Prisma.Decimal | null;
  status: string;
  closedAt: Date | null;
  notes: string | null;
  product: { id: string; name: string; sku: string | null; unitOfMeasure: string };
  sucursal: { id: string; code: string; name: string };
  supplier: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica del lote. */
function toBatchResponse(batch: BatchRecord): BatchResponse {
  return {
    id: batch.id,
    code: batch.code,
    supplierLotCode: batch.supplierLotCode,
    productId: batch.productId,
    sucursalId: batch.sucursalId,
    purchaseItemId: batch.purchaseItemId,
    supplierId: batch.supplierId,
    receivedAt: batch.receivedAt,
    productionDate: batch.productionDate,
    expiryDate: batch.expiryDate,
    initialQuantity: Number(batch.initialQuantity),
    availableQuantity: Number(batch.availableQuantity),
    unitCost: Number(batch.unitCost),
    expectedWastePercent:
      batch.expectedWastePercent !== null ? Number(batch.expectedWastePercent) : null,
    status: batch.status as BatchResponse['status'],
    closedAt: batch.closedAt,
    notes: batch.notes,
    product: {
      id: batch.product.id,
      name: batch.product.name,
      sku: batch.product.sku,
      unitOfMeasure: batch.product.unitOfMeasure as BatchResponse['product']['unitOfMeasure'],
    },
    sucursal: batch.sucursal,
    supplier: batch.supplier,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

/**
 * Bloque LOTES-05 -- POLITICA OFICIAL de transicion de estados de un lote
 * (`BatchStatus`: `ACTIVE`/`DEPLETED`/`EXPIRED`/`BLOCKED`). Documentada aca
 * porque este archivo es el unico dueno de la logica de negocio del
 * modulo; `repository.ts` solo ejecuta las escrituras que esta politica
 * ordena.
 *
 *  1. `ACTIVE -> DEPLETED` (automatico): cuando `availableQuantity` llega
 *     a 0 por CUALQUIER movimiento que pase por `recordMovement()`
 *     (Ventas, Mermas, ajuste manual) -- ver `applyBatchMovement()` en
 *     `shared/services/inventoryMovement.service.ts`. Solo dispara si el
 *     estado ANTERIOR era `ACTIVE`: un lote `EXPIRED`/`BLOCKED` que llega a
 *     0 (ej. se termina de mermar/ajustar) mantiene su estado -- ese estado
 *     ya explica POR QUE se dejo de vender, y "DEPLETED" borraria esa razon.
 *  2. `ACTIVE -> EXPIRED` (automatico, barrido "lazy"): cuando
 *     `expiryDate` ya paso. Sin job programado (no existe infraestructura
 *     de jobs recurrentes de negocio en este proyecto, solo respaldo/
 *     sincronizacion en `src/jobs/`, ver `expireOverdueBatches()` abajo) --
 *     se barre bajo demanda, DENTRO de la transaccion correspondiente,
 *     cada vez que algo relee lotes para una decision que importa
 *     (`findById`/`findMany` de este modulo, el consumo FEFO de Ventas via
 *     `findActiveForConsumption`, la validacion de una merma contra un
 *     `batchId` puntual). Esto garantiza que NUNCA se venda ni se muestre
 *     como `ACTIVE` un lote vencido, sin necesitar un proceso en segundo
 *     plano.
 *  3. `BLOCKED` y cualquier reversion manual (`EXPIRED -> ACTIVE`,
 *     `BLOCKED -> ACTIVE`, etc.): EXCLUSIVAMENTE manual, via
 *     `PATCH /batches/:id` (`update()`, mas abajo) -- ningun mecanismo
 *     automatico bloquea ni reactiva un lote.
 *  4. Los tres estados terminales (`DEPLETED`/`EXPIRED`/`BLOCKED`) nunca
 *     son revertidos por un movimiento de inventario -- solo por un
 *     `PATCH` explicito con `status` en el body.
 *  5. EXCEPCION puntual a la regla 4 (Bloque "Eliminación de Mermas",
 *     aprobada explícitamente): cuando se ELIMINA una merma que había
 *     dejado un lote en `DEPLETED`, y la reversión de esa merma repone
 *     saldo positivo, el lote vuelve a `ACTIVE` automáticamente -- ver
 *     `reopenIfRestocked()` mas abajo, invocada EXCLUSIVAMENTE desde
 *     `inventoryWaste/service.ts::deleteWaste` (ADMIN unicamente, ver
 *     `authorize(SystemRole.ADMIN)` en `inventoryWaste/routes.ts`). Se
 *     justifica como excepcion (no como cambio de la regla 4) porque
 *     eliminar una merma es una correccion administrativa explicita de un
 *     error de captura, no un movimiento de inventario generico como una
 *     venta o un ajuste normal -- los unicos casos que la regla 4 protege.
 *     Ningun otro flujo (Ventas, Compras, Ajustes, alta de Mermas) gana
 *     esta reapertura automatica: `applyBatchMovement()`
 *     (`shared/services/inventoryMovement.service.ts`) sigue intacta, solo
 *     cierra, nunca reabre.
 */
export async function findById(id: string, db: DbClient = prisma): Promise<BatchResponse> {
  await batchesRepository.expireOverdueBatches({ id }, db);

  const batch = await batchesRepository.findById(id, db);

  if (!batch) {
    throw new NotFoundError('Lote');
  }

  return toBatchResponse(batch);
}

/**
 * QA.4 (Compras, "Cancelación de compras recibidas"): busca el lote que
 * generó una línea de compra puntual (`Batch.purchaseItemId`, único),
 * para que `purchases/service.ts` pueda revertir su `availableQuantity` al
 * cancelar una compra ya `RECEIVED` -- mismo criterio de exportación
 * exclusiva para un único consumidor externo ya usado por
 * `reopenBatchIfRestockedService` (`inventoryWaste/service.ts::deleteWaste`).
 * `null` si esa línea nunca generó un lote (producto sin `requiresBatch`) --
 * a diferencia de `findById`, no lanza `NotFoundError`: la ausencia de
 * lote es un caso normal aquí, no un error.
 */
export async function findByPurchaseItemId(
  purchaseItemId: string,
  db: DbClient = prisma,
): Promise<BatchResponse | null> {
  const batch = await batchesRepository.findByPurchaseItemId(purchaseItemId, db);

  return batch ? toBatchResponse(batch) : null;
}

export async function findMany(query: ListBatchQuery): Promise<ListBatchResult> {
  // Regla 2 de la politica de arriba: barre lotes vencidos ANTES de leer el
  // listado, acotado a los mismos filtros de producto/sucursal que ya trae
  // la consulta (sin ellos, el barrido es global) -- asi el listado nunca
  // muestra `ACTIVE` un lote cuya fecha ya paso.
  await batchesRepository.expireOverdueBatches({
    productId: query.filters?.productId,
    sucursalId: query.filters?.sucursalId,
  });

  const [items, total] = await batchesRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toBatchResponse(item)),
    total,
  };
}

/**
 * Bloque LOTES-03: wrapper del modulo para
 * `batchesRepository.findActiveForConsumption` -- expuesto via `index.ts`
 * para que `sales/service.ts` pueda consultarlo respetando la convencion de
 * limites de modulo (solo se importa el barrel `batches/index.ts`, nunca
 * `batches/repository.ts` directamente). Devuelve los campos minimos que
 * necesita la asignacion FEFO (id y saldo disponible como `number`); no usa
 * `toBatchResponse` porque no trae las relaciones (`product`/`sucursal`/
 * `supplier`) que esa funcion requiere.
 *
 * Bloque LOTES-05: barre lotes vencidos de ESTE producto/sucursal (regla 2
 * de la politica de arriba) DENTRO de la misma transaccion (`db`, el `tx`
 * de la venta que esta consumiendo) antes de leer los activos -- garantiza
 * que Ventas jamas asigne FEFO contra un lote cuya fecha de vencimiento ya
 * paso, aunque nadie lo haya leido/barrido antes.
 */
export async function findActiveForConsumption(
  productId: string,
  sucursalId: string,
  db?: DbClient,
): Promise<{ id: string; availableQuantity: number }[]> {
  await batchesRepository.expireOverdueBatches({ productId, sucursalId }, db);

  const batches = await batchesRepository.findActiveForConsumption(productId, sucursalId, db);

  return batches.map((batch) => ({
    id: batch.id,
    availableQuantity: Number(batch.availableQuantity),
  }));
}

/**
 * Bloque LOTES-06 (reportes del Modulo de Lotes): wrapper publico de
 * `batchesRepository.expireOverdueBatches` (regla 2 de la politica de
 * arriba), expuesto via `index.ts` para que `reports/reports.service.ts`
 * pueda barrer los lotes vencidos de ESTE modulo ANTES de correr sus
 * propias consultas agregadas (`prisma.batch.groupBy`, etc.) -- mismo
 * criterio que ya aplican `findById`/`findMany`/`findActiveForConsumption`
 * de este archivo, extendido a un lector externo. Reports NUNCA reimplementa
 * la logica de la transicion (eso violaria "no duplicar logica de negocio");
 * solo invoca esta funcion antes de leer, exactamente como hace este mismo
 * modulo consigo mismo.
 */
export async function expireOverdueBatches(
  filters: { productId?: string; sucursalId?: string } = {},
  db: DbClient = prisma,
): Promise<void> {
  await batchesRepository.expireOverdueBatches(filters, db);
}

/**
 * Regla 5 de la política de arriba (Bloque "Eliminación de Mermas"):
 * reabre un lote `DEPLETED` a `ACTIVE` cuando su saldo disponible volvió a
 * ser positivo -- EXCLUSIVAMENTE para la reversión de una merma eliminada
 * (`inventoryWaste/service.ts::deleteWaste`). No hace nada si el lote no
 * está `DEPLETED` o si su saldo sigue en 0 (`recordMovement` ya habría
 * dejado cualquier otro estado -- `EXPIRED`/`BLOCKED` -- intacto, mismo
 * criterio que la regla 1: esos estados nunca se tocan automáticamente).
 *
 * Debe llamarse DESPUÉS de que `recordMovement` ya aplicó el incremento
 * sobre `Batch.availableQuantity` (mismo `tx`) -- lee el saldo YA
 * actualizado, nunca el previo a la reversión.
 */
export async function reopenIfRestocked(batchId: string, db: DbClient): Promise<void> {
  const batch = await batchesRepository.findById(batchId, db);

  if (batch && batch.status === 'DEPLETED' && Number(batch.availableQuantity) > 0) {
    await batchesRepository.update(batchId, { status: 'ACTIVE', closedAt: null }, db);
  }
}

/**
 * Crea un lote. Ver nota de archivo: sin endpoint HTTP en este bloque --
 * `db` permite participar de la transaccion del llamador (Compras, LOTES-02).
 *
 * Bloque LOTES-02 (idempotencia): cuando `dto.purchaseItemId` viene
 * presente, esta funcion verifica PRIMERO si ya existe un lote para esa
 * linea de compra (`Batch.purchaseItemId @unique`, `schema.prisma`) y, si
 * existe, devuelve ESE lote tal cual en vez de intentar crear uno nuevo
 * (que fallaria con una violacion de unicidad en la base de datos). La
 * idempotencia vive aca -- dentro del modulo que es dueno del invariante
 * "a lo sumo un lote por linea de compra" -- para que cualquier llamador
 * (Compras, LOTES-02, o un futuro `POST /batches` manual) la obtenga
 * gratis, sin tener que reimplementarla.
 */
export async function create(dto: CreateBatchDto, db: DbClient = prisma): Promise<BatchResponse> {
  if (dto.purchaseItemId) {
    const existingBatch = await batchesRepository.findByPurchaseItemId(dto.purchaseItemId, db);

    if (existingBatch) {
      return toBatchResponse(existingBatch);
    }
  }

  if (dto.initialQuantity <= 0) {
    throw new ValidationError('La cantidad inicial del lote debe ser mayor a 0.');
  }

  if (dto.expiryDate && dto.expiryDate < dto.receivedAt) {
    throw new ValidationError(
      'La fecha de vencimiento no puede ser anterior a la fecha de ingreso.',
    );
  }

  if (dto.productionDate && dto.productionDate > dto.receivedAt) {
    throw new ValidationError(
      'La fecha de producción no puede ser posterior a la fecha de ingreso.',
    );
  }

  const sequenceValue = await batchesRepository.incrementBatchCodeSequence(db);
  const code = `LOT-${String(sequenceValue).padStart(6, '0')}`;

  const created = await batchesRepository.create(
    {
      code,
      supplierLotCode: dto.supplierLotCode ?? null,
      productId: dto.productId,
      sucursalId: dto.sucursalId,
      purchaseItemId: dto.purchaseItemId ?? null,
      supplierId: dto.supplierId ?? null,
      receivedAt: dto.receivedAt,
      productionDate: dto.productionDate ?? null,
      expiryDate: dto.expiryDate ?? null,
      initialQuantity: dto.initialQuantity,
      availableQuantity: dto.initialQuantity,
      unitCost: dto.unitCost,
      expectedWastePercent: dto.expectedWastePercent ?? null,
      notes: dto.notes ?? null,
    },
    db,
  );

  return toBatchResponse(created);
}

/**
 * Ajusta un lote existente (`PATCH /batches/:id`): cantidad disponible y/o
 * estado (bloqueo/cierre manual), nunca los campos de origen/snapshot.
 * `userId` (quien hizo el ajuste) es obligatorio solo cuando el body
 * incluye `availableQuantity` -- un ajuste que solo cambia `status`/`notes`
 * no genera ningun movimiento de inventario, asi que no lo necesita.
 */
export async function update(
  id: string,
  dto: UpdateBatchDto,
  userId?: string,
): Promise<BatchResponse> {
  // Bloque LOTES-07 (QA integral): reutiliza el `findById` de ESTE mismo
  // archivo -- no `batchesRepository.findById` directo -- para que el
  // barrido de vencimiento (regla 2 de la politica de estados) tambien
  // corra aca. Defecto real detectado en la auditoria: `update()` leia el
  // repositorio sin pasar por el barrido, asi que un `PATCH` sobre un lote
  // ya vencido (pero que nadie habia releido desde `GET /batches`/Ventas)
  // no actualizaba su `status` a `EXPIRED` antes de aplicar el ajuste --
  // el usuario podia terminar ajustando la cantidad de un lote que la API
  // seguia mostrando como `ACTIVE` sin serlo realmente. De paso, elimina
  // la validacion `NotFoundError` duplicada: `findById` ya la lanza.
  const existing = await findById(id);

  if (dto.availableQuantity === undefined) {
    const updated = await batchesRepository.update(id, {
      status: dto.status,
      notes: dto.notes,
    });

    return toBatchResponse(updated);
  }

  if (dto.availableQuantity < 0) {
    throw new ValidationError('La cantidad disponible no puede ser negativa.');
  }

  if (dto.availableQuantity > Number(existing.initialQuantity)) {
    throw new ValidationError(
      'La cantidad disponible no puede superar la cantidad inicial del lote.',
    );
  }

  if (!userId) {
    throw new ValidationError('Se requiere el usuario que realiza el ajuste.');
  }

  const quantityDiff = dto.availableQuantity - Number(existing.availableQuantity);

  const updated = await prisma.$transaction(async (tx) => {
    if (quantityDiff !== 0) {
      // `recordMovement` sincroniza `Inventory.quantity` Y
      // `Batch.availableQuantity` de forma atomica (ver comentario de
      // archivo) -- este servicio nunca vuelve a escribir
      // `availableQuantity` por su cuenta.
      await recordMovement({
        tx,
        sucursalId: existing.sucursalId,
        productId: existing.productId,
        userId,
        type: InventoryMovementType.ADJUSTMENT,
        quantity: quantityDiff,
        referenceType: InventoryReferenceType.BATCH_ADJUSTMENT,
        referenceId: id,
        batchId: id,
        reason: 'Ajuste manual de lote',
      });
    }

    // El resto de los campos (status/notes) se actualiza aparte:
    // `recordMovement` solo toca `availableQuantity`. Esta llamada tambien
    // relee el registro completo (con relaciones) para la respuesta, haya
    // habido o no cambio de cantidad. Si `recordMovement` ya cerro el lote
    // (`DEPLETED`, cantidad llegando a 0) y el body ademas pide otro
    // `status`, el `status` explicito del body es el que prevalece (se
    // aplica DESPUES, en esta misma linea).
    return batchesRepository.update(
      id,
      {
        status: dto.status,
        notes: dto.notes,
      },
      tx,
    );
  }, transactionConfig.standard);

  return toBatchResponse(updated);
}
