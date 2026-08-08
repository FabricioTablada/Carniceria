/**
 * modules/inventoryWaste/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de Mermas (Bloque 5.3).
 *
 * ARQUITECTURA APROBADA (Bloque 5.1): `InventoryWaste` es el DOCUMENTO DE
 * NEGOCIO que representa el evento de merma — NUNCA modifica
 * `Inventory.quantity` directamente. El UNICO responsable de modificar el
 * stock sigue siendo `shared/services/inventoryMovement.service.ts`
 * (`recordMovement`), con `InventoryMovementType.WASTE` (mismo servicio
 * transversal que ya usan Compras, Ventas, Anulacion y Devoluciones — cero
 * logica de inventario nueva aca).
 *
 * Responsabilidades:
 *  - Validar que el producto, la sucursal y el usuario existan.
 *  - Validar que la cantidad a mermar sea mayor que cero (Zod, capa de
 *    validacion) y que NUNCA supere el stock disponible — releido DENTRO
 *    de la transaccion (no antes de abrirla), mismo criterio que
 *    `assertSufficientStock` en `sales/service.ts`: nunca se confia en un
 *    stock leido/mostrado previamente al cliente.
 *  - Calcular el snapshot de valorizacion (`unitValue`/`totalValue`) a
 *    partir de `Product.cost` (costo de referencia) — NUNCA el precio de
 *    venta (sobreestimaria la perdida real), ver analisis del Bloque 5.1.
 *  - Registrar el movimiento de inventario reutilizando `recordMovement`
 *    (tipo `WASTE`).
 *  - Auditar con `shared/services/audit.service.ts`, dentro de la MISMA
 *    transaccion (parametro `tx`, agregado en el Bloque 3).
 *  - `createWaste` (registro manual desde Inventario): dos origenes existen
 *    en el sistema, con dos caminos de codigo separados a proposito (ver
 *    Bloque 2 de la correccion de devoluciones/merma). `createWaste` sigue
 *    siendo el UNICO camino que ademas llama a `recordMovement` — usalo
 *    solo para mermas que SI deben restar `Inventory.quantity` (producto
 *    vencido/dañado detectado en Inventario, nunca antes en stock vendible
 *    "de mas").
 *  - `createWasteFromReturn` (origen: devolucion con `restock: false`,
 *    llamada por `returns/service.ts`): crea el `InventoryWaste` con
 *    `sourceReturnItemId` para trazabilidad, pero DELIBERADAMENTE NO llama
 *    a `recordMovement` — la unidad devuelta nunca volvio a sumarse a
 *    `Inventory.quantity` (no se emitio `RETURN`), asi que "mermarla" con
 *    el camino normal de `createWaste` restaria el stock una segunda vez.
 *    Ver justificacion completa en la funcion.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `inventoryWaste.repository.ts` (y, para leer stock, `inventory/
 * repository.ts` — mismo precedente que `sales/service.ts`); este
 * servicio no ejecuta queries de Prisma directamente.
 */
import { InventoryMovementType, Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { transactionConfig } from '@/config';
import { AuditAction, InventoryReferenceType } from '@/shared/constants';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import { toMoney, multiplyMoney, type Money } from '@/shared/utils/money';
import { recordMovement } from '@/shared/services/inventoryMovement.service';
import { auditService } from '@/shared/services/audit.service';
import * as inventoryRepository from '@/modules/inventory/repository';
import { findByIdBatchService, reopenBatchIfRestockedService } from '@/modules/batches';
import * as inventoryWasteRepository from './repository';
import type {
  CreateInventoryWasteDto,
  InventoryWasteResponse,
  ListInventoryWastesQuery,
  ListInventoryWastesResult,
  WasteReason,
} from './types';

/** Etiquetas en español de cada origen, usadas como `reason` (texto libre)
 * de `InventoryMovement` cuando el usuario no escribio una nota — ese
 * campo es un string libre por diseño (ver `shared/repositories/
 * inventoryMovement.repository.ts`), distinto del catalogo controlado
 * `WasteReason` de este modulo. */
const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  RETURNED_NOT_RESTOCKED: 'Devolución no reingresada a inventario',
  EXPIRED: 'Producto vencido',
  DAMAGED: 'Producto dañado',
  PRODUCTION_ERROR: 'Error de producción',
  CUTTING_ERROR: 'Error de corte',
  PACKAGING_ERROR: 'Error de empaque',
  COLD_CHAIN_FAILURE: 'Falla de cadena de frío',
  OTHER: 'Otro',
};

/** Forma minima de registro de merma de Prisma para mapearlo. */
type InventoryWasteRecord = {
  id: string;
  sucursalId: string;
  productId: string;
  userId: string;
  reason: string;
  notes: string | null;
  quantity: Prisma.Decimal;
  unitValue: Prisma.Decimal;
  totalValue: Prisma.Decimal;
  sourceReturnItemId: string | null;
  batchId: string | null;
  sucursal: { id: string; name: string };
  product: { id: string; name: string; sku: string | null; unitOfMeasure: string };
  user: { id: string; fullName: string };
  createdAt: Date;
  updatedAt: Date;
};

function toInventoryWasteResponse(waste: InventoryWasteRecord): InventoryWasteResponse {
  return {
    id: waste.id,
    sucursalId: waste.sucursalId,
    productId: waste.productId,
    userId: waste.userId,
    reason: waste.reason as WasteReason,
    notes: waste.notes,
    quantity: Number(waste.quantity),
    unitValue: Number(waste.unitValue),
    totalValue: Number(waste.totalValue),
    sourceReturnItemId: waste.sourceReturnItemId,
    batchId: waste.batchId,
    sucursal: waste.sucursal,
    product: {
      id: waste.product.id,
      name: waste.product.name,
      sku: waste.product.sku,
      unitOfMeasure: waste.product.unitOfMeasure as InventoryWasteResponse['product']['unitOfMeasure'],
    },
    user: waste.user,
    createdAt: waste.createdAt,
    updatedAt: waste.updatedAt,
  };
}

/**
 * Cuerpo transaccional del registro de una merma. La cantidad disponible
 * se relee AQUI (dentro de `tx`), nunca antes: dos mermas concurrentes
 * sobre el mismo producto no pueden, entre ambas, dejar el stock negativo
 * — mismo criterio que `assertSufficientStock` en `sales/service.ts`.
 */
async function createWasteTransaction(
  dto: CreateInventoryWasteDto,
  unitValue: Money,
  tx: DbClient,
) {
  // Auditoria de riesgos criticos (Hallazgo 1, 07/08/2026): antes, esta
  // verificacion era una lectura simple (`findByProductAndSucursal`) sin
  // bloqueo de fila — dos mermas concurrentes del mismo producto podian
  // leer ambas el mismo stock "suficiente" antes de que cualquiera
  // confirmara. Mismo patron atomico ya aprobado y probado en Ventas
  // (`assertSufficientStock`/`reserveIfSufficient`, `sales/service.ts` +
  // `inventory/repository.ts`): un `UPDATE` condicional que no cambia el
  // valor, pero SI toma el bloqueo de fila hasta el commit/rollback de
  // esta transaccion.
  const reservation = await inventoryRepository.reserveIfSufficient(
    dto.productId,
    dto.sucursalId,
    dto.quantity,
    tx,
  );

  if (reservation.count === 0) {
    // Sin stock suficiente (o sin fila de `Inventory` todavia) — lectura
    // puntual solo para el mensaje de error, mismo criterio que
    // `assertSufficientStock` en `sales/service.ts`.
    const inventory = await inventoryRepository.findByProductAndSucursal(
      dto.productId,
      dto.sucursalId,
      tx,
    );
    const availableQuantity = inventory ? Number(inventory.quantity) : 0;

    throw new ValidationError(
      `La cantidad a mermar (${dto.quantity}) supera el stock disponible (${availableQuantity}).`,
    );
  }

  // Bloque LOTES-05 (integracion con Mermas): cuando la merma indica un
  // lote puntual, se relee DENTRO de esta transaccion (nunca un valor
  // mostrado antes de abrirla, mismo criterio que `availableQuantity` de
  // arriba) -- `findByIdBatchService` (barrel `@/modules/batches`, nunca
  // su repositorio directo) tambien barre la expiracion de ESE lote antes
  // de devolverlo (regla 2 de la politica de estados, ver
  // `batches/service.ts`), asi que el estado leido aca ya es el real.
  //
  // Se permite mermar de un lote `ACTIVE`, `EXPIRED` o `BLOCKED` (sin
  // exigir un `status` puntual): un `DEPLETED` nunca tiene saldo
  // suficiente (su `availableQuantity` ya es 0), asi que la validacion de
  // cantidad de abajo lo excluye naturalmente sin necesitar una
  // comprobacion de estado aparte. Dar de baja stock ya vencido o
  // bloqueado es exactamente el proposito de una merma.
  if (dto.batchId) {
    const batch = await findByIdBatchService(dto.batchId, tx);

    if (batch.productId !== dto.productId || batch.sucursalId !== dto.sucursalId) {
      throw new ValidationError(
        'El lote indicado no corresponde a este producto y sucursal.',
      );
    }

    if (batch.availableQuantity < dto.quantity) {
      throw new ValidationError(
        `La cantidad a mermar (${dto.quantity}) supera el saldo disponible del lote (${batch.availableQuantity}).`,
      );
    }
  }

  const totalValue = multiplyMoney(unitValue, dto.quantity);

  const waste = await inventoryWasteRepository.create(
    {
      sucursalId: dto.sucursalId,
      productId: dto.productId,
      userId: dto.performedByUserId,
      reason: dto.reason,
      notes: dto.notes ?? null,
      quantity: dto.quantity,
      unitValue,
      totalValue,
      sourceReturnItemId: dto.sourceReturnItemId ?? null,
      batchId: dto.batchId ?? null,
    },
    tx,
  );

  // InventoryWaste NUNCA modifica el stock directamente: recordMovement
  // (compartido, sin cambios) es el UNICO responsable — mismo criterio
  // que Compras/Ventas/Devoluciones/Anulacion. `batchId` (Bloque LOTES-05):
  // se propaga tal cual, SIN `skipBatchQuantitySync` -- una merma siempre
  // CONSUME saldo de un lote ya existente, nunca lo crea, asi que el
  // descuento atomico de `applyBatchMovement` debe aplicarse siempre
  // (mismo criterio que Ventas, LOTES-03; ese flag es EXCLUSIVO de la
  // creacion inicial de un lote en Compras y del reingreso por devolucion,
  // ver `shared/services/inventoryMovement.service.ts`).
  await recordMovement({
    tx,
    sucursalId: dto.sucursalId,
    productId: dto.productId,
    userId: dto.performedByUserId,
    type: InventoryMovementType.WASTE,
    quantity: -dto.quantity,
    referenceType: InventoryReferenceType.INVENTORY_WASTE,
    referenceId: waste.id,
    reason: dto.notes?.trim() || WASTE_REASON_LABELS[dto.reason],
    batchId: dto.batchId ?? null,
  });

  await auditService.log({
    // Sprint QA 3.3: reemplaza el uso generico de
    // `AuditAction.INVENTORY_MOVEMENT` (legacy, ver
    // `shared/constants/auditActions.constants.ts`) por la accion especifica
    // de merma.
    action: AuditAction.INVENTORY_WASTE,
    entity: 'InventoryWaste',
    entityId: waste.id,
    userId: dto.performedByUserId,
    sucursalId: dto.sucursalId,
    before: null,
    after: {
      productId: dto.productId,
      reason: dto.reason,
      quantity: dto.quantity,
      totalValue: Number(totalValue),
      sourceReturnItemId: dto.sourceReturnItemId ?? null,
    },
    metadata: { type: 'WASTE', notes: dto.notes ?? null },
    tx,
  });

  return waste;
}

/**
 * Registra una merma. Validaciones previas a abrir la transaccion
 * (lecturas puras, mismo criterio que `sales.service.ts`/
 * `returns.service.ts`): el producto, la sucursal y el usuario existen; si
 * se proporciono `sourceReturnItemId`, esa linea de devolucion existe
 * (integridad, no logica de integracion — ver nota de archivo). La
 * validacion de stock disponible ocurre DENTRO de la transaccion.
 */
export async function createWaste(dto: CreateInventoryWasteDto): Promise<InventoryWasteResponse> {
  const product = await inventoryWasteRepository.findProductById(dto.productId);

  if (!product) {
    throw new NotFoundError('Producto');
  }

  const sucursal = await inventoryWasteRepository.findSucursalById(dto.sucursalId);

  if (!sucursal) {
    throw new NotFoundError('Sucursal');
  }

  const user = await inventoryWasteRepository.findUserById(dto.performedByUserId);

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  if (dto.sourceReturnItemId) {
    const sourceReturnItem = await inventoryWasteRepository.findSaleReturnItemById(
      dto.sourceReturnItemId,
    );

    if (!sourceReturnItem) {
      throw new NotFoundError('Línea de devolución');
    }
  }

  // QA.16A (prueba de estres operativa): `batchId` es opcional en
  // `CreateInventoryWasteSchema` (Zod), y `recordMovement` no hace NADA si
  // `batchId` es `null`/`undefined` (comportamiento correcto y documentado
  // para un producto SIN `Product.requiresBatch`) -- pero para un producto
  // CON `requiresBatch`, omitir `batchId` dejaba pasar la merma igual: el
  // `Inventory.quantity` agregado se reducia correctamente (via
  // `recordMovement`), pero NINGUN lote perdia saldo, porque
  // `applyBatchMovement` no tenia a que lote aplicarle el descuento.
  // Reproducido empiricamente: una merma de 5kg sobre un producto con un
  // unico lote de 30kg, sin `batchId`, dejo `Inventory.quantity` en 25
  // pero el lote siguio mostrando `availableQuantity: 30` -- desincronizado
  // de forma permanente y silenciosa (sin ningun error). El formulario del
  // frontend (`InventoryWasteForm.tsx`) ya exige el lote cuando el producto
  // lo requiere (`required: requiresBatch`), pero el backend, la fuente de
  // verdad real, no lo exigia -- mismo criterio "nunca confiar en el
  // frontend" ya aplicado en este mismo archivo para `availableQuantity`
  // (releida dentro de la transaccion, nunca un valor mostrado antes). No
  // se implementa resolucion automatica de lote (eso si seria una
  // funcionalidad nueva, el mismo mecanismo FEFO que ya tiene Ventas) --
  // unicamente se exige que el llamador indique explicitamente el lote,
  // igual que ya lo exige el propio formulario.
  if (product.requiresBatch && !dto.batchId) {
    throw new ValidationError(
      'Este producto requiere lote — indique de qué lote se está registrando la merma.',
    );
  }

  const unitValue = toMoney(product.cost);

  try {
    const created = await prisma.$transaction(
      (tx) => createWasteTransaction(dto, unitValue, tx),
      transactionConfig.standard,
    );

    return toInventoryWasteResponse(created);
  } catch (error) {
    // `sourceReturnItemId` es `@unique` en `schema.prisma`: una linea de
    // devolucion corresponde, a lo sumo, a una merma. Traduce la colision
    // de Postgres (P2002) a un error de negocio legible, mismo criterio
    // que `sales.service.ts` con `documentNumber`.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      (error.meta.target as string[]).includes('source_return_item_id')
    ) {
      throw new ConflictError('Esa línea de devolución ya tiene una merma registrada.');
    }

    throw error;
  }
}

/**
 * Crea el registro de trazabilidad de una merma originada por una linea de
 * devolucion marcada "no reingresa" (`restock: false`, ver
 * `returns/service.ts`). A DIFERENCIA de `createWaste`/
 * `createWasteTransaction`, esta funcion NO llama a `recordMovement`: la
 * unidad devuelta nunca volvio a sumarse a `Inventory.quantity` (no se
 * emitio un `InventoryMovement` de tipo `RETURN` para ella), asi que
 * "mermarla" con el camino normal restaria el stock una segunda vez sobre
 * una unidad que, en los hechos, nunca estuvo de vuelta en inventario
 * vendible. El `InventoryWaste` creado aqui es evidencia operativa/de
 * auditoria unicamente — `Inventory.quantity` permanece sin cambios.
 *
 * `reason` es siempre `RETURNED_NOT_RESTOCKED` (unico origen valido de esta
 * funcion) y `sourceReturnItemId` es obligatorio (a diferencia de
 * `CreateInventoryWasteDto.sourceReturnItemId`, opcional para el registro
 * manual de `createWaste`) — asegura la trazabilidad venta → devolucion →
 * merma que pide el Bloque 2.
 *
 * Requiere `tx`: participa de la MISMA transaccion que crea la devolucion
 * en `returns/service.ts` — si algo despues de esta linea falla, la merma
 * no debe persistir sin la devolucion que la origino.
 */
export async function createWasteFromReturn(
  params: {
    sucursalId: string;
    productId: string;
    performedByUserId: string;
    quantity: number;
    sourceReturnItemId: string;
  },
  tx: DbClient,
): Promise<void> {
  const product = await inventoryWasteRepository.findProductById(params.productId, tx);

  if (!product) {
    throw new NotFoundError('Producto');
  }

  const unitValue = toMoney(product.cost);
  const totalValue = multiplyMoney(unitValue, params.quantity);

  const waste = await inventoryWasteRepository.create(
    {
      sucursalId: params.sucursalId,
      productId: params.productId,
      userId: params.performedByUserId,
      reason: 'RETURNED_NOT_RESTOCKED',
      notes: null,
      quantity: params.quantity,
      unitValue,
      totalValue,
      sourceReturnItemId: params.sourceReturnItemId,
    },
    tx,
  );

  await auditService.log({
    action: AuditAction.INVENTORY_WASTE,
    entity: 'InventoryWaste',
    entityId: waste.id,
    userId: params.performedByUserId,
    sucursalId: params.sucursalId,
    before: null,
    after: {
      productId: params.productId,
      reason: 'RETURNED_NOT_RESTOCKED',
      quantity: params.quantity,
      totalValue: Number(totalValue),
      sourceReturnItemId: params.sourceReturnItemId,
    },
    metadata: { type: 'WASTE', origin: 'RETURN' },
    tx,
  });
}

export async function findById(id: string): Promise<InventoryWasteResponse> {
  const waste = await inventoryWasteRepository.findById(id);

  if (!waste) {
    throw new NotFoundError('Merma');
  }

  return toInventoryWasteResponse(waste);
}

export async function findMany(
  query: ListInventoryWastesQuery,
): Promise<ListInventoryWastesResult> {
  const [items, total] = await inventoryWasteRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toInventoryWasteResponse(item)),
    total,
  };
}

/**
 * Elimina una merma (Bloque "Eliminación de Mermas", ADMIN únicamente —
 * ver `inventoryWaste.routes.ts::authorize(SystemRole.ADMIN)`). Exclusivo
 * para corregir errores de captura: NUNCA solo borra el documento de
 * negocio, siempre revierte primero el descuento de stock que esa merma
 * había aplicado — de lo contrario el registro desaparecería pero el
 * `Inventory.quantity` (y, si aplica, `Batch.availableQuantity`) quedarían
 * permanentemente reducidos sin ninguna explicación.
 *
 * Reversión vía el MISMO `recordMovement` compartido de siempre (cero
 * lógica de inventario nueva) — cantidad con signo opuesto a la merma
 * original, mismo `batchId`. Se etiqueta como `InventoryMovementType.
 * ADJUSTMENT`/`InventoryReferenceType.INVENTORY_ADJUSTMENT` (reutiliza el
 * catálogo existente en vez de introducir un valor nuevo — el campo es
 * texto libre en `schema.prisma`, pero no corresponde inventar un tipo de
 * referencia para un solo caso de uso): es, en los hechos, una corrección
 * administrativa del agregado, mismo concepto que un ajuste manual.
 *
 * Consistencia Inventory/Batch/Waste (corrección aprobada): si la merma
 * eliminada había dejado un lote en `DEPLETED` (saldo en 0) y la reversión
 * de arriba repuso saldo positivo, el lote vuelve a `ACTIVE`
 * automáticamente — `reopenBatchIfRestockedService` (regla 5, política de
 * estados de `batches/service.ts`), llamada DESPUÉS de `recordMovement`
 * (mismo `tx`, lee el saldo ya actualizado). Reutiliza la lógica ya dueña
 * de las transiciones de lote — ningún cálculo ni mecanismo paralelo
 * nuevo acá.
 *
 * Auditoría: `AuditAction.DELETE` sobre la entidad `InventoryWaste`, con
 * `before` (snapshot del registro eliminado) / `after: null` — mismo
 * criterio ya usado en el resto del proyecto para operaciones de borrado.
 */
export async function deleteWaste(id: string, performedByUserId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const waste = await inventoryWasteRepository.findById(id, tx);

    if (!waste) {
      throw new NotFoundError('Merma');
    }

    await recordMovement({
      tx,
      sucursalId: waste.sucursalId,
      productId: waste.productId,
      userId: performedByUserId,
      type: InventoryMovementType.ADJUSTMENT,
      quantity: Number(waste.quantity),
      referenceType: InventoryReferenceType.INVENTORY_ADJUSTMENT,
      referenceId: waste.id,
      reason: `Reversión por eliminación de merma (registro ${waste.id})`,
      batchId: waste.batchId,
    });

    // Consistencia Inventory/Batch/Waste (ver doc de función arriba):
    // reabre el lote si la reversión lo sacó de DEPLETED.
    if (waste.batchId) {
      await reopenBatchIfRestockedService(waste.batchId, tx);
    }

    await auditService.log({
      action: AuditAction.DELETE,
      entity: 'InventoryWaste',
      entityId: waste.id,
      userId: performedByUserId,
      sucursalId: waste.sucursalId,
      before: {
        productId: waste.productId,
        reason: waste.reason,
        quantity: Number(waste.quantity),
        totalValue: Number(waste.totalValue),
      },
      after: null,
      metadata: { type: 'WASTE_DELETE' },
      tx,
    });

    await inventoryWasteRepository.deleteById(id, tx);
  }, transactionConfig.standard);
}
