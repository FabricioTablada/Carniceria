/**
 * modules/processing/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de Despiece (Bloque 2 del plan v3, corregido
 * tras la revision de mermas/costo/parentBatchId).
 *
 * Responsabilidades:
 *  - Crear una operacion en `DRAFT` (producto/lote/cantidad de entrada),
 *    validando existencia y la regla "lote obligatorio cuando
 *    `Product.requiresBatch`" (plan v3, correccion 1).
 *  - Administrar las lineas de salida (cortes/subproductos) Y las lineas de
 *    merma mientras la operacion sigue `DRAFT`: agregar, editar, eliminar
 *    ambos tipos de linea.
 *  - Completar la operacion de forma ATOMICA (`complete()`): validar el
 *    balance de peso EXACTO (`inputQuantity === SUM(outputItems) +
 *    SUM(wasteLines)`), validar stock disponible del producto/lote de
 *    entrada, consumir ese stock (`PROCESSING_OUT`), crear un `Batch` nuevo
 *    por cada linea de salida con linaje (`parentBatchId`, asignado
 *    directamente via Prisma -- ver `repository.ts::linkOutputBatchParent`)
 *    y acreditar su stock (`PROCESSING_IN`), distribuir el costo total del
 *    canal entre las salidas por el metodo de valor relativo de venta, y
 *    materializar cada linea de merma como su propia `InventoryWaste` --
 *    todo dentro de una unica transaccion Prisma.
 *  - Una vez `COMPLETED`, la operacion es INMUTABLE: ninguna funcion de este
 *    archivo permite modificarla.
 *  - `CANCELLED` nunca toca inventario: cancelar una operacion `DRAFT` solo
 *    cambia su `status`, sin `recordMovement` ni `InventoryWaste` de por
 *    medio -- nada se habia descontado todavia.
 *
 * Toda consulta a la base de datos se hace a traves de `repository.ts`; este
 * servicio no ejecuta queries de Prisma directamente (excepto abrir la
 * transaccion de `complete()`, mismo criterio que `batches/service.ts::update`/
 * `inventoryWaste/service.ts::createWaste`).
 *
 * Reutiliza, sin duplicar logica de negocio: `recordMovement` (stock),
 * `reserveIfSufficient` (validacion atomica de stock disponible, mismo
 * patron que Ventas/Mermas), `createBatchService`/`findByIdBatchService`
 * (`@/modules/batches`, barrel -- nunca su repositorio directo, y sin
 * extender su DTO -- ver `repository.ts::linkOutputBatchParent`) para crear
 * los lotes de salida y leer/validar el lote de entrada.
 *
 * REGLA DE COSTEO (correccion aprobada post-Bloque-2): una salida individual
 * puede tener `salePriceSnapshot = 0` (un subproducto sin precio de venta
 * definido todavia puede existir e ingresar a inventario) -- esa linea
 * simplemente no aporta valor a la base de prorrateo y recibe
 * `allocatedCost = 0`, sin bloquear la operacion (metodo de valor neto
 * realizable estandar: un subproducto sin valor de mercado conocido se
 * recibe a costo $0). Solo se bloquea con `ValidationError` el caso
 * degenerado en que TODAS las salidas tienen precio 0 -- ahi no existe
 * ninguna base no arbitraria para prorratear el costo del canal. NO se
 * implementa ningun fallback por peso u otro metodo alternativo.
 */
import { InventoryMovementType, Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { transactionConfig } from '@/config';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import { InventoryReferenceType } from '@/shared/constants';
import { toMoney, addMoney, multiplyMoney, roundMoney, type Money } from '@/shared/utils/money';
import { recordMovement } from '@/shared/services/inventoryMovement.service';
import * as inventoryRepository from '@/modules/inventory/repository';
import { createBatchService, findByIdBatchService } from '@/modules/batches';
import * as processingRepository from './repository';
import type {
  AddProcessingOutputItemDto,
  AddProcessingWasteItemDto,
  CreateProcessingOperationDto,
  ListProcessingOperationsQuery,
  ListProcessingOperationsResult,
  ProcessingOperationResponse,
  ProcessingOutputItemResponse,
  ProcessingWasteItemResponse,
  UpdateProcessingOperationDto,
  UpdateProcessingOutputItemDto,
  UpdateProcessingWasteItemDto,
} from './types';

/** Forma minima del registro de Prisma (con relaciones) para poder mapearlo. */
type ProcessingOutputItemRecord = {
  id: string;
  processingOperationId: string;
  outputProductId: string;
  quantity: Prisma.Decimal;
  salePriceSnapshot: Prisma.Decimal;
  allocatedCost: Prisma.Decimal | null;
  outputBatchId: string | null;
  outputProduct: { id: string; name: string; sku: string | null; unitOfMeasure: string };
  createdAt: Date;
  updatedAt: Date;
};

/** Forma minima del registro de Prisma de una linea de merma. */
type ProcessingWasteItemRecord = {
  id: string;
  processingOperationId: string;
  reason: string;
  quantity: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProcessingOperationRecord = {
  id: string;
  code: string;
  sucursalId: string;
  userId: string;
  inputProductId: string;
  inputBatchId: string | null;
  inputQuantity: Prisma.Decimal;
  inputUnitCost: Prisma.Decimal;
  status: string;
  completedAt: Date | null;
  notes: string | null;
  sucursal: { id: string; code: string; name: string };
  user: { id: string; fullName: string };
  inputProduct: { id: string; name: string; sku: string | null; unitOfMeasure: string };
  outputItems: ProcessingOutputItemRecord[];
  wasteLines: ProcessingWasteItemRecord[];
  createdAt: Date;
  updatedAt: Date;
};

function toOutputItemResponse(item: ProcessingOutputItemRecord): ProcessingOutputItemResponse {
  return {
    id: item.id,
    processingOperationId: item.processingOperationId,
    outputProductId: item.outputProductId,
    outputProduct: {
      id: item.outputProduct.id,
      name: item.outputProduct.name,
      sku: item.outputProduct.sku,
      unitOfMeasure: item.outputProduct.unitOfMeasure as ProcessingOutputItemResponse['outputProduct']['unitOfMeasure'],
    },
    quantity: Number(item.quantity),
    salePriceSnapshot: Number(item.salePriceSnapshot),
    allocatedCost: item.allocatedCost !== null ? Number(item.allocatedCost) : null,
    outputBatchId: item.outputBatchId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function toWasteItemResponse(item: ProcessingWasteItemRecord): ProcessingWasteItemResponse {
  return {
    id: item.id,
    processingOperationId: item.processingOperationId,
    reason: item.reason as ProcessingWasteItemResponse['reason'],
    quantity: Number(item.quantity),
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function toOperationResponse(operation: ProcessingOperationRecord): ProcessingOperationResponse {
  const outputItems = operation.outputItems.map(toOutputItemResponse);
  const wasteLines = operation.wasteLines.map(toWasteItemResponse);
  const totalOutputQuantity = outputItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalWasteQuantity = wasteLines.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: operation.id,
    code: operation.code,
    sucursalId: operation.sucursalId,
    sucursal: operation.sucursal,
    userId: operation.userId,
    user: operation.user,
    inputProductId: operation.inputProductId,
    inputProduct: {
      id: operation.inputProduct.id,
      name: operation.inputProduct.name,
      sku: operation.inputProduct.sku,
      unitOfMeasure: operation.inputProduct.unitOfMeasure as ProcessingOperationResponse['inputProduct']['unitOfMeasure'],
    },
    inputBatchId: operation.inputBatchId,
    inputQuantity: Number(operation.inputQuantity),
    inputUnitCost: Number(operation.inputUnitCost),
    status: operation.status as ProcessingOperationResponse['status'],
    completedAt: operation.completedAt,
    notes: operation.notes,
    outputItems,
    wasteLines,
    // Ver nota de `types.ts`: debe ser exactamente 0 para poder completar.
    balanceRemaining: Number(operation.inputQuantity) - totalOutputQuantity - totalWasteQuantity,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
  };
}

/** Asegura que la operacion exista y este `DRAFT` -- guard reutilizado por
 * toda mutacion previa a `complete()` (editar cabecera, agregar/editar/
 * eliminar lineas de salida o de merma). Una vez `COMPLETED`/`CANCELLED`, la
 * operacion es inmutable. */
async function findDraftOrThrow(id: string, db: DbClient = prisma): Promise<ProcessingOperationRecord> {
  const operation = await processingRepository.findById(id, db);

  if (!operation) {
    throw new NotFoundError('Operación de despiece');
  }

  if (operation.status !== 'DRAFT') {
    throw new ConflictError(
      'Esta operación de despiece ya no está en borrador y no puede modificarse.',
    );
  }

  return operation;
}

/** Suma de todas las lineas (salida + merma) de la operacion, EXCLUYENDO
 * opcionalmente una linea puntual (para revalidar una edicion sin contar la
 * version vieja de la propia linea dos veces). Base compartida de la
 * validacion de balance para altas/ediciones de cualquiera de los dos tipos
 * de linea.
 *
 * Suma con `Prisma.Decimal` (no `number`) -- mismo motivo que la validacion
 * final de `complete()`: los valores provienen de columnas `Decimal(12,3)`,
 * y sumarlos como `number` binario puede introducir imprecision de punto
 * flotante incluso en esta comprobacion de limite superior durante la
 * edicion, no solo en la igualdad exacta final. */
function committedTotal(
  operation: ProcessingOperationRecord,
  exclude?: { outputItemId?: string; wasteItemId?: string },
): Money {
  const outputsTotal = operation.outputItems
    .filter((item) => item.id !== exclude?.outputItemId)
    .reduce((sum, item) => sum.add(item.quantity), toMoney(0));
  const wasteTotal = operation.wasteLines
    .filter((item) => item.id !== exclude?.wasteItemId)
    .reduce((sum, item) => sum.add(item.quantity), toMoney(0));

  return addMoney(outputsTotal, wasteTotal);
}

/** Valida que `committedTotal + candidateQuantity` no supere `inputQuantity`
 * -- deja lugar a que el resto del balance (salidas u otras mermas) siga
 * completándose hasta la igualdad exacta que `complete()` exige. */
function assertWithinInputQuantity(
  operation: ProcessingOperationRecord,
  candidateQuantity: number,
  exclude?: { outputItemId?: string; wasteItemId?: string },
): void {
  const total = addMoney(committedTotal(operation, exclude), toMoney(candidateQuantity));

  if (total.greaterThan(operation.inputQuantity)) {
    throw new ValidationError(
      'La suma de las líneas de salida y merma no puede superar la cantidad de entrada del despiece.',
    );
  }
}

export async function findById(id: string): Promise<ProcessingOperationResponse> {
  const operation = await processingRepository.findById(id);

  if (!operation) {
    throw new NotFoundError('Operación de despiece');
  }

  return toOperationResponse(operation);
}

export async function findMany(
  query: ListProcessingOperationsQuery,
): Promise<ListProcessingOperationsResult> {
  const [items, total] = await processingRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toOperationResponse(item)),
    total,
  };
}

/**
 * Crea una operacion de despiece en `DRAFT`. Validaciones (lecturas puras,
 * mismo criterio que `inventoryWaste/service.ts::createWaste`):
 *  - El producto de entrada, la sucursal y el usuario existen.
 *  - `inputQuantity` es mayor a 0.
 *  - Si `Product.requiresBatch` es `true`, `inputBatchId` es obligatorio
 *    (plan v3, correccion 1) y ese lote pertenece al mismo producto/
 *    sucursal. Si es `false`, `inputBatchId` debe omitirse (no tiene
 *    sentido asociar un lote a un producto que no los usa).
 *  - `inputUnitCost` se resuelve aca (nunca lo envia el cliente): el costo
 *    REAL del lote de entrada cuando se indico uno (`Batch.unitCost`,
 *    representa lo que realmente costo ESE canal), o el costo de
 *    referencia del producto (`Product.cost`) en caso contrario -- mismo
 *    criterio de snapshot que `CreateInventoryWasteDto.unitValue`.
 */
export async function create(
  dto: CreateProcessingOperationDto,
): Promise<ProcessingOperationResponse> {
  const product = await processingRepository.findProductById(dto.inputProductId);

  if (!product) {
    throw new NotFoundError('Producto de entrada');
  }

  const sucursal = await processingRepository.findSucursalById(dto.sucursalId);

  if (!sucursal) {
    throw new NotFoundError('Sucursal');
  }

  const user = await processingRepository.findUserById(dto.performedByUserId);

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  if (dto.inputQuantity <= 0) {
    throw new ValidationError('La cantidad de entrada debe ser mayor a 0.');
  }

  let inputUnitCost: Money;

  if (product.requiresBatch) {
    if (!dto.inputBatchId) {
      throw new ValidationError(
        'Este producto requiere lote — indique de qué lote proviene el canal a despiezar.',
      );
    }

    const batch = await findByIdBatchService(dto.inputBatchId);

    if (batch.productId !== dto.inputProductId || batch.sucursalId !== dto.sucursalId) {
      throw new ValidationError(
        'El lote indicado no corresponde a este producto y sucursal.',
      );
    }

    if (batch.availableQuantity < dto.inputQuantity) {
      throw new ValidationError(
        `La cantidad a despiezar (${dto.inputQuantity}) supera el saldo disponible del lote (${batch.availableQuantity}).`,
      );
    }

    inputUnitCost = toMoney(batch.unitCost);
  } else {
    if (dto.inputBatchId) {
      throw new ValidationError(
        'Este producto no maneja lotes — no debe indicarse un lote de entrada.',
      );
    }

    inputUnitCost = toMoney(product.cost);
  }

  const sequenceValue = await processingRepository.incrementProcessingCodeSequence();
  const code = `DESP-${String(sequenceValue).padStart(6, '0')}`;

  const created = await processingRepository.create({
    code,
    sucursalId: dto.sucursalId,
    userId: dto.performedByUserId,
    inputProductId: dto.inputProductId,
    inputBatchId: dto.inputBatchId ?? null,
    inputQuantity: dto.inputQuantity,
    inputUnitCost,
    notes: dto.notes ?? null,
  });

  return toOperationResponse(created);
}

/** Edita la nota de una operacion mientras sigue `DRAFT`. */
export async function update(
  id: string,
  dto: UpdateProcessingOperationDto,
): Promise<ProcessingOperationResponse> {
  await findDraftOrThrow(id);

  const updated = await processingRepository.update(id, { notes: dto.notes ?? null });

  return toOperationResponse(updated);
}

/**
 * Cancela una operacion `DRAFT` (nunca una `COMPLETED`, ver
 * `findDraftOrThrow`). `CANCELLED` NUNCA toca inventario -- ningun
 * `recordMovement`, ningun `Batch`, ninguna `InventoryWaste` se crea aca,
 * porque nada se habia descontado todavia (el stock del canal de entrada
 * recien se consume en `complete()`).
 */
export async function cancel(id: string): Promise<ProcessingOperationResponse> {
  await findDraftOrThrow(id);

  const updated = await processingRepository.update(id, { status: 'CANCELLED' });

  return toOperationResponse(updated);
}

/**
 * Agrega una linea de salida (corte/subproducto) a una operacion `DRAFT`.
 * Validaciones:
 *  - La operacion existe y sigue `DRAFT`.
 *  - El producto de salida existe y es DISTINTO del producto de entrada
 *    (plan v3: un corte nunca puede "ser" el mismo canal sin procesar).
 *  - `quantity` es mayor a 0.
 *  - La suma de todas las lineas (salidas + mermas), incluyendo esta nueva,
 *    no supera `inputQuantity` -- balance parcial, `complete()` exige la
 *    igualdad exacta al final.
 *
 * `salePriceSnapshot` se resuelve aca de `Product.salePrice` (nunca lo
 * envia el cliente, ver nota de `types.ts`) -- puede ser 0, ver regla de
 * costeo en la cabecera de este archivo.
 */
export async function addOutputItem(
  processingOperationId: string,
  dto: AddProcessingOutputItemDto,
): Promise<ProcessingOutputItemResponse> {
  const operation = await findDraftOrThrow(processingOperationId);

  if (dto.outputProductId === operation.inputProductId) {
    throw new ValidationError(
      'El producto de salida no puede ser el mismo que el producto de entrada.',
    );
  }

  const outputProduct = await processingRepository.findProductById(dto.outputProductId);

  if (!outputProduct) {
    throw new NotFoundError('Producto de salida');
  }

  if (dto.quantity <= 0) {
    throw new ValidationError('La cantidad de la línea de salida debe ser mayor a 0.');
  }

  assertWithinInputQuantity(operation, dto.quantity);

  const created = await processingRepository.createOutputItem({
    processingOperationId,
    outputProductId: dto.outputProductId,
    quantity: dto.quantity,
    salePriceSnapshot: outputProduct.salePrice,
  });

  return toOutputItemResponse(created);
}

/** Edita la cantidad de una linea de salida existente mientras la operacion
 * sigue `DRAFT`. Misma validacion de balance que `addOutputItem`, excluyendo
 * la propia linea de la suma actual antes de aplicar la nueva cantidad. */
export async function updateOutputItem(
  processingOperationId: string,
  outputItemId: string,
  dto: UpdateProcessingOutputItemDto,
): Promise<ProcessingOutputItemResponse> {
  const operation = await findDraftOrThrow(processingOperationId);

  const existingItem = await processingRepository.findOutputItemById(
    outputItemId,
    processingOperationId,
  );

  if (!existingItem) {
    throw new NotFoundError('Línea de salida');
  }

  if (dto.quantity <= 0) {
    throw new ValidationError('La cantidad de la línea de salida debe ser mayor a 0.');
  }

  assertWithinInputQuantity(operation, dto.quantity, { outputItemId });

  const updated = await processingRepository.updateOutputItem(outputItemId, {
    quantity: dto.quantity,
  });

  return toOutputItemResponse(updated);
}

/** Elimina una linea de salida mientras la operacion sigue `DRAFT`. */
export async function removeOutputItem(
  processingOperationId: string,
  outputItemId: string,
): Promise<void> {
  await findDraftOrThrow(processingOperationId);

  const existingItem = await processingRepository.findOutputItemById(
    outputItemId,
    processingOperationId,
  );

  if (!existingItem) {
    throw new NotFoundError('Línea de salida');
  }

  await processingRepository.deleteOutputItem(outputItemId);
}

/**
 * Agrega una linea de merma (hueso/grasa/recorte sin valor de venta, u otro
 * motivo del catalogo `WasteReason`) a una operacion `DRAFT`. Misma
 * validacion de balance parcial que `addOutputItem` -- correccion aprobada:
 * la merma ya NO es un valor derivado, es una linea real editable con la
 * misma jerarquia que una linea de salida.
 */
export async function addWasteLine(
  processingOperationId: string,
  dto: AddProcessingWasteItemDto,
): Promise<ProcessingWasteItemResponse> {
  const operation = await findDraftOrThrow(processingOperationId);

  if (dto.quantity <= 0) {
    throw new ValidationError('La cantidad de la línea de merma debe ser mayor a 0.');
  }

  assertWithinInputQuantity(operation, dto.quantity);

  const created = await processingRepository.createWasteItem({
    processingOperationId,
    reason: dto.reason,
    quantity: dto.quantity,
    notes: dto.notes ?? null,
  });

  return toWasteItemResponse(created);
}

/** Edita cantidad/motivo/notas de una linea de merma existente mientras la
 * operacion sigue `DRAFT`. Misma validacion de balance que `addWasteLine`,
 * excluyendo la propia linea de la suma actual cuando cambia la cantidad. */
export async function updateWasteLine(
  processingOperationId: string,
  wasteItemId: string,
  dto: UpdateProcessingWasteItemDto,
): Promise<ProcessingWasteItemResponse> {
  const operation = await findDraftOrThrow(processingOperationId);

  const existingItem = await processingRepository.findWasteItemById(
    wasteItemId,
    processingOperationId,
  );

  if (!existingItem) {
    throw new NotFoundError('Línea de merma');
  }

  if (dto.quantity !== undefined) {
    if (dto.quantity <= 0) {
      throw new ValidationError('La cantidad de la línea de merma debe ser mayor a 0.');
    }

    assertWithinInputQuantity(operation, dto.quantity, { wasteItemId });
  }

  const updated = await processingRepository.updateWasteItem(wasteItemId, {
    reason: dto.reason,
    quantity: dto.quantity,
    notes: dto.notes,
  });

  return toWasteItemResponse(updated);
}

/** Elimina una linea de merma mientras la operacion sigue `DRAFT`. */
export async function removeWasteLine(
  processingOperationId: string,
  wasteItemId: string,
): Promise<void> {
  await findDraftOrThrow(processingOperationId);

  const existingItem = await processingRepository.findWasteItemById(
    wasteItemId,
    processingOperationId,
  );

  if (!existingItem) {
    throw new NotFoundError('Línea de merma');
  }

  await processingRepository.deleteWasteItem(wasteItemId);
}

/**
 * Completa una operacion de despiece: transaccion atomica que consume el
 * stock del canal de entrada, crea un lote nuevo por cada salida (con
 * linaje `parentBatchId`) y acredita su stock, distribuye el costo total
 * del canal entre las salidas por el metodo de VALOR RELATIVO DE VENTA, y
 * materializa cada linea de merma como su propia `InventoryWaste`.
 *
 * PASOS (dentro de `tx`):
 *  1. Releer la operacion DENTRO de la transaccion -- debe seguir `DRAFT`
 *     (nunca confiar en un estado leido antes de abrir `tx`, mismo criterio
 *     que `assertSufficientStock` en `sales/service.ts`).
 *  2. Exigir al menos 1 linea de salida.
 *  3. Validar el balance EXACTO:
 *     `inputQuantity === SUM(outputItems) + SUM(wasteLines)` -- ya NO es
 *     un residuo tolerado, es una igualdad estricta (correccion aprobada).
 *     `addOutputItem`/`addWasteLine`/sus ediciones ya validan el limite
 *     superior en cada paso, pero se revalida aca de forma definitiva
 *     (concurrencia: otra pestaña pudo agregar una linea entre medio; y
 *     puede faltar completar el balance por abajo, que solo se detecta aca).
 *  4. Validar y reservar stock disponible del producto/lote de entrada
 *     (`reserveIfSufficient`, mismo patron atomico que Ventas/Mermas).
 *  5. Consumir el canal completo (`PROCESSING_OUT`, cantidad negativa
 *     `inputQuantity`, `batchId: inputBatchId` si aplica -- NUNCA
 *     `skipBatchQuantitySync`: se esta consumiendo un lote YA EXISTENTE,
 *     no creando uno).
 *  6. Distribuir el costo total del canal (`inputQuantity * inputUnitCost`)
 *     entre las salidas por valor relativo de venta (`quantity *
 *     salePriceSnapshot`), con la ULTIMA linea absorbiendo el residuo de
 *     redondeo -- mismo algoritmo ya aprobado y usado en
 *     `promotions/promotionApplication.service.ts::translateEngineResult`.
 *     Una salida individual con `salePriceSnapshot = 0` recibe
 *     `allocatedCost = 0` (no bloquea) -- solo se bloquea si TODAS las
 *     salidas estan en 0 (`totalSaleValue <= 0`, sin base de prorrateo).
 *  7. Por cada salida: crear su `Batch` (via `createBatchService`, MISMA
 *     `tx`, SIN `parentBatchId` -- ese DTO no se extendio, ver punto
 *     siguiente) y acreditar su stock (`PROCESSING_IN`,
 *     `skipBatchQuantitySync: true` -- el lote ya nace con
 *     `availableQuantity = quantity`, mismo patron que Compras/
 *     Devoluciones), fijar `parentBatchId` directamente
 *     (`processingRepository.linkOutputBatchParent`, sin pasar por
 *     `batches/service.ts` -- ese campo no tiene ninguna regla de negocio
 *     asociada en ese modulo), y actualizar la linea con
 *     `allocatedCost`/`outputBatchId`.
 *  8. Por cada linea de merma: materializarla como su propia
 *     `InventoryWaste` (razon de la linea) -- SIN `recordMovement` (ver
 *     `repository.ts::createWasteRecord`, el descuento ya ocurrio en el
 *     paso 5).
 *  9. Marcar la operacion `COMPLETED` (`completedAt: now()`) -- desde aca
 *     es INMUTABLE (ninguna funcion de este archivo permite modificar una
 *     operacion que no sea `DRAFT`).
 */
export async function complete(
  id: string,
  performedByUserId: string,
): Promise<ProcessingOperationResponse> {
  const completed = await prisma.$transaction(async (tx) => {
    const operation = await processingRepository.findById(id, tx);

    if (!operation) {
      throw new NotFoundError('Operación de despiece');
    }

    if (operation.status !== 'DRAFT') {
      throw new ConflictError(
        'Esta operación de despiece ya no está en borrador y no puede completarse.',
      );
    }

    if (operation.outputItems.length === 0) {
      throw new ValidationError(
        'Debe agregar al menos una línea de salida antes de completar el despiece.',
      );
    }

    const inputQuantity = Number(operation.inputQuantity);

    // Suma con `Prisma.Decimal` (no `number`): la igualdad exacta que exige
    // el balance no puede validarse de forma confiable sumando `number`
    // (binario) valores que vienen de columnas `Decimal(12,3)` -- el mismo
    // motivo por el que el dominio de dinero de este proyecto nunca usa
    // punto flotante nativo (`shared/utils/money.ts`). Aca aplica el mismo
    // criterio a cantidades, no solo a montos.
    const committedQuantity = [...operation.outputItems, ...operation.wasteLines].reduce(
      (sum, item) => sum.add(item.quantity),
      toMoney(0),
    );

    if (!committedQuantity.equals(operation.inputQuantity)) {
      throw new ValidationError(
        'El balance del despiece no es exacto: la suma de las líneas de salida y merma debe ser igual a la cantidad de entrada.',
      );
    }

    // Paso 4: reserva/valida stock disponible del producto de entrada
    // (mismo patron atomico que `sales/service.ts::assertSufficientStock`/
    // `inventoryWaste/service.ts::createWasteTransaction`).
    const reservation = await inventoryRepository.reserveIfSufficient(
      operation.inputProductId,
      operation.sucursalId,
      inputQuantity,
      tx,
    );

    if (reservation.count === 0) {
      const inventory = await inventoryRepository.findByProductAndSucursal(
        operation.inputProductId,
        operation.sucursalId,
        tx,
      );
      const availableQuantity = inventory ? Number(inventory.quantity) : 0;

      throw new ValidationError(
        `La cantidad a consumir (${inputQuantity}) supera el stock disponible (${availableQuantity}).`,
      );
    }

    if (operation.inputBatchId) {
      const batch = await findByIdBatchService(operation.inputBatchId, tx);

      if (batch.availableQuantity < inputQuantity) {
        throw new ValidationError(
          `La cantidad a consumir (${inputQuantity}) supera el saldo disponible del lote (${batch.availableQuantity}).`,
        );
      }
    }

    // Paso 5: consume el canal completo.
    await recordMovement({
      tx,
      sucursalId: operation.sucursalId,
      productId: operation.inputProductId,
      userId: performedByUserId,
      type: InventoryMovementType.PROCESSING_OUT,
      quantity: -inputQuantity,
      referenceType: InventoryReferenceType.PROCESSING,
      referenceId: operation.id,
      reason: `Consumo por despiece ${operation.code}`,
      batchId: operation.inputBatchId,
    });

    // Paso 6: distribucion del costo total por valor relativo de venta,
    // ultima linea absorbe el residuo de redondeo (mismo algoritmo que
    // `promotions/promotionApplication.service.ts::translateEngineResult`).
    // Ver regla de costeo en la cabecera del archivo: una salida en 0 no
    // bloquea, solo el caso "todas en 0" lo hace.
    const totalCost = multiplyMoney(operation.inputUnitCost, inputQuantity);
    const saleValues = operation.outputItems.map((item) =>
      multiplyMoney(item.salePriceSnapshot, Number(item.quantity)),
    );
    const totalSaleValue = saleValues.reduce((sum, value) => addMoney(sum, value), toMoney(0));

    if (totalSaleValue.lessThanOrEqualTo(0)) {
      throw new ValidationError(
        'No se puede distribuir el costo del despiece: ninguna línea de salida tiene un precio de venta válido.',
      );
    }

    let allocatedSum = toMoney(0);
    const allocatedCosts: Money[] = operation.outputItems.map((_item, index) => {
      const isLast = index === operation.outputItems.length - 1;

      if (isLast) {
        return totalCost.sub(allocatedSum);
      }

      const share = roundMoney(totalCost.mul(saleValues[index]).div(totalSaleValue));
      allocatedSum = addMoney(allocatedSum, share);
      return share;
    });

    // Paso 7: crea el lote de cada salida, fija su linaje y acredita su stock.
    const updatedOutputItems: ProcessingOutputItemRecord[] = [];

    for (let index = 0; index < operation.outputItems.length; index += 1) {
      const item = operation.outputItems[index];
      const allocatedCost = allocatedCosts[index];
      const quantity = Number(item.quantity);
      const unitCost = roundMoney(allocatedCost.div(quantity));

      const outputBatch = await createBatchService(
        {
          productId: item.outputProductId,
          sucursalId: operation.sucursalId,
          purchaseItemId: null,
          supplierId: null,
          receivedAt: new Date(),
          initialQuantity: quantity,
          unitCost: unitCost.toNumber(),
          notes: `Generado por despiece ${operation.code}`,
        },
        tx,
      );

      await processingRepository.linkOutputBatchParent(
        outputBatch.id,
        operation.inputBatchId ?? null,
        tx,
      );

      await recordMovement({
        tx,
        sucursalId: operation.sucursalId,
        productId: item.outputProductId,
        userId: performedByUserId,
        type: InventoryMovementType.PROCESSING_IN,
        quantity,
        referenceType: InventoryReferenceType.PROCESSING,
        referenceId: operation.id,
        reason: `Salida por despiece ${operation.code}`,
        batchId: outputBatch.id,
        skipBatchQuantitySync: true,
      });

      const updatedItem = await processingRepository.updateOutputItem(
        item.id,
        {
          allocatedCost,
          outputBatchId: outputBatch.id,
        },
        tx,
      );

      updatedOutputItems.push(updatedItem);
    }

    // Paso 8: materializa cada linea de merma como su propia InventoryWaste,
    // sin volver a descontar stock (ya se descontó completo en el paso 5).
    for (const wasteLine of operation.wasteLines) {
      const wasteQuantity = Number(wasteLine.quantity);
      const wasteUnitValue = operation.inputUnitCost;
      const wasteTotalValue = roundMoney(multiplyMoney(wasteUnitValue, wasteQuantity));

      await processingRepository.createWasteRecord(
        {
          sucursalId: operation.sucursalId,
          productId: operation.inputProductId,
          userId: performedByUserId,
          reason: wasteLine.reason,
          notes: wasteLine.notes ?? `Merma de despiece ${operation.code}`,
          quantity: wasteQuantity,
          unitValue: wasteUnitValue,
          totalValue: wasteTotalValue,
          batchId: operation.inputBatchId,
          processingOperationId: operation.id,
        },
        tx,
      );
    }

    // Paso 9: cierra la operacion -- inmutable desde aca.
    const updatedOperation = await processingRepository.update(
      id,
      { status: 'COMPLETED', completedAt: new Date() },
      tx,
    );

    return {
      ...updatedOperation,
      outputItems: updatedOutputItems,
      wasteLines: operation.wasteLines,
    };
  }, transactionConfig.standard);

  return toOperationResponse(completed);
}
