/**
 * shared/services/inventoryMovement.service.ts
 * -----------------------------------------------------------------------------
 * Servicio transversal interno para registrar movimientos de inventario y
 * mantener `Inventory.quantity` sincronizado con ellos, de forma atomica.
 *
 * Este archivo NO es un modulo: no tiene `routes.ts`, `controller.ts`,
 * `types.ts`, `validation.ts` ni `index.ts`, y no expone ningun endpoint
 * HTTP. Es el unico punto autoritativo del sistema para esta operacion;
 * los modulos de negocio (Purchases, Sales, y en el futuro Returns,
 * Inventory Adjustments, Waste/Shrinkage) lo invocan, nunca al reves.
 *
 * Responsabilidad exacta: dado que un movimiento de inventario debe
 * ocurrir, registrarlo correctamente y sincronizar el saldo, dentro de la
 * MISMA transaccion que el llamador ya tiene abierta. No decide si un
 * movimiento debe ocurrir ni por que: eso es conocimiento de dominio del
 * modulo que lo invoca.
 *
 * Validaciones/comportamiento que SI realiza:
 *  - `quantity` distinto de 0.
 *  - Si no existe una fila de `Inventory` para `(productId, sucursalId)`,
 *    la crea con `quantity: 0` dentro de la misma transaccion antes de
 *    aplicar el movimiento, en lugar de fallar. `Product` es catalogo
 *    compartido entre sucursales (no tiene `sucursalId`), por lo que no
 *    puede inicializar `Inventory` por si solo; el primer movimiento real
 *    de un producto en una sucursal (tipicamente una compra) es lo que
 *    naturalmente establece su existencia (ver enum `InventoryMovementType`,
 *    valor `INITIAL`, y DATABASE.md). Exigir un alta manual previa de
 *    `Inventory` no esta sustentado por ninguna restriccion de
 *    `schema.prisma`.
 *
 * Validaciones que NO realiza, porque corresponden al modulo que invoca:
 *  - Existencia de `Sucursal`, `Product` o `User`.
 *  - Autorizacion / RBAC.
 *  - Reglas de negocio de Purchases, Sales, o cualquier otro modulo (por
 *    ejemplo, si el estado de una compra amerita generar el movimiento).
 *
 * Dependencias (grafo limpio, con UNA excepcion documentada): este servicio
 * depende de `modules/inventory/repository.ts`, el UNICO dueno de la tabla
 * `Inventory` en el proyecto; de su hermano
 * `shared/repositories/inventoryMovement.repository.ts`, el UNICO dueno de
 * la tabla `InventoryMovement`; y, desde el Bloque LOTES-01, de
 * `modules/batches/repository.ts`, el UNICO dueno de la tabla `Batch` --
 * mismo criterio que los dos anteriores (se importa el REPOSITORIO, nunca
 * el `service.ts`/logica de negocio de ese modulo). No importa, ni debe
 * importar nunca, ningun modulo de negocio (Purchases, Sales, Cash,
 * Configuration, Audit, ni futuros modulos): son ellos quienes conocen a
 * este servicio, nunca al reves. El grafo de dependencias permanece
 * aciclico.
 *
 * Atomicidad: `tx` es OBLIGATORIO. Este servicio nunca abre su propia
 * transaccion; siempre participa en la transaccion que el llamador ya tiene
 * abierta (por ejemplo, `prisma.$transaction(async (tx) => {...})` dentro
 * de `purchases.service.ts`). Todas sus escrituras (la creacion de
 * `Inventory` cuando no existe, la actualizacion de `Inventory.quantity` a
 * traves de `inventory/repository.ts`, la actualizacion de
 * `Batch.availableQuantity` a traves de `batches/repository.ts` cuando
 * `params.batchId` esta presente, y la creacion del `InventoryMovement` a
 * traves de `inventoryMovement.repository.ts`) usan ese mismo `tx`, por lo
 * que forman una unica unidad atomica junto con la escritura del llamador:
 * si algo falla despues, la fila de `Inventory` recien creada (o el ajuste
 * del lote) tambien revierte, sin quedar huerfana.
 *
 * Bloque LOTES-01 (Modulo de Lotes, infraestructura): cuando
 * `params.batchId` viene presente, ademas del incremento atomico de
 * `Inventory.quantity` (sin cambios), este servicio aplica el MISMO
 * incremento atomico sobre `Batch.availableQuantity`, y si el resultado
 * llega a 0, marca el lote `DEPLETED` (solo si el estado anterior era
 * `ACTIVE`, ver la politica completa de transiciones en
 * `batches/service.ts`) -- este es el mecanismo que mantiene el invariante
 * `SUM(Batch.availableQuantity WHERE status != DEPLETED) =
 * Inventory.quantity` (ver `schema.prisma`, seccion "MODULO DE LOTES", y
 * la nota de invariante corregida en `batches/service.ts` -- NO es "solo
 * ACTIVA": desde el Bloque LOTES-05, un lote `EXPIRED`/`BLOCKED` con saldo
 * sin consumir sigue siendo existencia real, solo `DEPLETED` implica saldo
 * 0). Bloque LOTES-02 (primer llamador real, Compras):
 * `params.skipBatchQuantitySync` permite etiquetar un movimiento con
 * `batchId` (trazabilidad) SIN aplicarle el incremento -- uso exclusivo del
 * movimiento `PURCHASE` que crea el lote (que ya nace con
 * `availableQuantity = initialQuantity`, aplicar el incremento ademas lo
 * duplicaria) y, desde el Bloque LOTES-05, del movimiento `RETURN` que crea
 * el lote de reingreso por devolucion (misma razon exacta).
 */
import { InventoryMovementType, Prisma } from '@prisma/client';
import { ValidationError } from '@/shared/errors';
import { toMoney } from '@/shared/utils/money';
import * as inventoryRepository from '@/modules/inventory/repository';
import * as batchesRepository from '@/modules/batches/repository';
import * as inventoryMovementRepository from '@/shared/repositories/inventoryMovement.repository';
import type { DbClient } from '@/shared/repositories/inventoryMovement.repository';
import type { InventoryReferenceTypeName } from '@/shared/constants';

/**
 * Aplica el incremento atomico de `Batch.availableQuantity` correspondiente
 * a un movimiento, y cierra el lote (`DEPLETED`) si el saldo resultante
 * llega a 0. No hace nada si `batchId` es `null`/`undefined` (el caso de
 * hoy para todo producto sin `Product.requiresBatch`) ni si `skip` es
 * `true` (ver `RecordMovementParams.skipBatchQuantitySync`).
 */
async function applyBatchMovement(
  batchId: string | null | undefined,
  skip: boolean | undefined,
  quantity: number,
  tx: DbClient,
): Promise<void> {
  if (!batchId || skip) {
    return;
  }

  const updatedBatch = await batchesRepository.incrementAvailableQuantity(batchId, quantity, tx);

  if (updatedBatch.status === 'ACTIVE' && Number(updatedBatch.availableQuantity) <= 0) {
    await batchesRepository.update(batchId, { status: 'DEPLETED', closedAt: new Date() }, tx);
  }
}

/** Parametros para registrar un movimiento de inventario. */
export interface RecordMovementParams {
  /** Cliente transaccional del llamador. Obligatorio: este servicio nunca
   * abre su propia transaccion. */
  tx: DbClient;
  sucursalId: string;
  productId: string;
  userId: string;
  type: InventoryMovementType;
  /** Cantidad con signo: positivo entra, negativo sale (ver DATABASE.md). */
  quantity: number;
  referenceType?: InventoryReferenceTypeName | null;
  referenceId?: string | null;
  reason?: string | null;
  /** Bloque LOTES-01: opcional -- cuando el producto tiene
   * `Product.requiresBatch`, el llamador (LOTES-02/03) debe indicar de que
   * lote se trata, para que `Batch.availableQuantity` se mantenga
   * sincronizado con `Inventory.quantity` de forma atomica, dentro de la
   * MISMA transaccion. `undefined`/`null` (todo el codigo actual, sin
   * excepcion) deja el comportamiento identico al de antes de este campo. */
  batchId?: string | null;
  /**
   * USO EXCLUSIVO de DOS flujos, y NINGUN OTRO -- ambos son el UNICO
   * momento en que un lote nace ya con `availableQuantity =
   * initialQuantity` (asignado directamente por `batches/service.ts::create`),
   * asi que aplicarle ADEMAS el incremento generico de este movimiento lo
   * duplicaria (bug real, detectado y corregido durante LOTES-02:
   * `availableQuantity` quedaba en el doble de `initialQuantity`). El
   * movimiento igual queda etiquetado con `batchId` (trazabilidad: "este
   * movimiento es el que dio origen al lote"), solo se omite el ajuste de
   * cantidad:
   *
   *  1. `purchases/service.ts::createBatchesForReceivedPurchase` (Bloque
   *     LOTES-02) -- el movimiento `PURCHASE` de la MISMA recepcion que
   *     acaba de crear el lote.
   *  2. `returns/service.ts::createReturnTransaction` (Bloque LOTES-05,
   *     reingreso por devolucion de un producto con `Product.requiresBatch`)
   *     -- el movimiento `RETURN` de la MISMA devolucion que acaba de crear
   *     el lote de reingreso (via `createBatchService`, sin
   *     `purchaseItemId` ni `supplierId`, identificado por `notes`). Misma
   *     razon exacta que el caso 1: el lote de reingreso ya nace con
   *     `availableQuantity` = la cantidad devuelta.
   *
   * NINGUN OTRO FLUJO debe establecer este campo en `true`, bajo ninguna
   * circunstancia. En particular, Ventas (`sales/service.ts::resolveBatchAllocations`,
   * LOTES-03) y Mermas (`inventoryWaste/service.ts::createWasteTransaction`,
   * LOTES-05) SIEMPRE consumen saldo de un lote YA EXISTENTE -- ninguna de
   * las dos crea un lote -- por lo que NUNCA establecen este campo (lo
   * omiten, igual que su default `undefined`), dejando que
   * `applyBatchMovement` aplique el descuento normalmente. Lo mismo aplica
   * a cualquier flujo futuro que sume `batchId` a un movimiento (ej. un
   * futuro ajuste manual de inventario): deja este campo sin definir salvo
   * que sea, como los dos casos de arriba, la creacion inicial de un lote.
   */
  skipBatchQuantitySync?: boolean;
}

/** Resultado minimo de registrar un movimiento de inventario. */
export interface RecordMovementResult {
  movementId: string;
  balanceAfter: number;
}

/**
 * Registra un movimiento de inventario y sincroniza `Inventory.quantity`,
 * usando la transaccion recibida en `params.tx`.
 */
export async function recordMovement(params: RecordMovementParams): Promise<RecordMovementResult> {
  if (params.quantity === 0) {
    throw new ValidationError('La cantidad del movimiento no puede ser 0.');
  }

  let inventory = await inventoryRepository.findByProductAndSucursal(
    params.productId,
    params.sucursalId,
    params.tx,
  );

  if (!inventory) {
    inventory = await inventoryRepository.create(
      {
        sucursalId: params.sucursalId,
        productId: params.productId,
        quantity: 0,
      },
      params.tx,
    );
  }

  // Incremento atomico en la base de datos (`UPDATE ... SET quantity =
  // quantity + delta`), en vez de leer -> calcular en la aplicacion ->
  // escribir el total. Esto elimina el "lost update": si dos
  // transacciones concurrentes incrementan el mismo registro, cada
  // `UPDATE` aplica su propio delta sobre el valor que la base de datos
  // tenga en ese instante (el motor serializa las escrituras sobre la
  // misma fila), en vez de partir de un valor leido por separado en cada
  // transaccion. El valor devuelto por `update()` (`updatedInventory`) es
  // la unica fuente de verdad para `balanceAfter` — nunca se calcula en
  // la aplicacion.
  const updatedInventory = await inventoryRepository.update(
    inventory.id,
    { quantity: { increment: params.quantity } },
    params.tx,
  );

  await applyBatchMovement(
    params.batchId,
    params.skipBatchQuantitySync,
    params.quantity,
    params.tx,
  );

  const movement = await inventoryMovementRepository.createMovement(
    {
      sucursalId: params.sucursalId,
      productId: params.productId,
      userId: params.userId,
      type: params.type,
      quantity: params.quantity,
      balanceAfter: toMoney(updatedInventory.quantity),
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      batchId: params.batchId ?? null,
      reason: params.reason ?? null,
    },
    params.tx,
  );

  return {
    movementId: movement.id,
    balanceAfter: Number(updatedInventory.quantity),
  };
}

/**
 * Version batched de `recordMovement()`: registra VARIOS movimientos de
 * inventario dentro de la MISMA transaccion (`Bloque B`, optimizacion de
 * round-trips para carritos/compras/devoluciones con muchas lineas).
 *
 * Mismas garantias que `recordMovement()` para cada movimiento individual:
 * el incremento de `Inventory.quantity` sigue siendo un `UPDATE` atomico
 * POR LINEA (nunca se agrupan incrementos de distintas lineas, ni siquiera
 * si comparten `productId` -- una venta puede tener mas de un detalle para
 * el mismo producto, ver `assertSufficientStock` en `sales/service.ts`, y
 * cada `InventoryMovement` debe conservar su propio `balanceAfter`
 * secuencial). Agrupar ese incremento cambiaria el valor de `balanceAfter`
 * registrado por linea y reintroduciria el "lost update" que el incremento
 * atomico existe para evitar.
 *
 * Lo que SI se agrupa (round-trips que no afectan ese invariante):
 *  - La verificacion de existencia de `Inventory` para todos los productos
 *    distintos del lote: una sola lectura (`findMany`) en vez de una por
 *    linea.
 *  - La creacion de las filas de `Inventory` faltantes: una sola escritura
 *    (`createMany`) en vez de una por producto faltante.
 *  - La insercion de los `InventoryMovement` resultantes: una sola
 *    escritura (`createManyAndReturn`) al final, usando los valores de
 *    `balanceAfter` ya calculados por cada `UPDATE` de la etapa anterior
 *    -- no se recalcula nada en memoria.
 *
 * Requiere que todos los parametros compartan la misma `sucursalId` y el
 * mismo `tx` (siempre el caso hoy: una venta/compra/devolucion opera sobre
 * una unica sucursal, dentro de una unica transaccion).
 */
export async function recordMovements(
  paramsList: RecordMovementParams[],
): Promise<RecordMovementResult[]> {
  if (paramsList.length === 0) {
    return [];
  }

  for (const params of paramsList) {
    if (params.quantity === 0) {
      throw new ValidationError('La cantidad del movimiento no puede ser 0.');
    }
  }

  const tx = paramsList[0].tx;
  const sucursalId = paramsList[0].sucursalId;

  const distinctProductIds = [...new Set(paramsList.map((params) => params.productId))];

  const existingInventories = await inventoryRepository.findManyByProductsAndSucursal(
    distinctProductIds,
    sucursalId,
    tx,
  );
  const existingProductIds = new Set(existingInventories.map((inventory) => inventory.productId));
  const missingProductIds = distinctProductIds.filter(
    (productId) => !existingProductIds.has(productId),
  );

  if (missingProductIds.length > 0) {
    await inventoryRepository.createManyMissing(
      missingProductIds.map((productId) => ({ sucursalId, productId, quantity: 0 })),
      tx,
    );
  }

  const movementsToInsert: Prisma.InventoryMovementCreateManyInput[] = [];

  for (const params of paramsList) {
    const updatedInventory = await inventoryRepository.updateQuantityByProductAndSucursal(
      params.productId,
      params.sucursalId,
      { quantity: { increment: params.quantity } },
      params.tx,
    );

    await applyBatchMovement(
      params.batchId,
      params.skipBatchQuantitySync,
      params.quantity,
      params.tx,
    );

    movementsToInsert.push({
      sucursalId: params.sucursalId,
      productId: params.productId,
      userId: params.userId,
      type: params.type,
      quantity: params.quantity,
      balanceAfter: toMoney(updatedInventory.quantity),
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      batchId: params.batchId ?? null,
      reason: params.reason ?? null,
    });
  }

  const createdMovements = await inventoryMovementRepository.createManyMovements(
    movementsToInsert,
    tx,
  );

  return createdMovements.map((movement, index) => ({
    movementId: movement.id,
    balanceAfter: Number(movementsToInsert[index].balanceAfter),
  }));
}
