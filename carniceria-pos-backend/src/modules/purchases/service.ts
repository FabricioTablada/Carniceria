/**
 * modules/purchases/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de compras.
 *
 * Responsabilidades:
 *  - Validar existencia de la compra antes de leer/actualizar.
 *  - Validar que cada `productId` y `taxId` de los detalles exista en la
 *    base de datos antes de calcular totales.
 *  - Calcular `lineSubtotal`, `lineTax` y `lineTotal` por cada detalle, y
 *    `subtotal`, `taxTotal` y `total` para la compra, usando `quantity` y
 *    `unitCost` del cliente junto con la tasa del impuesto almacenada en la
 *    base de datos. Un backend de POS profesional nunca confia en totales
 *    calculados por el cliente; estos valores se recalculan siempre aqui,
 *    usando `Prisma.Decimal` (via `@/shared/utils/money`) para evitar
 *    errores de redondeo con numeros de punto flotante.
 *  - Al crear una compra que nace `RECEIVED`, registrar automaticamente un
 *    `InventoryMovement` de tipo `PURCHASE` por cada detalle, usando el
 *    servicio transversal `shared/services/inventoryMovement.service.ts`
 *    (`recordMovement`). Una compra que nace `DRAFT` o `CANCELLED` NO
 *    acredita inventario en `create()` -- solo lo hace mas adelante, si
 *    `update()` la transiciona a `RECEIVED` (Bloque LOTES-00: antes de esta
 *    correccion, `create()` acreditaba SIEMPRE sin condicionar al estado,
 *    y una compra que luego transicionaba a `RECEIVED` via `update()`
 *    quedaba acreditada dos veces). La creacion de la compra y el registro
 *    de sus movimientos ocurren dentro de una unica transaccion
 *    (`prisma.$transaction`): no puede existir una `Purchase` `RECEIVED`
 *    sin sus `InventoryMovement` correspondientes, ni viceversa. Este
 *    servicio abre la transaccion y coordina los repositorios
 *    (`purchases.repository.ts` e, indirectamente a traves de
 *    `recordMovement`, los repositorios de `Inventory` e
 *    `InventoryMovement`); nunca ejecuta una consulta de modelo Prisma
 *    directamente.
 *  - Traducir los registros de Prisma a la forma publica `PurchaseResponse`,
 *    incluyendo sus detalles (`items`).
 *
 * Toda consulta a la base de datos se hace a traves de
 * `purchases.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 *
 * NOTA: `Purchase` no tiene ninguna restriccion `@@unique` en `schema.prisma`,
 * por lo que este servicio no valida duplicados (a diferencia de Categories,
 * Products, Taxes, Suppliers e Inventory).
 */
import { InventoryMovementType, Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { transactionConfig } from '@/config';
import { NotFoundError, ValidationError } from '@/shared/errors';
import { InventoryReferenceType } from '@/shared/constants';
import { addMoney, multiplyMoney, roundMoney, toMoney, type Money } from '@/shared/utils/money';
import {
  recordMovements,
  type RecordMovementParams,
} from '@/shared/services/inventoryMovement.service';
import * as inventoryRepository from '@/modules/inventory/repository';
import { createBatchService, findBatchByPurchaseItemIdService } from '@/modules/batches';
import * as purchasesRepository from './repository';
import type {
  CreatePurchaseDto,
  CreatePurchaseItemDto,
  ListPurchasesQuery,
  ListPurchasesResult,
  PurchaseItemProductSummary,
  PurchaseItemResponse,
  PurchaseItemTaxSummary,
  PurchaseResponse,
  PurchaseStatus,
  UpdatePurchaseDto,
} from './types';

/** Forma minima que debe tener el detalle de compra de Prisma para mapearlo. */
type PurchaseItemRecord = {
  id: string;
  productId: string;
  taxId: string | null;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  // Bloque COST-06.1: ver `PurchaseItemResponse.expectedWastePercent`.
  expectedWastePercent: Prisma.Decimal | null;
  // Bloque LOTES-09: ver `PurchaseItemResponse.supplierLotCode`/
  // `productionDate`/`expiryDate`.
  supplierLotCode: string | null;
  productionDate: Date | null;
  expiryDate: Date | null;
  lineSubtotal: Prisma.Decimal;
  lineTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  // Bloque Motor de Documentos (PURCHASE_ORDER): ver
  // `PurchaseItemResponse.product`/`.tax`.
  product: PurchaseItemProductSummary;
  tax: PurchaseItemTaxSummary | null;
};

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type PurchaseRecord = {
  id: string;
  sucursalId: string;
  supplierId: string;
  userId: string;
  documentNumber: string | null;
  status: string;
  purchaseDate: Date;
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  notes: string | null;
  sucursal: { id: string; code: string; name: string };
  supplier: { id: string; name: string };
  user: { id: string; fullName: string };
  items: PurchaseItemRecord[];
  createdAt: Date;
  updatedAt: Date;
};

/** Detalle de compra ya calculado, listo para persistirse. */
type ComputedPurchaseItem = {
  productId: string;
  taxId: string | null;
  quantity: number;
  unitCost: number;
  taxRate: number;
  // Bloque COST-06.1: pasa tal cual desde `CreatePurchaseItemDto`, sin
  // ningun calculo — ver `PurchaseItemResponse.expectedWastePercent`.
  expectedWastePercent: number | null;
  // Bloque LOTES-09: pasa tal cual desde `CreatePurchaseItemDto`, sin
  // ningun calculo — ver `PurchaseItemResponse.supplierLotCode`/
  // `productionDate`/`expiryDate`.
  supplierLotCode: string | null;
  productionDate: Date | null;
  expiryDate: Date | null;
  lineSubtotal: Money;
  lineTax: Money;
  lineTotal: Money;
};

/** Traduce un detalle de compra de Prisma a la forma publica. */
function toPurchaseItemResponse(item: PurchaseItemRecord): PurchaseItemResponse {
  return {
    id: item.id,
    productId: item.productId,
    taxId: item.taxId,
    quantity: Number(item.quantity),
    unitCost: Number(item.unitCost),
    taxRate: Number(item.taxRate),
    expectedWastePercent:
      item.expectedWastePercent !== null ? Number(item.expectedWastePercent) : null,
    supplierLotCode: item.supplierLotCode,
    productionDate: item.productionDate,
    expiryDate: item.expiryDate,
    lineSubtotal: Number(item.lineSubtotal),
    lineTax: Number(item.lineTax),
    lineTotal: Number(item.lineTotal),
    product: item.product,
    tax: item.tax,
  };
}

/** Traduce un registro de Prisma a la forma publica de la compra. */
function toPurchaseResponse(purchase: PurchaseRecord): PurchaseResponse {
  return {
    id: purchase.id,
    sucursalId: purchase.sucursalId,
    supplierId: purchase.supplierId,
    userId: purchase.userId,
    documentNumber: purchase.documentNumber,
    status: purchase.status as PurchaseStatus,
    purchaseDate: purchase.purchaseDate,
    subtotal: Number(purchase.subtotal),
    taxTotal: Number(purchase.taxTotal),
    total: Number(purchase.total),
    notes: purchase.notes,
    sucursal: purchase.sucursal,
    supplier: purchase.supplier,
    user: purchase.user,
    items: purchase.items.map((item) => toPurchaseItemResponse(item)),
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
  };
}

/**
 * Valida que cada producto referenciado en `items` exista, y calcula los
 * importes de cada detalle (`lineSubtotal`, `lineTax`, `lineTotal`) usando
 * `quantity` y `unitCost` recibidos del cliente junto con la tasa real del
 * impuesto almacenada en la base de datos. Si un detalle no indica `taxId`,
 * se considera un detalle sin impuesto (`lineTax = 0`).
 */
async function computeItems(items: CreatePurchaseItemDto[]): Promise<ComputedPurchaseItem[]> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await purchasesRepository.findProductsByIds(productIds);
  const missingProductId = productIds.find(
    (productId) => !products.some((product) => product.id === productId),
  );

  if (missingProductId) {
    throw new NotFoundError('Producto');
  }

  const taxIds = [
    ...new Set(items.map((item) => item.taxId).filter((taxId): taxId is string => Boolean(taxId))),
  ];
  const taxes = taxIds.length > 0 ? await purchasesRepository.findTaxesByIds(taxIds) : [];
  const missingTaxId = taxIds.find((taxId) => !taxes.some((tax) => tax.id === taxId));

  if (missingTaxId) {
    throw new NotFoundError('Impuesto');
  }

  const taxRateById = new Map(taxes.map((tax) => [tax.id, tax.rate]));

  return items.map((item) => {
    const lineSubtotal = multiplyMoney(toMoney(item.unitCost), item.quantity);
    const rate = item.taxId ? taxRateById.get(item.taxId) : undefined;
    const lineTax = rate ? multiplyMoney(lineSubtotal, rate).div(100) : toMoney(0);
    const lineTotal = addMoney(lineSubtotal, lineTax);

    return {
      productId: item.productId,
      taxId: item.taxId ?? null,
      quantity: item.quantity,
      unitCost: item.unitCost,
      taxRate: rate ? Number(rate) : 0,
      expectedWastePercent: item.expectedWastePercent ?? null,
      supplierLotCode: item.supplierLotCode ?? null,
      productionDate: item.productionDate ?? null,
      expiryDate: item.expiryDate ?? null,
      lineSubtotal,
      lineTax,
      lineTotal,
    };
  });
}

/** Forma minima que necesita `updateProductCostsFromPurchase`/
 * `recordMovements` de cada linea de compra ya recibida — ver justificacion
 * completa en `updateProductCostsFromPurchase`. */
type PurchaseCostLine = {
  productId: string;
  quantity: number;
  unitCost: number;
};

/**
 * Bloque 14.8 (Actualizacion automatica de costos): recalcula `Product.cost`
 * de cada producto de la compra usando costo promedio ponderado. La llaman
 * `create()` (compra que NACE `RECEIVED`) y `update()` (compra que
 * TRANSICIONA a `RECEIVED`, Bloque 14.8 correccion) — nunca para `DRAFT`/
 * `CANCELLED` (ver cada punto de llamada). Corre DENTRO de la misma
 * transaccion que registra la recepcion, ANTES de `recordMovements`: la
 * formula necesita el stock PREVIO a esta compra, no el ya incrementado.
 *
 * `items` es deliberadamente mas angosto que `ComputedPurchaseItem` (solo
 * `productId`/`quantity`/`unitCost`, los 3 campos que esta funcion
 * realmente usa): `create()` le pasa `ComputedPurchaseItem[]` tal cual (ya
 * satisface esta forma, estructuralmente), y `update()` le pasa los
 * `PurchaseItem` YA EXISTENTES de la compra (que no vuelven a calcularse,
 * solo se leen) traducidos a esta misma forma minima — sin duplicar la
 * logica de calculo del promedio ponderado en dos lugares.
 *
 * Formula aprobada (Bloque 14.8):
 *   nuevoCosto = ((stockActual * costoActual) + (cantidadComprada * costoCompra))
 *                / (stockActual + cantidadComprada)
 *
 * Si el producto no tiene inventario previo en esta sucursal (sin fila de
 * `Inventory`, o con `quantity: 0`), `stockActual` es 0 y la formula se
 * reduce matematicamente al costo de compra — mismo resultado que pide la
 * regla "Product.cost debe tomar directamente el costo de compra", sin
 * necesidad de una rama separada mas que evitar la division por el caso
 * imposible `stockActual + cantidadComprada = 0` (`cantidadComprada` es
 * siempre positiva, validada por `CreatePurchaseItemSchema`).
 *
 * Si una compra tiene mas de un detalle para el mismo producto, se agregan
 * ANTES de aplicar la formula (una sola escritura por producto, con la
 * cantidad total y el costo promedio ponderado de esas lineas) — evita que
 * el resultado dependa del ORDEN en que el cliente envio los detalles.
 *
 * NUNCA toca `SaleItem.unitCost` (Bloque 14.2) ni `InventoryWaste` (Bloque
 * 14.6): escribe unicamente `Product.cost`, el dato MAESTRO vigente — un
 * documento historico ya persistido nunca se recalcula.
 */
async function updateProductCostsFromPurchase(
  sucursalId: string,
  items: PurchaseCostLine[],
  tx: DbClient,
): Promise<void> {
  const purchasedByProductId = new Map<string, { quantity: Money; totalCost: Money }>();

  for (const item of items) {
    const lineQuantity = toMoney(item.quantity);
    const lineCost = multiplyMoney(lineQuantity, item.unitCost);
    const existing = purchasedByProductId.get(item.productId);

    purchasedByProductId.set(
      item.productId,
      existing
        ? { quantity: addMoney(existing.quantity, lineQuantity), totalCost: addMoney(existing.totalCost, lineCost) }
        : { quantity: lineQuantity, totalCost: lineCost },
    );
  }

  const productIds = [...purchasedByProductId.keys()];

  const [currentCosts, currentStock] = await Promise.all([
    purchasesRepository.findProductCostsByIds(productIds, tx),
    inventoryRepository.findManyByProductsAndSucursal(productIds, sucursalId, tx),
  ]);

  const currentCostByProductId = new Map(currentCosts.map((product) => [product.id, product.cost]));
  const currentStockByProductId = new Map(
    currentStock.map((inventory) => [inventory.productId, toMoney(inventory.quantity)]),
  );

  for (const [productId, purchased] of purchasedByProductId) {
    const currentStockQuantity = currentStockByProductId.get(productId) ?? toMoney(0);
    const currentCost = currentCostByProductId.get(productId) ?? toMoney(0);

    // Auditoria de riesgos criticos (Hallazgo 4, 07/08/2026): red de
    // seguridad adicional -- el Bloque 1 (bloqueo atomico de stock en
    // Devoluciones/Cancelacion de Compras/Mermas) ya reduce drasticamente
    // la posibilidad de que `Inventory.quantity` llegue a negativo, pero
    // esta formula NUNCA debe asumir que "eso no puede pasar": si de
    // todas formas llegara un estado invalido (stock negativo, o una suma
    // que anule el denominador de la formula), se detecta ANTES de
    // dividir y se aborta con un error claro -- nunca con la excepcion
    // cruda de `Prisma.Decimal` ante una division por cero. `purchased.quantity`
    // ya viene validado (> 0) por `CreatePurchaseItemSchema`, pero se
    // verifica igual aca por la misma razon: no depender de que otra capa
    // ya lo haya garantizado. Ningun caso valido (stock >= 0, cantidad
    // comprada > 0, como es siempre hoy) cambia de resultado con este
    // agregado.
    if (currentStockQuantity.isNegative()) {
      throw new ValidationError(
        `No se puede actualizar el costo promedio de "${productId}": el inventario actual (${currentStockQuantity.toString()}) es negativo, un estado invalido para este calculo.`,
      );
    }

    if (!purchased.quantity.greaterThan(0)) {
      throw new ValidationError(
        `No se puede actualizar el costo promedio de "${productId}": la cantidad comprada debe ser mayor a 0.`,
      );
    }

    const denominator = addMoney(currentStockQuantity, purchased.quantity);

    if (!denominator.greaterThan(0)) {
      throw new ValidationError(
        `No se puede actualizar el costo promedio de "${productId}": el calculo resultaria en una division por cero.`,
      );
    }

    const averagePurchaseUnitCost = purchased.totalCost.div(purchased.quantity);

    const newCost = currentStockQuantity.isZero()
      ? averagePurchaseUnitCost
      : addMoney(multiplyMoney(currentStockQuantity, currentCost), purchased.totalCost).div(denominator);

    await purchasesRepository.updateProductCost(productId, roundMoney(newCost), tx);
  }
}

/**
 * Bloque LOTES-02 (Modulo de Lotes, integracion con Compras): crea
 * automaticamente un `Batch` por cada linea de una compra que queda
 * `RECEIVED`, UNICAMENTE para productos con `Product.requiresBatch = true`
 * -- un producto sin ese flag no genera ningun lote, exactamente el mismo
 * comportamiento que antes de este bloque. Reutiliza `createBatchService`
 * (modulo `batches`, LOTES-01) dentro de la MISMA transaccion (`tx`) que
 * recibe la compra: si algo falla despues, ni la compra, ni sus
 * movimientos, ni los lotes recien creados quedan persistidos.
 *
 * Idempotencia por `purchaseItemId`: la garantiza `createBatchService` en
 * si mismo (ver ese archivo, `batches/service.ts::create`) -- esta funcion
 * no necesita verificarlo por su cuenta, solo invocarlo.
 *
 * Devuelve un mapa `purchaseItemId -> batchId`, para que el llamador
 * etiquete cada `InventoryMovement` de `recordMovements` con el lote que
 * genero (parametro opcional `batchId`, ver
 * `shared/services/inventoryMovement.service.ts`) -- asi
 * `Batch.availableQuantity` queda sincronizado con `Inventory.quantity`
 * desde el mismo movimiento que acredita la compra, sin una segunda
 * escritura aparte.
 */
async function createBatchesForReceivedPurchase(
  purchase: { sucursalId: string; supplierId: string; purchaseDate: Date },
  items: PurchaseItemRecord[],
  tx: DbClient,
): Promise<Map<string, string>> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await purchasesRepository.findProductBatchFlagsByIds(productIds, tx);
  const requiresBatchByProductId = new Map(
    products.map((product) => [product.id, product.requiresBatch]),
  );

  const batchIdByPurchaseItemId = new Map<string, string>();

  for (const item of items) {
    if (!requiresBatchByProductId.get(item.productId)) {
      continue;
    }

    const batch = await createBatchService(
      {
        productId: item.productId,
        sucursalId: purchase.sucursalId,
        purchaseItemId: item.id,
        supplierId: purchase.supplierId,
        receivedAt: purchase.purchaseDate,
        initialQuantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        expectedWastePercent:
          item.expectedWastePercent !== null ? Number(item.expectedWastePercent) : null,
        // Bloque LOTES-09: trazabilidad capturada en la linea de compra,
        // propagada tal cual -- `createBatchService` (`batches/service.ts::create`)
        // ya valida el orden de fechas contra `receivedAt` (esta misma
        // `purchase.purchaseDate`), asi que esa regla NO se duplica aca.
        supplierLotCode: item.supplierLotCode,
        productionDate: item.productionDate,
        expiryDate: item.expiryDate,
      },
      tx,
    );

    batchIdByPurchaseItemId.set(item.id, batch.id);
  }

  return batchIdByPurchaseItemId;
}

export async function create(dto: CreatePurchaseDto): Promise<PurchaseResponse> {
  const created = await prisma.$transaction(async (tx) => {
    const computedItems = await computeItems(dto.items);

    const subtotal = computedItems.reduce(
      (accumulated, item) => addMoney(accumulated, item.lineSubtotal),
      toMoney(0),
    );
    const taxTotal = computedItems.reduce(
      (accumulated, item) => addMoney(accumulated, item.lineTax),
      toMoney(0),
    );
    const total = addMoney(subtotal, taxTotal);

    const purchase = await purchasesRepository.create(
      {
        sucursalId: dto.sucursalId,
        supplierId: dto.supplierId,
        userId: dto.userId,
        documentNumber: dto.documentNumber ?? null,
        status: dto.status,
        purchaseDate: dto.purchaseDate,
        subtotal,
        taxTotal,
        total,
        notes: dto.notes ?? null,
        items: {
          create: computedItems.map((item) => ({
            productId: item.productId,
            taxId: item.taxId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            taxRate: item.taxRate,
            // Bloque COST-06.1: se persiste tal cual, sin ningun calculo
            // ni participacion en `updateProductCostsFromPurchase` (esa
            // funcion sigue leyendo unicamente `unitCost`/`quantity`, ver
            // `PurchaseCostLine` mas abajo en este archivo).
            expectedWastePercent: item.expectedWastePercent,
            // Bloque LOTES-09: se persiste tal cual, sin ningun calculo --
            // `createBatchesForReceivedPurchase` los lee de vuelta desde
            // `purchase.items` (recien creados) para propagarlos al
            // `Batch` automatico.
            supplierLotCode: item.supplierLotCode,
            productionDate: item.productionDate,
            expiryDate: item.expiryDate,
            lineSubtotal: item.lineSubtotal,
            lineTax: item.lineTax,
            lineTotal: item.lineTotal,
          })),
        },
      },
      tx,
    );

    // Bloque LOTES-00 (correccion de doble acreditacion de inventario):
    // tanto el recalculo de costo como el registro de movimientos SOLO
    // deben ocurrir cuando la compra queda `RECEIVED` (se lee
    // `purchase.status` ya persistido, no `dto.status`: si el cliente no lo
    // envio, Prisma aplico el `@default(DRAFT)` del schema, y ese es el
    // valor real). Antes de esta correccion, `recordMovements` se ejecutaba
    // SIEMPRE, sin este condicional -- una compra creada en `DRAFT` (o
    // incluso `CANCELLED`) ya acreditaba stock de inmediato, y si luego se
    // editaba a `RECEIVED`, `update()` (mas abajo en este archivo, sin
    // cambios) volvia a acreditar las mismas cantidades una segunda vez.
    // `updateProductCostsFromPurchase` va ANTES de `recordMovements` dentro
    // del mismo `if`: necesita el stock PREVIO a esta compra, no el ya
    // incrementado por el movimiento.
    if (purchase.status === 'RECEIVED') {
      await updateProductCostsFromPurchase(purchase.sucursalId, computedItems, tx);

      // Bloque LOTES-02: crea los lotes automaticos ANTES de
      // `recordMovements` -- necesita sus `id` ya generados para poder
      // etiquetar cada movimiento con `batchId` en la misma pasada. Usa
      // `purchase.items` (las lineas YA PERSISTIDAS, con `id` real) en vez
      // de `computedItems` (el DTO previo a la creacion, sin `id`).
      const batchIdByPurchaseItemId = await createBatchesForReceivedPurchase(
        purchase,
        purchase.items,
        tx,
      );

      await recordMovements(
        purchase.items.map((item) => ({
          tx,
          sucursalId: purchase.sucursalId,
          productId: item.productId,
          userId: purchase.userId,
          type: InventoryMovementType.PURCHASE,
          quantity: Number(item.quantity),
          referenceType: InventoryReferenceType.PURCHASE,
          referenceId: purchase.id,
          batchId: batchIdByPurchaseItemId.get(item.id) ?? null,
          // El lote recien creado ya nace con `availableQuantity =
          // initialQuantity` (la cantidad de ESTA MISMA recepcion) --
          // aplicarle ademas el incremento generico de este movimiento lo
          // duplicaria (ver `skipBatchQuantitySync` en
          // `shared/services/inventoryMovement.service.ts`).
          skipBatchQuantitySync: batchIdByPurchaseItemId.has(item.id),
          reason: null,
        })),
      );
    }

    return purchase;
  }, transactionConfig.bulk);

  return toPurchaseResponse(created);
}

export async function findById(id: string): Promise<PurchaseResponse> {
  const purchase = await purchasesRepository.findById(id);

  if (!purchase) {
    throw new NotFoundError('Compra');
  }

  return toPurchaseResponse(purchase);
}

export async function findMany(query: ListPurchasesQuery): Promise<ListPurchasesResult> {
  const [items, total] = await purchasesRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toPurchaseResponse(item)),
    total,
  };
}

/**
 * Bloque 14.8 (correccion): a diferencia de `create()`, `update()` puede
 * ser el punto donde una compra REALMENTE se recibe — el formulario de
 * edicion (`EditPurchaseForm.tsx`, frontend) expone el mismo selector de
 * estado que el de creacion, asi que "crear en Borrador -> editar a
 * Recibida" es un flujo real, no hipotetico (ver evidencia entregada antes
 * de esta correccion). Se detecta la transicion comparando el estado
 * PREVIO (`existing.status`, leido de la base de datos) contra el nuevo
 * (`dto.status`) — nunca solo `dto.status === 'RECEIVED'` a secas, porque
 * eso tambien seria verdadero si el cliente reenvia el mismo estado sobre
 * una compra YA `RECEIVED` (ej. el usuario guarda el formulario de edicion
 * sin cambiar nada mas), y volver a ejecutar `recordMovements`/
 * `updateProductCostsFromPurchase` en ese caso duplicaria el stock
 * acreditado y el recalculo de costo de una compra que ya los aplico una
 * vez.
 */
export async function update(id: string, dto: UpdatePurchaseDto): Promise<PurchaseResponse> {
  const existing = await purchasesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Compra');
  }

  const isTransitioningToReceived = dto.status === 'RECEIVED' && existing.status !== 'RECEIVED';

  // QA.4 (bug real encontrado y corregido): cancelar una compra YA
  // `RECEIVED` caía en la rama generica de abajo (`!isTransitioningToReceived`),
  // que solo actualiza el campo `status` -- dejaba el stock ya acreditado,
  // el costo promedio ya recalculado y los lotes ya creados exactamente
  // como estaban, como si la cancelacion nunca hubiera revertido nada
  // (verificado empiricamente: `Inventory.quantity`/`Product.cost` seguian
  // reflejando la compra despues de cancelarla). Se revierte aqui, dentro
  // de una transaccion, con el MISMO mecanismo (`recordMovements`) y el
  // mismo criterio de "releer el stock real DENTRO de la transaccion" que
  // `voidSaleTransaction` (`sales/service.ts`) y `deleteWaste`
  // (`inventoryWaste/service.ts`) ya usan para revertir un movimiento de
  // inventario previamente aplicado -- no se inventa un mecanismo nuevo.
  // NO revierte `Product.cost` (el promedio ponderado no es invertible con
  // precision si hubo compras posteriores sobre el mismo producto; mismo
  // criterio ya documentado en `updateProductCostsFromPurchase`: un dato
  // historico/derivado nunca se recalcula retroactivamente).
  const isCancellingReceivedPurchase = dto.status === 'CANCELLED' && existing.status === 'RECEIVED';

  const updateData: Prisma.PurchaseUncheckedUpdateInput = {
    supplierId: dto.supplierId,
    documentNumber: dto.documentNumber,
    status: dto.status,
    purchaseDate: dto.purchaseDate,
    notes: dto.notes,
  };

  if (isCancellingReceivedPurchase) {
    const updated = await prisma.$transaction(async (tx) => {
      // El stock a revertir debe alcanzar: si parte de esta compra ya se
      // vendio, mermo o se ajusto hacia abajo desde que se recibio,
      // revertirla dejaria `Inventory.quantity` negativo.
      //
      // Auditoria de riesgos criticos (Hallazgo 1, 07/08/2026): antes, esta
      // verificacion leia el stock actual con un `SELECT` simple
      // (`findManyByProductsAndSucursal`) y decidia en memoria — sin
      // bloqueo de fila, una venta/merma/otra cancelacion concurrente sobre
      // el mismo producto podia colarse entre esa lectura y el descuento
      // real (`recordMovements`, mas abajo), dejando `Inventory.quantity`
      // negativo. Mismo patron atomico ya aprobado y probado en Ventas
      // (`assertSufficientStock`/`reserveIfSufficient`): un `UPDATE`
      // condicional por producto que no cambia el valor, pero SI toma el
      // bloqueo de fila hasta el commit/rollback de esta transaccion.
      const requiredByProductId = new Map<string, number>();
      for (const item of existing.items) {
        requiredByProductId.set(
          item.productId,
          (requiredByProductId.get(item.productId) ?? 0) + Number(item.quantity),
        );
      }

      for (const [productId, requiredQuantity] of requiredByProductId) {
        const reservation = await inventoryRepository.reserveIfSufficient(
          productId,
          existing.sucursalId,
          requiredQuantity,
          tx,
        );

        if (reservation.count === 0) {
          // Sin stock suficiente — lectura puntual solo para el mensaje de
          // error, mismo criterio que `assertSufficientStock`.
          const inventory = await inventoryRepository.findByProductAndSucursal(
            productId,
            existing.sucursalId,
            tx,
          );
          const availableQuantity = inventory ? Number(inventory.quantity) : 0;
          const productName =
            existing.items.find((item) => item.productId === productId)?.product.name ?? productId;

          throw new ValidationError(
            `No se puede cancelar la compra: "${productName}" tiene menos existencia disponible ` +
              `(${availableQuantity}) que la cantidad a revertir de esta compra (${requiredQuantity}) ` +
              '-- parte de ese stock ya se vendió, transfirió o mermó.',
          );
        }
      }

      const updatedPurchase = await purchasesRepository.update(id, updateData, tx);

      const movementParams: RecordMovementParams[] = [];

      for (const item of existing.items) {
        // El lote que ESTA compra generó (si el producto usa control por
        // lotes) -- `Batch.purchaseItemId` es único, mismo mecanismo que
        // `createBatchesForReceivedPurchase` usa para la idempotencia de
        // creación. `recordMovement` (via `applyBatchMovement`) aplica el
        // mismo decremento atómico sobre `Batch.availableQuantity` cuando
        // se le pasa `batchId` -- sin `skipBatchQuantitySync` esta vez,
        // porque aquí SÍ queremos que el lote reciba el ajuste (a
        // diferencia de su creación, que ya nace con el saldo correcto).
        const batch = await findBatchByPurchaseItemIdService(item.id, tx);

        movementParams.push({
          tx,
          sucursalId: updatedPurchase.sucursalId,
          productId: item.productId,
          userId: updatedPurchase.userId,
          type: InventoryMovementType.ADJUSTMENT,
          quantity: -Number(item.quantity),
          referenceType: InventoryReferenceType.INVENTORY_ADJUSTMENT,
          referenceId: updatedPurchase.id,
          batchId: batch?.id ?? null,
          reason: 'Reversión por cancelación de compra recibida',
        });
      }

      await recordMovements(movementParams);

      return updatedPurchase;
    }, transactionConfig.bulk);

    return toPurchaseResponse(updated);
  }

  if (!isTransitioningToReceived) {
    const updated = await purchasesRepository.update(id, updateData);

    return toPurchaseResponse(updated);
  }

  // Misma logica que `create()` cuando una compra NACE `RECEIVED` (ver esa
  // funcion): recalculo de costo ANTES de `recordMovements` (necesita el
  // stock previo a esta recepcion), todo dentro de una unica transaccion —
  // si cualquier paso falla, ni el cambio de estado, ni el recalculo de
  // costo, ni el movimiento de inventario quedan persistidos.
  const receivedItems: PurchaseCostLine[] = existing.items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity),
    unitCost: Number(item.unitCost),
  }));

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPurchase = await purchasesRepository.update(id, updateData, tx);

    await updateProductCostsFromPurchase(updatedPurchase.sucursalId, receivedItems, tx);

    // Bloque LOTES-02: mismo criterio que `create()` -- usa `existing.items`
    // (las lineas YA PERSISTIDAS, con `id` real) en vez de `receivedItems`
    // (que solo tiene `productId`/`quantity`/`unitCost`, la forma minima
    // que `updateProductCostsFromPurchase` necesita).
    const batchIdByPurchaseItemId = await createBatchesForReceivedPurchase(
      updatedPurchase,
      existing.items,
      tx,
    );

    await recordMovements(
      existing.items.map((item) => ({
        tx,
        sucursalId: updatedPurchase.sucursalId,
        productId: item.productId,
        userId: updatedPurchase.userId,
        type: InventoryMovementType.PURCHASE,
        quantity: Number(item.quantity),
        referenceType: InventoryReferenceType.PURCHASE,
        referenceId: updatedPurchase.id,
        batchId: batchIdByPurchaseItemId.get(item.id) ?? null,
        // Mismo motivo que en `create()`: el lote recien creado ya nace
        // con `availableQuantity = initialQuantity`.
        skipBatchQuantitySync: batchIdByPurchaseItemId.has(item.id),
        reason: null,
      })),
    );

    return updatedPurchase;
  }, transactionConfig.bulk);

  return toPurchaseResponse(updated);
}