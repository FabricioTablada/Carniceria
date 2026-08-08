/**
 * modules/returns/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de devoluciones (Bloque 4.2).
 *
 * Responsabilidades:
 *  - Validar que la venta exista, no este anulada y no haya sido reemplazada
 *    por una correccion (Bloque 3) antes de aceptar una devolucion contra
 *    ella.
 *  - Validar que cada linea devuelta pertenezca realmente a esa venta.
 *  - Validar, DENTRO de la transaccion (no antes de abrirla), que la
 *    cantidad devuelta — sumada a lo ya devuelto en devoluciones previas de
 *    esa misma linea — nunca supere la cantidad original vendida. Nunca se
 *    confia en cantidades enviadas por el cliente sin releer el estado real
 *    de la base de datos.
 *  - Calcular el `lineTotal`/`totalAmount` de la devolucion (snapshot,
 *    prorrateado sobre el `lineTotal` original de cada `SaleItem` — incluye
 *    proporcionalmente el descuento/impuesto de esa linea, no solo
 *    cantidad * precio de lista).
 *  - Reversar inventario reutilizando el servicio transversal
 *    `shared/services/inventoryMovement.service.ts` (`recordMovement`, tipo
 *    `RETURN`) — sin duplicar logica de inventario. Ver nota de
 *    `restock`/merma mas abajo: NO toda devolucion incrementa el stock
 *    automaticamente.
 *  - Registrar el movimiento de caja del reembolso (`CashMovement`, tipo
 *    `REFUND`) solo cuando `refundMethod` es efectivo — un reembolso por
 *    tarjeta/SINPE/transferencia no mueve efectivo del cajon, mismo
 *    criterio que ya aplica al calcular `expectedAmount` de una sesion
 *    (`cash/service.ts`, que solo suma ventas en `CASH`).
 *  - Auditar la devolucion con `shared/services/audit.service.ts`, dentro de
 *    la MISMA transaccion (via el parametro `tx` agregado en el Bloque 3).
 *  - Traducir los registros de Prisma a la forma publica `SaleReturnResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `returns.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { CashMovementType, InventoryMovementType, Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { transactionConfig } from '@/config';
import { AuditAction, InventoryReferenceType } from '@/shared/constants';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import { addMoney, toMoney, type Money } from '@/shared/utils/money';
import {
  recordMovements,
  type RecordMovementParams,
} from '@/shared/services/inventoryMovement.service';
import { auditService } from '@/shared/services/audit.service';
import { createWasteFromReturn } from '@/modules/inventoryWaste/service';
import { createBatchService } from '@/modules/batches';
import * as returnsRepository from './repository';
import type {
  CreateSaleReturnDto,
  CreateSaleReturnItemDto,
  ListSaleReturnsQuery,
  ListSaleReturnsResult,
  SaleReturnItemResponse,
  SaleReturnResponse,
} from './types';

/** Forma minima de detalle de venta necesaria para validar/calcular una
 * devolucion contra esa linea. */
type SaleItemForValidation = {
  id: string;
  productId: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  // Bloque LOTES-05: snapshot de costo de ESTA linea de venta (Bloque
  // 14.2, nullable para ventas anteriores a ese bloque) -- unico dato que
  // permite darle al lote de reingreso (ver `createReturnTransaction`) un
  // `unitCost` fiel al costo real de la unidad devuelta, en vez del costo
  // VIGENTE del producto (que pudo cambiar desde la venta).
  unitCost: Prisma.Decimal | null;
};

/** Forma minima de venta necesaria para validar una devolucion. */
type SaleForValidation = {
  id: string;
  sucursalId: string;
  status: string;
  items: SaleItemForValidation[];
  correctedBySale: { id: string } | null;
};

/** Forma minima de detalle de devolucion de Prisma para mapearlo.
 * `saleItem.productId` (Bloque 4.4): necesario para cruzar contra
 * `InventoryMovement` y reconstruir `restock` al leer — ver
 * `toSaleReturnItemResponse`. */
type SaleReturnItemRecord = {
  id: string;
  saleItemId: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  saleItem: { productId: string };
};

/** Forma minima de registro de devolucion de Prisma para mapearlo. */
type SaleReturnRecord = {
  id: string;
  saleId: string;
  sucursalId: string;
  cashSessionId: string;
  userId: string;
  reason: string;
  refundMethod: string;
  totalAmount: Prisma.Decimal;
  sucursal: { id: string; name: string };
  user: { id: string; fullName: string };
  items: SaleReturnItemRecord[];
  createdAt: Date;
  updatedAt: Date;
};

/** Detalle de devolucion ya calculado, listo para persistirse. */
type ComputedReturnItem = {
  saleItemId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: Money;
  /** Bloque 4.2 (ver `CreateSaleReturnItemDto` en `types.ts`): decision de
   * negocio todavia no cerrada — gobierna si esta linea emite o no el
   * `InventoryMovement` de reingreso, sin persistirse por linea. */
  restock: boolean;
  /** Bloque LOTES-05: snapshot de costo de la `SaleItem` original, ver
   * `SaleItemForValidation.unitCost`. */
  unitCost: Prisma.Decimal | null;
};

/** `restockedProductIds` (Bloque 4.4): productos de ESTA devolucion que si
 * generaron un `InventoryMovement` de reingreso — ver
 * `findRestockedProductIdsByReturnIds` en `returns.repository.ts`. Pura
 * lectura para mostrar el historial, no decide nada nuevo. */
function toSaleReturnItemResponse(
  item: SaleReturnItemRecord,
  restockedProductIds: Set<string>,
): SaleReturnItemResponse {
  return {
    id: item.id,
    saleItemId: item.saleItemId,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),
    restock: restockedProductIds.has(item.saleItem.productId),
  };
}

function toSaleReturnResponse(
  saleReturn: SaleReturnRecord,
  restockedProductIds: Set<string>,
): SaleReturnResponse {
  return {
    id: saleReturn.id,
    saleId: saleReturn.saleId,
    sucursalId: saleReturn.sucursalId,
    cashSessionId: saleReturn.cashSessionId,
    userId: saleReturn.userId,
    reason: saleReturn.reason,
    refundMethod: saleReturn.refundMethod as SaleReturnResponse['refundMethod'],
    totalAmount: Number(saleReturn.totalAmount),
    sucursal: saleReturn.sucursal,
    user: saleReturn.user,
    items: saleReturn.items.map((item) => toSaleReturnItemResponse(item, restockedProductIds)),
    createdAt: saleReturn.createdAt,
    updatedAt: saleReturn.updatedAt,
  };
}

/**
 * Valida y calcula cada linea de devolucion dentro de la transaccion:
 * relee cuanto ya se devolvio de cada `saleItemId` (`sumReturnedQuantityByItemIds`,
 * DENTRO de `tx`, no antes) y rechaza cualquier linea cuya cantidad
 * solicitada supere lo que realmente queda disponible para devolver en
 * este momento — nunca confia en el calculo que pudo haberse mostrado
 * previamente en el cliente.
 */
async function computeReturnItems(
  requestedItems: CreateSaleReturnItemDto[],
  saleItemById: Map<string, SaleItemForValidation>,
  tx: DbClient,
): Promise<ComputedReturnItem[]> {
  const requestedSaleItemIds = requestedItems.map((item) => item.saleItemId);

  // Auditoria de riesgos criticos (Hallazgo 1, 07/08/2026): bloquea las
  // filas de `SaleItem` involucradas ANTES de leer cuanto se devolvio
  // previamente — ver comentario completo en
  // `returnsRepository.lockSaleItemsForUpdate`. Sin esto, dos devoluciones
  // concurrentes de la misma linea podian leer ambas "0 ya devuelto" antes
  // de que cualquiera confirmara.
  await returnsRepository.lockSaleItemsForUpdate(requestedSaleItemIds, tx);

  const alreadyReturnedRows = await returnsRepository.sumReturnedQuantityByItemIds(
    requestedSaleItemIds,
    tx,
  );
  const alreadyReturnedByItemId = new Map(
    alreadyReturnedRows.map((row) => [row.saleItemId, Number(row._sum.quantity ?? 0)]),
  );

  return requestedItems.map((requestedItem) => {
    const saleItem = saleItemById.get(requestedItem.saleItemId);

    if (!saleItem) {
      throw new ValidationError(
        `La línea "${requestedItem.saleItemId}" no pertenece a esta venta.`,
      );
    }

    const originalQuantity = Number(saleItem.quantity);
    const alreadyReturnedQuantity = alreadyReturnedByItemId.get(saleItem.id) ?? 0;
    const remainingQuantity = originalQuantity - alreadyReturnedQuantity;

    if (requestedItem.quantity > remainingQuantity) {
      throw new ValidationError(
        `La cantidad a devolver de la línea "${saleItem.id}" (${requestedItem.quantity}) supera lo disponible para devolver (${remainingQuantity}).`,
      );
    }

    // Prorrateo: el `lineTotal` original de `SaleItem` ya incluye el
    // descuento y el impuesto de esa linea — se reparte proporcionalmente
    // por unidad para que el monto devuelto sea fiel a lo realmente
    // cobrado, no solo `cantidad * precio de lista`.
    const unitLineTotal = toMoney(saleItem.lineTotal).div(originalQuantity);
    const lineTotal = unitLineTotal.mul(requestedItem.quantity);

    return {
      saleItemId: saleItem.id,
      productId: saleItem.productId,
      quantity: requestedItem.quantity,
      unitPrice: Number(saleItem.unitPrice),
      lineTotal,
      // Ver nota de `restock` en `CreateSaleReturnItemDto` (types.ts): sin
      // decision de negocio cerrada, `true` es el default asumido hoy — no
      // una regla confirmada. No se fuerza a `true` incondicionalmente: el
      // cliente puede pasar `false` explicitamente.
      restock: requestedItem.restock ?? true,
      unitCost: saleItem.unitCost,
    };
  });
}

/**
 * Cuerpo transaccional del registro de una devolucion.
 *
 * Sprint QA 1 (fix de concurrencia): `sale` llega de una lectura hecha
 * ANTES de abrir esta transaccion (`createReturn`, mas abajo) — si en el
 * intervalo alguien anulo la venta o la reemplazo por una correccion
 * (`voidSale`/`correctSale`, que SI son atomicos desde este mismo Sprint),
 * esa lectura previa quedo desactualizada. Se releen `status`/
 * `correctedBySale` DENTRO de esta transaccion (con `tx`, viendo el estado
 * ya confirmado por cualquier transaccion que haya terminado antes) y se
 * aborta si cambiaron, antes de tocar inventario/caja/auditoria.
 */
async function createReturnTransaction(
  sale: SaleForValidation,
  dto: CreateSaleReturnDto,
  tx: DbClient,
): Promise<SaleReturnRecord> {
  const currentSale = await returnsRepository.findSaleForValidation(sale.id, tx);

  if (!currentSale) {
    throw new NotFoundError('Venta');
  }

  if (currentSale.status === 'CANCELLED') {
    throw new ConflictError(
      'La venta fue anulada por otra operación mientras se procesaba esta devolución.',
    );
  }

  if (currentSale.correctedBySale) {
    throw new ConflictError(
      'La venta fue corregida por otra operación mientras se procesaba esta devolución.',
    );
  }

  const saleItemById = new Map(sale.items.map((item) => [item.id, item]));
  const computedItems = await computeReturnItems(dto.items, saleItemById, tx);

  const totalAmount = computedItems.reduce(
    (accumulated, item) => addMoney(accumulated, item.lineTotal),
    toMoney(0),
  );

  const saleReturn = await returnsRepository.create(
    {
      saleId: sale.id,
      sucursalId: sale.sucursalId,
      cashSessionId: dto.cashSessionId,
      userId: dto.performedByUserId,
      reason: dto.reason,
      refundMethod: dto.refundMethod,
      totalAmount,
      items: {
        create: computedItems.map((item) => ({
          saleItemId: item.saleItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      },
    },
    tx,
  );

  // Bloque 2 (correccion de merma/trazabilidad): mapea cada linea
  // computada a la `SaleReturnItem` recien creada correspondiente —
  // `createWasteFromReturn` necesita el id PROPIO de esa linea (no el
  // `saleItemId`) para `sourceReturnItemId`.
  const saleReturnItemIdBySaleItemId = new Map(
    saleReturn.items.map((item) => [item.saleItemId, item.id]),
  );

  // Bloque LOTES-05 (integracion con Devoluciones): que productos de ESTA
  // devolucion, entre los que SI reingresan a stock (`restock: true`),
  // tienen `Product.requiresBatch` -- lectura DENTRO de esta transaccion
  // (mismo criterio que el resto de este archivo), acotada a esos
  // productos unicamente (las lineas `restock: false` nunca tocan lotes,
  // ver mas abajo). `costByProductId` es SOLO el respaldo para cuando la
  // `SaleItem.unitCost` original es `null` (ventas anteriores al Bloque
  // 14.2).
  const restockProductIds = [
    ...new Set(computedItems.filter((item) => item.restock).map((item) => item.productId)),
  ];
  const productBatchInfo =
    restockProductIds.length > 0
      ? await returnsRepository.findProductBatchInfoByIds(restockProductIds, tx)
      : [];
  const requiresBatchByProductId = new Map(
    productBatchInfo.map((product) => [product.id, product.requiresBatch]),
  );
  const costByProductId = new Map(productBatchInfo.map((product) => [product.id, product.cost]));

  // Las lineas restock=false (merma) siguen procesandose una por una via
  // `createWasteFromReturn`, en el mismo orden que antes -- esa funcion no
  // toca `Inventory`/`InventoryMovement`, asi que no interfiere con el
  // agrupamiento de abajo. Las lineas restock=true se acumulan y se
  // registran al final en UNA sola llamada batched (`recordMovements`), en
  // vez de una llamada a `recordMovement` por linea.
  const restockMovementParams: RecordMovementParams[] = [];

  for (const item of computedItems) {
    // Merma / no reincorporable: el producto no vuelve a stock vendible,
    // por lo que NO se emite `InventoryMovement` de tipo `RETURN` — pero
    // SI se registra la merma correspondiente (`createWasteFromReturn`,
    // `inventoryWaste/service.ts`) para trazabilidad completa venta →
    // devolucion → merma. Esa funcion, deliberadamente, NO llama a
    // `recordMovement`: la unidad nunca volvio a sumarse al stock, asi que
    // "mermarla" no debe restarlo una segunda vez (ver justificacion en
    // `inventoryWaste/service.ts`).
    if (!item.restock) {
      // `saleReturnItemIdBySaleItemId` se construyo a partir de las mismas
      // `computedItems` que crearon `saleReturn.items` (misma llamada,
      // mismo orden de claves) — la entrada siempre existe.
      const saleReturnItemId = saleReturnItemIdBySaleItemId.get(item.saleItemId)!;

      await createWasteFromReturn(
        {
          sucursalId: sale.sucursalId,
          productId: item.productId,
          performedByUserId: dto.performedByUserId,
          quantity: item.quantity,
          sourceReturnItemId: saleReturnItemId,
        },
        tx,
      );

      continue;
    }

    // Bloque LOTES-05: producto que SI usa lotes -- el reingreso NO puede
    // etiquetarse con el lote ORIGINAL del que salio (`SaleItem` no
    // registra de que lote(s) se desconto; una linea pudo dividirse FEFO
    // entre varios, ver analisis aprobado del bloque). Se crea un lote de
    // reingreso NUEVO reutilizando `batches/service.ts::create` (via el
    // barrel `@/modules/batches`, la misma funcion que usa Compras para el
    // alta automatica en LOTES-02) -- sin `purchaseItemId` ni `supplierId`
    // (no proviene de ninguna compra ni proveedor), `receivedAt` es el
    // momento de la devolucion (no la fecha de la venta original), y
    // `notes` deja constancia explicita del origen (infraestructura ya
    // existente, sin agregar ninguna columna nueva al esquema).
    if (requiresBatchByProductId.get(item.productId)) {
      const saleReturnItemId = saleReturnItemIdBySaleItemId.get(item.saleItemId)!;
      const unitCost =
        item.unitCost !== null
          ? Number(item.unitCost)
          : Number(costByProductId.get(item.productId) ?? 0);

      const reentryBatch = await createBatchService(
        {
          productId: item.productId,
          sucursalId: sale.sucursalId,
          receivedAt: new Date(),
          initialQuantity: item.quantity,
          unitCost,
          notes: `Reingreso por devolución de venta ${sale.id}, línea de devolución ${saleReturnItemId}.`,
        },
        tx,
      );

      restockMovementParams.push({
        tx,
        sucursalId: sale.sucursalId,
        productId: item.productId,
        userId: dto.performedByUserId,
        type: InventoryMovementType.RETURN,
        quantity: item.quantity,
        referenceType: InventoryReferenceType.SALE_RETURN,
        referenceId: saleReturn.id,
        reason: dto.reason,
        batchId: reentryBatch.id,
        // Mismo motivo que la creacion de lote en Compras (LOTES-02): este
        // lote de reingreso YA nace con `availableQuantity =
        // initialQuantity` (la cantidad devuelta) -- aplicar ADEMAS el
        // incremento generico de este movimiento lo duplicaria. Unica
        // otra excepcion a `skipBatchQuantitySync` fuera de Compras, ver
        // `shared/services/inventoryMovement.service.ts`.
        skipBatchQuantitySync: true,
      });

      continue;
    }

    restockMovementParams.push({
      tx,
      sucursalId: sale.sucursalId,
      productId: item.productId,
      userId: dto.performedByUserId,
      type: InventoryMovementType.RETURN,
      quantity: item.quantity,
      referenceType: InventoryReferenceType.SALE_RETURN,
      referenceId: saleReturn.id,
      reason: dto.reason,
    });
  }

  if (restockMovementParams.length > 0) {
    await recordMovements(restockMovementParams);
  }

  // Reembolso en efectivo: mueve dinero real del cajon, se registra como
  // `CashMovement` (tipo `REFUND`, agregado en el Bloque 4.1) para que
  // `cash/service.ts` pueda incorporarlo al arqueo el dia que se decida
  // (no se modifica `computeExpectedAmount` en este bloque — fuera de
  // alcance de "logica de negocio del modulo de devoluciones"). Tarjeta/
  // SINPE/transferencia no mueven efectivo del cajon: no generan
  // `CashMovement`, mismo criterio que ya aplica a las ventas por esos
  // medios.
  if (dto.refundMethod === 'CASH') {
    await returnsRepository.createCashMovement(
      {
        sucursalId: sale.sucursalId,
        cashSessionId: dto.cashSessionId,
        userId: dto.performedByUserId,
        type: CashMovementType.REFUND,
        amount: totalAmount,
        reason: dto.reason,
        referenceType: InventoryReferenceType.SALE_RETURN,
        referenceId: saleReturn.id,
      },
      tx,
    );
  }

  await auditService.log({
    // Sprint QA 3.3: reemplaza el uso generico de `AuditAction.SALE` (legacy,
    // ver `shared/constants/auditActions.constants.ts`) por la accion
    // especifica de devolucion.
    action: AuditAction.SALE_RETURN,
    entity: 'SaleReturn',
    entityId: saleReturn.id,
    userId: dto.performedByUserId,
    sucursalId: sale.sucursalId,
    before: null,
    after: {
      saleId: sale.id,
      refundMethod: dto.refundMethod,
      totalAmount: Number(totalAmount),
      items: computedItems.map((item) => ({
        saleItemId: item.saleItemId,
        quantity: item.quantity,
        restock: item.restock,
      })),
    },
    metadata: { type: 'RETURN', reason: dto.reason },
    tx,
  });

  return saleReturn;
}

/**
 * Registra una devolucion contra una venta. Validaciones previas a abrir la
 * transaccion (lecturas puras, mismo criterio que `sales.service.ts`): la
 * venta existe, no esta `CANCELLED`, no fue reemplazada por una correccion
 * (Bloque 3), y la sesion de caja que emite el reembolso existe. La
 * validacion de cantidad remanente por linea ocurre DENTRO de la
 * transaccion (`computeReturnItems`), releyendo el estado real — nunca se
 * confia en lo que el cliente haya calculado.
 */
export async function createReturn(dto: CreateSaleReturnDto): Promise<SaleReturnResponse> {
  const sale = await returnsRepository.findSaleForValidation(dto.saleId);

  if (!sale) {
    throw new NotFoundError('Venta');
  }

  if (sale.status === 'CANCELLED') {
    throw new ConflictError(
      'La venta está anulada, no se pueden registrar devoluciones contra ella.',
    );
  }

  if (sale.correctedBySale) {
    throw new ConflictError(
      'La venta fue reemplazada por una corrección, no se pueden registrar devoluciones contra ella.',
    );
  }

  const cashSession = await returnsRepository.findCashSessionById(dto.cashSessionId);

  if (!cashSession) {
    throw new NotFoundError('Sesión de caja');
  }

  const saleItemIds = new Set(sale.items.map((item) => item.id));
  const unknownItem = dto.items.find((item) => !saleItemIds.has(item.saleItemId));

  if (unknownItem) {
    throw new ValidationError(
      `La línea "${unknownItem.saleItemId}" no pertenece a esta venta.`,
    );
  }

  const created = await prisma.$transaction(
    (tx) => createReturnTransaction(sale, dto, tx),
    transactionConfig.bulk,
  );
  const restockedProductIds = await getRestockedProductIdsSet([created.id]);

  return toSaleReturnResponse(created, restockedProductIds);
}

export async function findById(id: string): Promise<SaleReturnResponse> {
  const saleReturn = await returnsRepository.findById(id);

  if (!saleReturn) {
    throw new NotFoundError('Devolución');
  }

  const restockedProductIds = await getRestockedProductIdsSet([id]);

  return toSaleReturnResponse(saleReturn, restockedProductIds);
}

export async function findMany(query: ListSaleReturnsQuery): Promise<ListSaleReturnsResult> {
  const [items, total] = await returnsRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  const restockedByReturnId = await getRestockedProductIdsByReturnId(items.map((item) => item.id));

  return {
    items: items.map((item) =>
      toSaleReturnResponse(item, restockedByReturnId.get(item.id) ?? new Set()),
    ),
    total,
  };
}

/** Bloque 4.4: agrupa los `InventoryMovement` de reingreso (ver
 * `findRestockedProductIdsByReturnIds`) por devolucion, para poder
 * reconstruir `restock` de cada linea al leer un listado. Pura lectura. */
async function getRestockedProductIdsByReturnId(
  saleReturnIds: string[],
): Promise<Map<string, Set<string>>> {
  const movements = await returnsRepository.findRestockedProductIdsByReturnIds(saleReturnIds);

  const byReturnId = new Map<string, Set<string>>();

  for (const movement of movements) {
    if (!movement.referenceId) {
      continue;
    }

    const productIds = byReturnId.get(movement.referenceId) ?? new Set<string>();
    productIds.add(movement.productId);
    byReturnId.set(movement.referenceId, productIds);
  }

  return byReturnId;
}

/** Variante de una sola devolucion (`findById`/`createReturn`) de
 * `getRestockedProductIdsByReturnId`. */
async function getRestockedProductIdsSet(saleReturnIds: string[]): Promise<Set<string>> {
  const movements = await returnsRepository.findRestockedProductIdsByReturnIds(saleReturnIds);

  return new Set(movements.map((movement) => movement.productId));
}
