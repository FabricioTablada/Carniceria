/**
 * modules/sales/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de ventas.
 *
 * Responsabilidades:
 *  - Validar existencia de la venta antes de leer/actualizar.
 *  - Validar existencia de la sucursal, el usuario y la sesion de caja
 *    referenciados por la venta.
 *  - Validar que cada `productId` y `taxId` de los detalles exista en la
 *    base de datos antes de calcular totales.
 *  - Validar que `documentNumber` no este duplicado dentro de la misma
 *    sucursal al crear o actualizar (restriccion
 *    `@@unique([sucursalId, documentNumber])` de `schema.prisma`), solo
 *    cuando el cliente lo proporciona.
 *  - Calcular `lineSubtotal`, `lineTax` y `lineTotal` por cada detalle, y
 *    `subtotal`, `taxTotal`, `discountTotal`, `total` y `changeGiven` para
 *    la venta, usando `quantity`, `unitPrice` y `discount` del cliente
 *    junto con la tasa del impuesto almacenada en la base de datos. Sigue
 *    exactamente el mismo patron aprobado en Purchases: un backend de POS
 *    nunca confia en totales calculados por el cliente; estos valores se
 *    calculan siempre aqui, usando `Prisma.Decimal` (via
 *    `@/shared/utils/money`) para evitar errores de redondeo con numeros
 *    de punto flotante.
 *  - Al crear una venta, registrar automaticamente un `InventoryMovement`
 *    de tipo `SALE` por cada detalle, con cantidad negativa (una venta
 *    reduce existencias, ver DATABASE.md: `quantity` con signo), usando el
 *    servicio transversal `shared/services/inventoryMovement.service.ts`
 *    (`recordMovement`). La creacion de la venta y el registro de sus
 *    movimientos ocurren dentro de una unica transaccion
 *    (`prisma.$transaction`): no puede existir una `Sale` sin sus
 *    `InventoryMovement` correspondientes, ni viceversa. Las validaciones
 *    de existencia de sucursal/usuario/sesion de caja y de duplicado de
 *    `documentNumber` son lecturas puras sin escritura asociada, por lo
 *    que se resuelven antes de abrir la transaccion (mismo criterio ya
 *    aplicado en Purchases). Este servicio abre la transaccion y coordina
 *    los repositorios (`sales.repository.ts` e, indirectamente a traves de
 *    `recordMovement`, los repositorios de `Inventory` e
 *    `InventoryMovement`); nunca ejecuta una consulta de modelo Prisma
 *    directamente.
 *  - Si el `documentNumber` fue autogenerado (el cliente no envio uno) y
 *    colisiona con un valor ya existente, reintenta la transaccion
 *    completa con un numero nuevo, hasta 5 veces, en vez de dejar que el
 *    error crudo de Postgres llegue sin traducir al cliente.
 *  - Traducir los registros de Prisma a la forma publica `SaleResponse`,
 *    incluyendo sus detalles (`items`).
 *
 * Toda consulta a la base de datos se hace a traves de
 * `sales.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { randomUUID } from 'node:crypto';
import { CashMovementType, InventoryMovementType, Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { transactionConfig } from '@/config';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import { addMoney, formatCRC, multiplyMoney, roundMoney, toMoney, type Money } from '@/shared/utils/money';
import {
  recordMovements,
  type RecordMovementParams,
} from '@/shared/services/inventoryMovement.service';
import { getEffectiveCost } from '@/shared/services/costEngine';
import { calculateLineProfitability, calculatePromotionSupplierContribution } from '@/shared/services/pricingAnalysis';
import type { LineProfitabilityAnalysis } from '@/shared/services/pricingAnalysis';
import * as inventoryRepository from '@/modules/inventory/repository';
import { createBatchService, findActiveBatchesForConsumption } from '@/modules/batches';
import {
  evaluateSalePromotions,
  type PromotionApplicationCartLine,
  type PromotionApplicationResult,
} from '@/modules/promotions';
import { enqueueSyncJob } from '@/modules/sync';
import * as salesRepository from './repository';
import type {
  CashSessionStatus,
  CorrectSaleDto,
  CorrectSaleResult,
  CreateSaleDto,
  CreateSaleItemDto,
  CreateSaleQuoteDto,
  ListSalesQuery,
  ListSalesResult,
  PaymentMethod,
  SaleAppliedPromotionResponse,
  SaleDiscountType,
  SaleItemResponse,
  SaleQuoteAppliedPromotion,
  SaleQuoteItemResponse,
  SaleQuoteResponse,
  SaleResponse,
  SaleStatus,
  UpdateSaleDto,
  VoidSaleDto,
} from './types';
import { AuditAction, InventoryReferenceType } from '@/shared/constants';
import { auditService } from '@/shared/services/audit.service';

/** Forma minima que debe tener el detalle de venta de Prisma para mapearlo.
 * `product`/`tax` (Bloque 3, "Detalle de Venta"): resumen resuelto por
 * `saleWithRelationsInclude`, no solo el id crudo. */
type SaleItemRecord = {
  id: string;
  productId: string;
  taxId: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  discount: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  // Bloque 14.2 (Costos Base): snapshot de costo, nullable (ventas previas
  // a este bloque no lo tienen — ver nota en `SaleItemResponse`).
  unitCost: Prisma.Decimal | null;
  product: { id: string; name: string; sku: string | null; unitOfMeasure: string };
  tax: { id: string; name: string } | null;
};

/** Forma minima que debe tener una fila de `SaleAppliedPromotion` de Prisma
 * para mapearla (Bloque P.2). `appliedByUser` resuelto por
 * `saleWithRelationsInclude`, no solo el id crudo. */
type SaleAppliedPromotionRecord = {
  id: string;
  saleItemId: string | null;
  source: string;
  promotionNameSnapshot: string;
  discountType: string;
  discountValue: Prisma.Decimal;
  amountApplied: Prisma.Decimal;
  appliedByUser: { id: string; fullName: string } | null;
  createdAt: Date;
  // Deuda tecnica del motor de promociones, Bloque 4: campos aditivos
  // (Bloque 2/3), ahora expuestos en la respuesta publica.
  effectType: string | null;
  promotionId: string | null;
  // PROMO-10: snapshot historico de rentabilidad comercial.
  commercialOrigin: string;
  fundingType: string;
  supplierId: string | null;
  supplierSubsidyValue: Prisma.Decimal | null;
  supplierContributionAmount: Prisma.Decimal | null;
};

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type SaleRecord = {
  id: string;
  sucursalId: string;
  userId: string;
  cashSessionId: string;
  documentNumber: string | null;
  status: string;
  paymentMethod: string;
  paymentReference: string | null;
  saleDate: Date;
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  discountType: string;
  discountValue: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  changeGiven: Prisma.Decimal;
  notes: string | null;
  sucursal: { id: string; code: string; name: string };
  user: { id: string; fullName: string };
  cashSession: { id: string; status: string };
  // Bloque 8.3: ver `SaleResponse.customer`.
  customerId: string | null;
  customer: {
    id: string;
    name: string;
    identificationType: string;
    identificationNumber: string;
    email: string | null;
  } | null;
  items: SaleItemRecord[];
  appliedPromotions: SaleAppliedPromotionRecord[];
  originalSaleId: string | null;
  originalSale: { id: string; documentNumber: string | null; status: string } | null;
  correctedBySale: { id: string; documentNumber: string | null; status: string } | null;
  // Bloque 7.16: expone lectura del resultado de la emision electronica
  // (Bloque 7.7/7.15, `modules/integrations/alegra`) — ya viajan gratis en
  // `saleWithRelationsInclude` (`repository.ts` usa `include`, no `select`,
  // asi que todos los escalares de `Sale` ya vienen incluidos), solo
  // faltaba declararlos aca y en `toSaleResponse`.
  alegraInvoiceId: string | null;
  alegraInvoiceStatus: string | null;
  alegraElectronicKey: string | null;
  // Version 1.0.5, Bloque 1: mismo criterio que los 3 campos de arriba.
  alegraEmissionUncertainAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Detalle de venta ya calculado, listo para persistirse. */
type ComputedSaleItem = {
  productId: string;
  // Bloque P.6 (integracion con el Motor de Promociones): la categoria
  // del producto no la necesita ningun calculo propio de Ventas — existe
  // aca UNICAMENTE porque `PromotionApplicationService` la requiere para
  // evaluar promociones `scopeType: CATEGORY`. Ya viaja gratis en
  // `products` (`findProductsByIds` no usa `select`, trae el escalar
  // completo de `Product`), solo faltaba declararla en este tipo.
  categoryId: string;
  taxId: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  lineSubtotal: Money;
  lineTax: Money;
  lineTotal: Money;
  // Bloque 14.2 (Costos Base): snapshot de `Product.cost` en el momento del
  // calculo, tomado del mismo `products` ya cargado por `computeItems` para
  // validar `productId` — no agrega ninguna consulta nueva.
  unitCost: Money;
  // Bloque 14.3 (Venta por debajo del costo): nombre del producto, unico
  // motivo de agregarlo aca — para que `assertNoBelowCostSale` arme un
  // mensaje de error legible sin una consulta aparte (mismo `products` que
  // ya resuelve `unitCost`/`categoryId`).
  productName: string;
  // Bloque COST-02 (integracion con el CostEngine): costo a usar EXCLUSIVAMENTE
  // para `assertNoBelowCostSale` — DISTINTO de `unitCost` (arriba), que
  // sigue siendo el snapshot crudo de `Product.cost` sin ningun ajuste
  // (Bloque 14.2, `SaleItem.unitCost` nunca cambia por este bloque). Si
  // `Product.applyExpectedWasteToCost` es `false` (default y comportamiento
  // actual de todo producto existente), `CostEngine.getEffectiveCost()`
  // devuelve el mismo costo promedio sin cambios — la compatibilidad total
  // la garantiza el motor mismo, no logica duplicada aca.
  effectiveCost: Money;
  // Bloque COST-03.2 (correccion de historico, Opcion A): snapshot del dato
  // MAESTRO del producto en el momento EXACTO de la venta — se persiste tal
  // cual en `SaleItem.expectedWastePercentAtSale`/
  // `applyExpectedWasteToCostAtSale`. Nunca se vuelven a leer los campos
  // VIGENTES de `Product` para recalcular esta venta despues de creada
  // (ver `reports.service.ts`, que ahora usa exclusivamente estos dos
  // campos, jamas `Product.expectedWastePercent`/
  // `Product.applyExpectedWasteToCost`).
  expectedWastePercentAtSale: number;
  applyExpectedWasteToCostAtSale: boolean;
};

/** Traduce un detalle de venta de Prisma a la forma publica. */
function toSaleItemResponse(item: SaleItemRecord): SaleItemResponse {
  return {
    id: item.id,
    productId: item.productId,
    taxId: item.taxId,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    taxRate: Number(item.taxRate),
    discount: Number(item.discount),
    lineSubtotal: Number(item.lineSubtotal),
    lineTax: Number(item.lineTax),
    lineTotal: Number(item.lineTotal),
    unitCost: item.unitCost !== null ? Number(item.unitCost) : null,
    product: {
      id: item.product.id,
      name: item.product.name,
      sku: item.product.sku,
      unitOfMeasure: item.product.unitOfMeasure as SaleItemResponse['product']['unitOfMeasure'],
    },
    tax: item.tax ? { id: item.tax.id, name: item.tax.name } : null,
  };
}

/** Traduce una fila de `SaleAppliedPromotion` de Prisma a la forma publica
 * (Bloque P.2). Pura traduccion de tipos — la fila ya viene calculada y
 * persistida (Bloque P.1, `createSaleTransaction`), este mapeo no decide
 * nada. */
function toAppliedPromotionResponse(
  promotion: SaleAppliedPromotionRecord,
): SaleAppliedPromotionResponse {
  return {
    id: promotion.id,
    saleItemId: promotion.saleItemId,
    source: promotion.source as SaleAppliedPromotionResponse['source'],
    promotionNameSnapshot: promotion.promotionNameSnapshot,
    discountType: promotion.discountType as SaleDiscountType,
    discountValue: Number(promotion.discountValue),
    amountApplied: Number(promotion.amountApplied),
    appliedByUser: promotion.appliedByUser,
    createdAt: promotion.createdAt,
    effectType: promotion.effectType as SaleAppliedPromotionResponse['effectType'],
    promotionId: promotion.promotionId,
    commercialOrigin: promotion.commercialOrigin as SaleAppliedPromotionResponse['commercialOrigin'],
    fundingType: promotion.fundingType as SaleAppliedPromotionResponse['fundingType'],
    supplierId: promotion.supplierId,
    supplierSubsidyValue:
      promotion.supplierSubsidyValue != null ? Number(promotion.supplierSubsidyValue) : null,
    supplierContributionAmount:
      promotion.supplierContributionAmount != null ? Number(promotion.supplierContributionAmount) : null,
  };
}

/** Traduce un registro de Prisma a la forma publica de la venta. */
function toSaleResponse(sale: SaleRecord): SaleResponse {
  return {
    id: sale.id,
    sucursalId: sale.sucursalId,
    userId: sale.userId,
    cashSessionId: sale.cashSessionId,
    documentNumber: sale.documentNumber,
    status: sale.status as SaleStatus,
    paymentMethod: sale.paymentMethod as PaymentMethod,
    paymentReference: sale.paymentReference,
    saleDate: sale.saleDate,
    subtotal: Number(sale.subtotal),
    taxTotal: Number(sale.taxTotal),
    discountType: sale.discountType as SaleDiscountType,
    discountValue: Number(sale.discountValue),
    discountTotal: Number(sale.discountTotal),
    total: Number(sale.total),
    amountPaid: Number(sale.amountPaid),
    changeGiven: Number(sale.changeGiven),
    notes: sale.notes,
    sucursal: sale.sucursal,
    user: sale.user,
    cashSession: {
      id: sale.cashSession.id,
      status: sale.cashSession.status as CashSessionStatus,
    },
    customerId: sale.customerId,
    customer: sale.customer,
    items: sale.items.map((item) => toSaleItemResponse(item)),
    appliedPromotions: sale.appliedPromotions.map((promotion) =>
      toAppliedPromotionResponse(promotion),
    ),
    originalSaleId: sale.originalSaleId,
    originalSale: sale.originalSale
      ? {
          id: sale.originalSale.id,
          documentNumber: sale.originalSale.documentNumber,
          status: sale.originalSale.status as SaleStatus,
        }
      : null,
    correctedBySaleId: sale.correctedBySale?.id ?? null,
    correctedBySale: sale.correctedBySale
      ? {
          id: sale.correctedBySale.id,
          documentNumber: sale.correctedBySale.documentNumber,
          status: sale.correctedBySale.status as SaleStatus,
        }
      : null,
    alegraInvoiceId: sale.alegraInvoiceId,
    alegraInvoiceStatus: sale.alegraInvoiceStatus,
    alegraElectronicKey: sale.alegraElectronicKey,
    // Version 1.0.5, Bloque 1: expuesto de solo lectura, mismo criterio
    // que los 3 campos de Alegra de arriba — el frontend lo necesita para
    // ocultar el botón "Asignar cliente" mientras una emision quede en
    // estado incierto (ver guarda real en `update()`).
    alegraEmissionUncertainAt: sale.alegraEmissionUncertainAt,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

/**
 * Valida que cada producto referenciado en `items` exista, y calcula los
 * importes de cada detalle (`lineSubtotal`, `lineTax`, `lineTotal`) usando
 * `quantity`, `unitPrice` y `discount` recibidos del cliente junto con la
 * tasa real del impuesto almacenada en la base de datos. Si un detalle no
 * indica `taxId`, se considera un detalle sin impuesto (`lineTax = 0`). El
 * descuento se resta antes de calcular el impuesto (`lineSubtotal = quantity
 * * unitPrice - discount`).
 */
async function computeItems(
  items: CreateSaleItemDto[],
): Promise<{ items: ComputedSaleItem[]; products: { id: string; name: string; categoryId: string }[] }> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await salesRepository.findProductsByIds(productIds);
  const missingProductId = productIds.find(
    (productId) => !products.some((product) => product.id === productId),
  );

  if (missingProductId) {
    throw new NotFoundError('Producto');
  }

  const inactiveProduct = products.find((product) => !product.active);

  if (inactiveProduct) {
    throw new ValidationError(`El producto "${inactiveProduct.name}" está inactivo y no puede venderse.`);
  }

  const taxIds = [
    ...new Set(items.map((item) => item.taxId).filter((taxId): taxId is string => Boolean(taxId))),
  ];
  const taxes = taxIds.length > 0 ? await salesRepository.findTaxesByIds(taxIds) : [];
  const missingTaxId = taxIds.find((taxId) => !taxes.some((tax) => tax.id === taxId));

  if (missingTaxId) {
    throw new NotFoundError('Impuesto');
  }

  const taxRateById = new Map(taxes.map((tax) => [tax.id, tax.rate]));
  const categoryIdByProductId = new Map(products.map((product) => [product.id, product.categoryId]));
  // Bloque 14.2 (Costos Base): `products` ya trae `cost` (fila completa de
  // `Product`, sin `select`) — mismo `Map` de conveniencia que
  // `categoryIdByProductId`, sin ninguna consulta adicional.
  const costByProductId = new Map(products.map((product) => [product.id, product.cost]));
  // Bloque 14.3 (Venta por debajo del costo): mismo criterio, para el
  // mensaje de `assertNoBelowCostSale`.
  const nameByProductId = new Map(products.map((product) => [product.id, product.name]));
  // Bloque COST-02: mismo criterio — `products` ya trae ambos campos
  // (Bloques 14.4/COST-01.1), necesarios para construir el `CostContext`
  // de cada linea sin ninguna consulta adicional.
  const expectedWastePercentByProductId = new Map(
    products.map((product) => [product.id, product.expectedWastePercent]),
  );
  const applyExpectedWasteToCostByProductId = new Map(
    products.map((product) => [product.id, product.applyExpectedWasteToCost]),
  );

  return {
    items: items.map((item) => {
      const grossAmount = multiplyMoney(toMoney(item.unitPrice), item.quantity);
      const discount = toMoney(item.discount ?? 0);
      // `roundMoney()` (QA motor de promociones, defecto #1): `quantity`
      // puede tener mas de 2 decimales (productos de peso variable), asi
      // que `grossAmount` podria arrastrar esa precision — se fija el
      // subtotal de la linea a 2 decimales ANTES de calcular su impuesto,
      // para que el impuesto se calcule sobre el mismo valor que despues
      // se muestra/persiste (mismo criterio que
      // `promotionApplication.service.ts`, que ya calcula el impuesto
      // ajustado sobre el subtotal ajustado ya redondeado).
      const lineSubtotal = roundMoney(grossAmount.sub(discount));
      const rate = item.taxId ? taxRateById.get(item.taxId) : undefined;
      const lineTax = rate ? roundMoney(multiplyMoney(lineSubtotal, rate).div(100)) : toMoney(0);
      const lineTotal = addMoney(lineSubtotal, lineTax);

      return {
        productId: item.productId,
        // `categoryIdByProductId` siempre tiene esta clave: `products` se
        // cargo arriba a partir de los mismos `productIds` unicos de
        // `items`, y ya se valido que ninguno falte (`missingProductId`).
        categoryId: categoryIdByProductId.get(item.productId)!,
        taxId: item.taxId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: rate ? Number(rate) : 0,
        discount: item.discount ?? 0,
        // Bloque 14.2: mismo criterio de `categoryIdByProductId` (clave
        // siempre presente, ya validada arriba).
        unitCost: toMoney(costByProductId.get(item.productId)!),
        productName: nameByProductId.get(item.productId)!,
        // Bloque COST-02: unico consumidor de `CostEngine` en este archivo.
        // Si `applyExpectedWasteToCost` es `false`, el motor devuelve
        // `averageCost` sin cambios (mismo valor que `unitCost`, arriba) —
        // el comportamiento de `assertNoBelowCostSale` para un producto sin
        // la regla activada es identico al de antes de este bloque.
        effectiveCost: toMoney(
          getEffectiveCost({
            averageCost: Number(costByProductId.get(item.productId)!),
            wastePercent: Number(expectedWastePercentByProductId.get(item.productId) ?? 0),
            applyExpectedWasteToCost: applyExpectedWasteToCostByProductId.get(item.productId) ?? false,
          }).effectiveCost,
        ),
        // Bloque COST-03.2: mismos valores YA leidos arriba para
        // `effectiveCost` — se snapshotean tal cual, sin ninguna consulta
        // adicional, para que `reports.service.ts` nunca tenga que releer
        // el `Product` vigente al calcular la utilidad de esta venta.
        expectedWastePercentAtSale: Number(expectedWastePercentByProductId.get(item.productId) ?? 0),
        applyExpectedWasteToCostAtSale: applyExpectedWasteToCostByProductId.get(item.productId) ?? false,
        lineSubtotal,
        lineTax,
        lineTotal,
      };
    }),
    products,
  };
}

/**
 * Bloque 14.3 (Venta por debajo del costo): valida que ninguna linea del
 * carrito tenga un `unitPrice` menor a su costo. Si hay al menos una linea
 * por debajo del costo, lanza `ValidationError` de inmediato y no continua:
 * `createSaleTransaction` no debe crear la venta ni registrar movimientos
 * de inventario en ese caso.
 *
 * Bloque COST-02 (integracion con el CostEngine): la comparacion usa
 * `ComputedSaleItem.effectiveCost` — NUNCA `unitCost` (el snapshot crudo de
 * `Product.cost` que Bloque 14.2 persiste como `SaleItem.unitCost`, sin
 * ningun ajuste). Para un producto con `applyExpectedWasteToCost: false`
 * (default y comportamiento actual de todo producto existente),
 * `effectiveCost === unitCost` — este cambio es transparente para todo el
 * catalogo hasta que alguien active la regla explicitamente.
 *
 * Funcion aislada e incondicional a proposito (sin flag, sin excepcion):
 * hoy es la UNICA forma de vender bajo costo (imposible), pero esta pensada
 * para que un futuro sistema de permisos (override) solo tenga que envolver
 * esta llamada en una condicion en `createSaleTransaction` (ej. `if
 * (!canSellBelowCost) assertNoBelowCostSale(computedItems);`), sin tocar
 * `computeItems`, `computeSaleQuoteCalculation` ni el resto de esta funcion.
 *
 * Deliberadamente NO se llama desde `computeSaleQuoteCalculation()`: la cotizacion
 * (`POST /sales/quote`) nunca crea nada, y esta validacion solo aplica "antes
 * de confirmar una venta" (el requisito explicito de este bloque) — se
 * invoca unicamente desde `createSaleTransaction`, que si persiste.
 */
function assertNoBelowCostSale(computedItems: ComputedSaleItem[]): void {
  const belowCostItem = computedItems.find((item) =>
    toMoney(item.unitPrice).lessThan(item.effectiveCost),
  );

  if (!belowCostItem) {
    return;
  }

  throw new ValidationError(
    `El producto "${belowCostItem.productName}" se está vendiendo por debajo de su costo ` +
      `(costo: ${formatCRC(belowCostItem.effectiveCost)}, precio: ${formatCRC(belowCostItem.unitPrice)}).`,
  );
}

/**
 * Valida que haya stock suficiente para cada producto antes de registrar
 * los movimientos de inventario de la venta. Agrega la cantidad requerida
 * por producto (una venta puede tener mas de un detalle para el mismo
 * producto) y la reserva atomicamente contra `Inventory.quantity` dentro
 * de la misma transaccion (`tx`) que crea la venta. Si algun producto no
 * tiene stock suficiente, lanza `ValidationError` y cancela toda la
 * operacion: al ocurrir antes de crear la `Sale` y de registrar cualquier
 * `InventoryMovement`, no hay movimientos parciales ni estados intermedios
 * que revertir (el rollback de la transaccion no tiene nada que deshacer
 * en cuanto a inventario).
 *
 * Hallazgo de rendimiento #2 (auditoria 31/07/2026, condicion de carrera):
 * antes esta funcion leia `Inventory.quantity` con un `SELECT` plano
 * (`findManyByProductsAndSucursal`) y validaba en la aplicacion -- dos
 * ventas concurrentes sobre el mismo producto podian leer "stock
 * suficiente" ANTES de que cualquiera aplicara su descuento real
 * (`recordMovements`, mas abajo en la misma transaccion), permitiendo
 * sobreventa. Ahora la validacion ES la reserva atomica
 * (`inventoryRepository.reserveIfSufficient`, un `UPDATE` condicional que
 * toma el bloqueo de fila de Postgres hasta el commit/rollback de esta
 * transaccion): una segunda venta concurrente sobre el mismo producto
 * queda bloqueada aca hasta que la primera confirme o revierta, y entonces
 * ve el saldo YA actualizado, nunca uno obsoleto.
 *
 * Los productos distintos se ordenan (`.sort()`) antes de reservarlos, en
 * secuencia (no en paralelo, mismo criterio que ya usa `recordMovements()`
 * para los descuentos reales): asi CUALQUIER transaccion concurrente que
 * necesite bloquear los mismos productos los adquiere siempre en el mismo
 * orden, evitando un deadlock cruzado (ej. venta A bloquea "pollo" y
 * espera "res" mientras venta B bloquea "res" y espera "pollo").
 */
async function assertSufficientStock(
  sucursalId: string,
  computedItems: ComputedSaleItem[],
  products: { id: string; name: string }[],
  tx: DbClient,
): Promise<void> {
  const requiredQuantityByProductId = new Map<string, number>();

  for (const item of computedItems) {
    requiredQuantityByProductId.set(
      item.productId,
      (requiredQuantityByProductId.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const distinctProductIds = [...requiredQuantityByProductId.keys()].sort();

  for (const productId of distinctProductIds) {
    const requiredQuantity = requiredQuantityByProductId.get(productId)!;

    const reservation = await inventoryRepository.reserveIfSufficient(
      productId,
      sucursalId,
      requiredQuantity,
      tx,
    );

    if (reservation.count === 0) {
      // Sin stock suficiente (o sin fila de `Inventory` todavia) -- una
      // lectura puntual solo para el mensaje de error; no participa de la
      // decision (ya tomada arriba de forma atomica), es unicamente
      // informativa para el usuario.
      const inventory = await inventoryRepository.findByProductAndSucursal(
        productId,
        sucursalId,
        tx,
      );
      const availableQuantity = inventory ? Number(inventory.quantity) : 0;

      throw new ValidationError(
        `Stock insuficiente para "${productNameById.get(productId) ?? productId}": disponible ${availableQuantity}, solicitado ${requiredQuantity}.`,
      );
    }
  }
}

/** Consumo de un lote especifico dentro de una linea de venta (Bloque
 * LOTES-03): cuanto se descuenta de ESE lote puntual para cubrir (total o
 * parcialmente) la cantidad de una linea del carrito. */
type BatchAllocation = {
  batchId: string;
  quantity: number;
};

/**
 * Bloque LOTES-03 (Modulo de Lotes, integracion con Ventas): para cada
 * detalle de venta cuyo producto tenga `Product.requiresBatch = true`,
 * decide de cuales lotes ACTIVOS se descuenta la cantidad vendida, en
 * orden FEFO (vencimiento ascendente, `receivedAt` como desempate — ver
 * `batches/repository.ts::findActiveForConsumption`). Devuelve un `Map` de
 * `productId` a la lista de asignaciones POR LINEA, en el mismo orden que
 * `computedItems`, para que `createSaleTransaction` arme los
 * `InventoryMovement` de salida ya divididos por lote.
 *
 * El saldo de cada lote se descuenta EN MEMORIA (nunca se escribe aca) a
 * medida que se van cubriendo las lineas, en el orden en que aparecen en el
 * carrito — dos lineas distintas del mismo producto comparten el mismo
 * "pool" de lotes: si la primera linea agota un lote, la segunda continua
 * con el siguiente lote FEFO, nunca vuelve a leer desde el ya agotado. La
 * escritura real de `Batch.availableQuantity` (y de `Inventory.quantity`)
 * ocurre DESPUES, exclusivamente a traves de `recordMovements()` — esta
 * funcion solo decide el reparto, nunca persiste nada.
 *
 * Si la suma de `availableQuantity` de los lotes ACTIVOS de un producto no
 * alcanza para cubrir todas sus lineas del carrito, lanza `ValidationError`
 * y no continua: es una insuficiencia de stock POR LOTE, distinta (y mas
 * estricta) que la ya validada por `assertSufficientStock` contra el
 * agregado de `Inventory.quantity` — un producto por lotes puede tener
 * `Inventory.quantity` suficiente en total pero ningun lote ACTIVO con
 * saldo real (ej. todos `EXPIRED`/`BLOCKED`), caso que `assertSufficientStock`
 * no detecta porque no distingue por lote.
 *
 * Decision tecnica que excede el analisis aprobado literal (se marca
 * explicitamente, ver resumen final de este bloque): el analisis no
 * contemplaba un mecanismo de "lote de conciliacion" para cuando la
 * cantidad vendida supera el saldo por lotes; ante esa ambiguedad, se optó
 * por rechazar la venta con un mensaje claro en vez de permitir que el
 * saldo de algun lote quede negativo o que la venta se registre sin
 * `batchId` en esa porcion.
 */
async function resolveBatchAllocations(
  computedItems: ComputedSaleItem[],
  requiresBatchByProductId: Map<string, boolean>,
  sucursalId: string,
  tx: DbClient,
): Promise<Map<number, BatchAllocation[]>> {
  const allocationsByItemIndex = new Map<number, BatchAllocation[]>();

  const batchTrackedProductIds = [
    ...new Set(
      computedItems
        .map((item) => item.productId)
        .filter((productId) => requiresBatchByProductId.get(productId) === true),
    ),
  ];

  if (batchTrackedProductIds.length === 0) {
    return allocationsByItemIndex;
  }

  // Pool mutable de saldos por producto, consultado UNA sola vez por
  // producto (no por linea) y compartido entre todas las lineas de ese
  // mismo producto en el carrito, en el mismo orden FEFO devuelto por el
  // repositorio.
  const batchPoolByProductId = new Map<string, BatchAllocation[]>();
  for (const productId of batchTrackedProductIds) {
    const activeBatches = await findActiveBatchesForConsumption(productId, sucursalId, tx);
    batchPoolByProductId.set(
      productId,
      activeBatches.map((batch) => ({ batchId: batch.id, quantity: batch.availableQuantity })),
    );
  }

  computedItems.forEach((item, index) => {
    const pool = batchPoolByProductId.get(item.productId);

    if (!pool) {
      // Producto sin `requiresBatch`: no participa de la asignacion por
      // lote, `createSaleTransaction` mantiene su movimiento tal cual.
      return;
    }

    let remaining = item.quantity;
    const allocations: BatchAllocation[] = [];

    for (const batch of pool) {
      if (remaining <= 0) break;
      if (batch.quantity <= 0) continue;

      const consumed = Math.min(batch.quantity, remaining);
      batch.quantity -= consumed;
      remaining -= consumed;
      allocations.push({ batchId: batch.batchId, quantity: consumed });
    }

    if (remaining > 0) {
      throw new ValidationError(
        `Stock insuficiente en lotes activos para "${item.productName}": ` +
          `faltan ${remaining} unidad(es) por asignar a un lote.`,
      );
    }

    allocationsByItemIndex.set(index, allocations);
  });

  return allocationsByItemIndex;
}

/**
 * Calcula el monto real descontado del carrito a partir del tipo y el
 * valor ingresados por el cajero, contra el `subtotal` ya calculado de la
 * venta (nunca contra un total enviado por el cliente). `PERCENTAGE` ya
 * viene acotado a 0-100 por `CreateSaleSchema`; `FIXED` se valida aqui
 * porque requiere el `subtotal`, que la venta todavia no conocia en el
 * momento en que se parseo el body.
 */
function computeCartDiscountAmount(
  discountType: SaleDiscountType,
  discountValue: Money,
  subtotal: Money,
): Money {
  if (discountType === 'NONE') {
    return toMoney(0);
  }

  if (discountType === 'PERCENTAGE') {
    // `roundMoney()` (QA motor de promociones, defecto #1): sin esto, un
    // porcentaje sobre un subtotal no exacto (ej. ya ajustado por
    // promociones automaticas) podia devolver mas de 2 decimales — visible
    // tal cual en `POST /sales/quote` (nunca toca la base de datos) pero
    // enmascarado en `POST /sales` por el redondeo implicito de la columna
    // `Decimal(_,2)` de Postgres al persistir. Redondear aqui, de forma
    // explicita, hace que ambos devuelvan exactamente el mismo valor.
    return roundMoney(multiplyMoney(subtotal, discountValue).div(100));
  }

  // FIXED
  if (discountValue.greaterThan(subtotal)) {
    throw new ValidationError('El descuento no puede ser mayor al subtotal.');
  }

  return roundMoney(discountValue);
}

export async function create(dto: CreateSaleDto): Promise<SaleResponse> {
  const sucursal = await salesRepository.findSucursalById(dto.sucursalId);

  if (!sucursal) {
    throw new NotFoundError('Sucursal');
  }

  const user = await salesRepository.findUserById(dto.userId);

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  const cashSession = await salesRepository.findCashSessionById(dto.cashSessionId);

  if (!cashSession) {
    throw new NotFoundError('Sesion de caja');
  }

  // Bloque 8.3: si se selecciono un cliente (POS o cualquier otro
  // consumidor de este servicio), se valida que exista antes de crear la
  // venta — mismo criterio que sucursal/usuario/sesion de caja arriba.
  // `null`/`undefined` (Publico General) no valida nada.
  if (dto.customerId) {
    const customer = await salesRepository.findCustomerById(dto.customerId);

    if (!customer) {
      throw new NotFoundError('Cliente');
    }
  }

  if (dto.documentNumber) {
    const existingByDocumentNumber = await salesRepository.findByDocumentNumber(
      dto.sucursalId,
      dto.documentNumber,
    );

    if (existingByDocumentNumber) {
      throw new ConflictError('El numero de documento ya se encuentra registrado.');
    }
  }

  const created = await createSaleWithGeneratedDocumentNumber(dto);

  // Bloque 7.17: la emision electronica YA NO se dispara aca. El flujo
  // operativo del POS es Venta -> guardar local -> imprimir ticket -> fin;
  // Alegra solo se llama cuando el usuario lo pide explicitamente desde
  // Ventas -> Documentos ("Emitir comprobante electronico", que llama a
  // `emitInvoice` via `POST /integrations/alegra/sales/:saleId/emit`,
  // `alegra.controller.ts`/`alegra.routes.ts`). Antes de este bloque,
  // `triggerAlegraInvoiceEmission` llamaba a `emitInvoice` en "fire and
  // forget" apenas se creaba la venta — ver Bloque 7.11 (removido) para el
  // razonamiento original, ya no vigente.
  return toSaleResponse(created);
}

/**
 * Cotiza una venta (Bloque P.7, `POST /sales/quote`) SIN crearla: mismo
 * `computeSaleQuoteCalculation()` que usa `createSaleTransaction()` (el
 * nucleo de calculo compartido, ver esa funcion) — no hay nada que aislar
 * transaccionalmente porque no se escribe nada. `assertSufficientStock`
 * SI se ejecuta despues, contra el singleton `prisma` (es una lectura, no
 * modifica inventario — ver su propio comentario): una cotizacion con
 * stock insuficiente debe fallar igual que fallaria la venta real con el
 * mismo carrito, para que ambas produzcan resultados consistentes. Mismo
 * comportamiento que antes; unicamente cambio COMO se compone internamente
 * (dos pasos en vez de uno), no que hace ni en que orden puede fallar
 * (ninguno de los pasos de `computeSaleQuoteCalculation` lanza, ver su
 * comentario).
 *
 * Traduce el resultado interno (`itemIds`, UUIDs temporales sin
 * significado fuera de esta funcion) a `lineIndex` (la posicion del
 * detalle dentro del `items` que se envio a cotizar) — mas util para
 * quien consuma la cotizacion que un id que nunca vivira en la base de
 * datos.
 */
export async function getQuote(dto: CreateSaleQuoteDto): Promise<SaleQuoteResponse> {
  const quote = await computeSaleQuoteCalculation({
    sucursalId: dto.sucursalId,
    items: dto.items,
    discountType: dto.discountType,
    discountValue: dto.discountValue,
  });

  await assertSufficientStock(dto.sucursalId, quote.computedItems, quote.products, prisma);

  const lineIndexById = new Map(quote.itemIds.map((id, index) => [id, index]));

  const items: SaleQuoteItemResponse[] = quote.computedItems.map((item, index) => {
    const promotionLine = quote.promotionLineById.get(quote.itemIds[index]);
    const profitability = quote.profitabilityByItemId.get(quote.itemIds[index]) ?? null;

    return {
      productId: item.productId,
      taxId: item.taxId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discount: item.discount,
      promotionDiscount: promotionLine?.promotionDiscount ?? 0,
      lineSubtotal: promotionLine ? promotionLine.adjustedLineSubtotal : Number(item.lineSubtotal),
      lineTax: promotionLine ? promotionLine.adjustedLineTax : Number(item.lineTax),
      lineTotal: promotionLine ? promotionLine.adjustedLineTotal : Number(item.lineTotal),
      profitabilityAnalysis: profitability,
    };
  });

  const appliedPromotions: SaleQuoteAppliedPromotion[] = quote.promotionResult.appliedPromotions.map(
    (applied) => ({
      lineIndex: applied.saleItemId ? (lineIndexById.get(applied.saleItemId) ?? null) : null,
      promotionId: applied.promotionId,
      promotionName: applied.promotionName,
      effectType: applied.effectType,
      effectValue: applied.effectValue,
      amountApplied: applied.amountApplied,
    }),
  );

  return {
    items,
    subtotal: Number(quote.subtotal),
    taxTotal: Number(quote.taxTotal),
    discountType: quote.discountType,
    discountValue: Number(quote.discountValue),
    discountTotal: Number(quote.discountTotal),
    automaticDiscountTotal: quote.promotionResult.totals.promotionDiscountTotal,
    appliedPromotions,
    total: Number(quote.total),
  };
}

/** Cuantos intentos de generar un `documentNumber` distinto se permiten
 * antes de rendirse. Solo aplica cuando el cliente NO envio uno (caso del
 * POS); si el cliente lo envia, la duplicidad ya se valida antes de abrir
 * la transaccion y nunca se reintenta. */
const MAX_DOCUMENT_NUMBER_ATTEMPTS = 5;

/**
 * Ejecuta la transaccion de creacion de la venta. Si el numero de
 * documento fue autogenerado y colisiona con uno ya existente (choque
 * real de datos, no un bug de logica: puede pasar si la secuencia arranca
 * en un valor que alguna venta anterior ya uso manualmente), reintenta
 * con el siguiente numero de la secuencia en vez de dejar que el error
 * crudo de Postgres (`P2002`) llegue sin traducir al cliente como un 500.
 * Cualquier otro tipo de error se relanza de inmediato, sin reintentar.
 *
 * Bloque "reduccion de tiempo en transaccion" (crash bajo carga concurrente
 * -- ~31 ventas simultaneas, investigado y confirmado el 2026-08-03 con
 * `pg_stat_activity`/`pg_locks`: cada venta mantenia una transaccion de
 * escritura abierta mientras ademas pedia conexiones adicionales del mismo
 * pool para leer catalogo/promociones, agotando el pool bajo rafagas
 * concurrentes -- ver ROADMAP.md): la cotizacion (`computeSaleQuoteCalculation`,
 * catalogo + promociones + rentabilidad + descuento, SIN reservar stock)
 * se calcula ANTES de abrir la transaccion, una unica vez, fuera del loop
 * de reintento -- no depende de `documentNumber`, asi que una colision de
 * numero (el unico motivo por el que este loop reintenta) nunca amerita
 * recalcularla. La transaccion en si arranca DESPUES, y solo hace lo que
 * requiere atomicidad real: reservar stock, generar el numero de
 * documento, y persistir.
 */
async function createSaleWithGeneratedDocumentNumber(dto: CreateSaleDto, originalSaleId?: string) {
  const precomputedQuote = await computeSaleQuoteCalculation({
    sucursalId: dto.sucursalId,
    items: dto.items,
    discountType: dto.discountType,
    discountValue: dto.discountValue,
    now: dto.saleDate,
  });

  for (let attempt = 1; attempt <= MAX_DOCUMENT_NUMBER_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        (tx) => createSaleTransaction(dto, tx, originalSaleId, precomputedQuote),
        transactionConfig.bulk,
      );
    } catch (error) {
      const isGeneratedDocumentNumberCollision =
        !dto.documentNumber &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        (error.meta.target as string[]).includes('document_number');

      if (!isGeneratedDocumentNumberCollision || attempt === MAX_DOCUMENT_NUMBER_ATTEMPTS) {
        throw error;
      }
    }
  }

  // Inalcanzable: el loop siempre retorna o relanza: TypeScript exige un
  // camino de retorno explicito de todas formas.
  throw new ConflictError('No se pudo generar un numero de documento unico.');
}

/** Resultado de `computeSaleQuoteCalculation()` — todo lo que hace falta
 * para tanto PERSISTIR una venta (`createSaleTransaction`) como para
 * DEVOLVER una cotizacion (`getQuote`), sin que ninguna de las dos vuelva a
 * calcular nada por su cuenta. */
type SaleQuoteCalculation = {
  computedItems: ComputedSaleItem[];
  // Bloque "reduccion de tiempo en transaccion" (crash bajo carga,
  // 2026-08-03): `products` (misma fila que devuelve `computeItems()`) se
  // expone aca para que `assertSufficientStock()` pueda invocarse DESPUES,
  // por separado, con el mensaje de error identico al que ya arma hoy
  // (necesita `{id, name}` de cada producto) — sin volver a leer nada.
  products: { id: string; name: string }[];
  itemIds: string[];
  promotionResult: PromotionApplicationResult;
  promotionLineById: Map<string, PromotionApplicationResult['lines'][number]>;
  // PROMO-09 (integracion de Pricing Analysis en Ventas): utilidad/margen/
  // aporte del proveedor/rentabilidad final por linea, calculados por
  // `calculateLineProfitability()` (`shared/services/pricingAnalysis/`)
  // sobre el resultado YA producido arriba — nunca se vuelve a invocar
  // `evaluatePromotions()` ni `getEffectiveCost()` para esto, ambos ya se
  // calcularon (`promotionResult`/`ComputedSaleItem.effectiveCost`). `null`
  // por linea cuando no hay informacion valida suficiente (mismo criterio
  // que el resto de este coordinador: nunca lanza).
  profitabilityByItemId: Map<string, LineProfitabilityAnalysis | null>;
  subtotal: Money;
  taxTotal: Money;
  discountType: SaleDiscountType;
  discountValue: Money;
  discountTotal: Money;
  total: Money;
};

/**
 * NUCLEO DE CALCULO COMPARTIDO (Bloque P.7): produce EXACTAMENTE el mismo
 * `subtotal`/`taxTotal`/`discountTotal`/`total` sin importar si quien lo
 * llama termina persistiendo algo (`createSaleTransaction`) o solo
 * necesita mostrarlo (`getQuote`, el endpoint de cotizacion) — es el
 * UNICO lugar donde se invoca `evaluateSalePromotions()` y se combina su
 * resultado con el descuento manual de carrito. Ninguna otra funcion de
 * este archivo repite esta logica.
 *
 * Bloque "reduccion de tiempo en transaccion" (crash bajo carga concurrente,
 * investigado y confirmado con evidencia el 2026-08-03 — ver ROADMAP.md):
 * esta funcion YA NO reserva stock (`assertSufficientStock` se movio a un
 * paso separado, invocado por cada llamador). Es pura lectura de catalogo
 * (`computeItems`, siempre contra el singleton `prisma`, nunca contra `tx`
 * -- ver `sales.repository.ts::findProductsByIds`/`findTaxesByIds`) mas
 * evaluacion de promociones (`evaluateSalePromotions`, que nunca lanza,
 * ver `promotionApplication.service.ts`) y calculo puro (rentabilidad,
 * descuento de carrito, totales) — nada de esto necesita ni toca el motor
 * de transacciones. Antes, cuando `createSaleTransaction` llamaba a esta
 * funcion con `db: tx`, cada venta abria una transaccion de escritura
 * (bloqueando una conexion del pool) para luego, DENTRO de ella, seguir
 * pidiendole conexiones ADICIONALES al mismo pool para estas lecturas de
 * solo catalogo (siempre resueltas contra el singleton, nunca contra
 * `tx`) — dos conexiones simultaneas por venta en vuelo durante toda esta
 * fase, la causa raiz confirmada de agotamiento del pool bajo rafagas
 * concurrentes. Ahora se invoca ANTES de abrir la transaccion (ver
 * `createSaleWithGeneratedDocumentNumber`), asi que la transaccion de
 * escritura ya no existe mientras esto corre.
 *
 * Le devuelve `products` a quien la llama (antes uso interno, exclusivo de
 * `assertSufficientStock`) para que ese llamador pueda invocar la reserva
 * de stock por su cuenta, con el mismo mensaje de error de siempre, sin
 * releer nada.
 */
async function computeSaleQuoteCalculation(input: {
  sucursalId: string;
  items: CreateSaleItemDto[];
  discountType?: SaleDiscountType;
  discountValue?: number;
  now?: Date;
}): Promise<SaleQuoteCalculation> {
  const { items: computedItems, products } = await computeItems(input.items);

  // Un id determinista, generado ANTES de persistir (o de que exista
  // cualquier persistencia, en el caso de una cotizacion), para cada
  // linea — permite correlacionar cada `ComputedSaleItem` con su
  // resultado de `PromotionApplicationService` sin depender de
  // `productId` (dos lineas pueden compartir el mismo producto). Cuando
  // `createSaleTransaction` persiste, este mismo id se usa como `id`
  // explicito de cada `SaleItem`; una cotizacion lo descarta (traduce a
  // `lineIndex`, ver `getQuote`) porque no hay ningun `SaleItem` real que
  // referenciar.
  const itemIds = computedItems.map(() => randomUUID());

  // SalesService NUNCA importa el motor de reglas directamente — la unica
  // interaccion posible es a traves de `evaluateSalePromotions()`
  // (`PromotionApplicationService`, Bloque P.5), que ya devuelve todo en
  // vocabulario de Ventas (subtotal/impuesto/total ajustados por linea).
  // Si no hay ninguna promocion activa que aplique, el resultado es
  // equivalente a no tocar nada (cada `adjustedLineSubtotal` == el
  // `lineSubtotal` de entrada) — no hace falta una rama "sin promociones"
  // separada.
  const promotionCartLines: PromotionApplicationCartLine[] = computedItems.map((item, index) => ({
    saleItemId: itemIds[index],
    productId: item.productId,
    categoryId: item.categoryId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineSubtotal: Number(item.lineSubtotal),
    taxRate: item.taxRate,
  }));

  const promotionResult = await evaluateSalePromotions(promotionCartLines, {
    sucursalId: input.sucursalId,
    now: input.now,
  });

  const promotionLineById = new Map(promotionResult.lines.map((line) => [line.saleItemId, line]));

  // PROMO-09 (integracion de Pricing Analysis en Ventas): agrupa las
  // promociones AUTOMATICAS ya aplicadas (`promotionResult.appliedPromotions`,
  // "no recalcular promociones") por linea — una linea puede tener mas de
  // una si acumulo varias promociones (`stackable`). `saleItemId: null`
  // (descuento a nivel de CARRITO) se excluye: no es atribuible al costo/
  // margen de una linea especifica.
  const appliedPromotionsBySaleItemId = new Map<string, PromotionApplicationResult['appliedPromotions']>();
  for (const applied of promotionResult.appliedPromotions) {
    if (!applied.saleItemId) {
      continue;
    }

    const list = appliedPromotionsBySaleItemId.get(applied.saleItemId) ?? [];
    list.push(applied);
    appliedPromotionsBySaleItemId.set(applied.saleItemId, list);
  }

  // `calculateLineProfitability()` NUNCA vuelve a invocar el motor de
  // promociones ni `CostEngine` — reutiliza `item.effectiveCost` (ya
  // calculado por `computeItems()`) y `promotionLine.adjustedLineSubtotal`
  // (ya calculado por `PromotionApplicationService`), solo combinandolos
  // con los campos comerciales de cada promocion aplicada.
  const profitabilityByItemId = new Map<string, LineProfitabilityAnalysis | null>();
  computedItems.forEach((item, index) => {
    const saleItemId = itemIds[index];
    const promotionLine = promotionLineById.get(saleItemId);
    const unitPriceAfterPromotion =
      promotionLine && item.quantity > 0 ? promotionLine.adjustedLineSubtotal / item.quantity : item.unitPrice;

    profitabilityByItemId.set(
      saleItemId,
      calculateLineProfitability({
        quantity: item.quantity,
        effectiveCost: Number(item.effectiveCost),
        unitPriceBeforePromotion: item.unitPrice,
        unitPriceAfterPromotion,
        appliedPromotionsFunding: (appliedPromotionsBySaleItemId.get(saleItemId) ?? []).map((applied) => ({
          fundingType: applied.fundingType,
          supplierSubsidyValue: applied.supplierSubsidyValue,
          amountApplied: applied.amountApplied,
        })),
      }),
    );
  });

  // `subtotal`/`taxTotal` ya incorporan el efecto de las promociones
  // AUTOMATICAS de linea/categoria/combo (calculadas por
  // `PromotionApplicationService`, nunca recalculadas aca — "no duplicar
  // calculos"). El descuento MANUAL de carrito (`discountType`/
  // `discountValue`, sin cambios de comportamiento) se sigue calculando
  // sobre este `subtotal` YA ajustado — se aplica DESPUES de las
  // promociones automaticas, nunca antes, mismo orden documentado en el
  // analisis de arquitectura aprobado.
  const subtotal = toMoney(promotionResult.totals.subtotal);
  const taxTotal = toMoney(promotionResult.totals.taxTotal);

  const discountType: SaleDiscountType = input.discountType ?? 'NONE';
  const discountValue = toMoney(input.discountValue ?? 0);
  const discountTotal = computeCartDiscountAmount(discountType, discountValue, subtotal);

  // `promotionResult.totals.total` ya es `subtotal + taxTotal - descuento
  // AUTOMATICO de carrito` (si hubo una promocion `scopeType: CART`) — el
  // descuento MANUAL de carrito se resta encima, al final, exactamente
  // como ya se resta sobre `subtotal + taxTotal` cuando no hay ninguna
  // promocion automatica involucrada.
  const total = toMoney(promotionResult.totals.total).sub(discountTotal);

  return {
    computedItems,
    products,
    itemIds,
    promotionResult,
    promotionLineById,
    profitabilityByItemId,
    subtotal,
    taxTotal,
    discountType,
    discountValue,
    discountTotal,
    total,
  };
}

/** Cuerpo real de la transaccion de creacion de venta (antes vivia inline
 * dentro de `create()`; se extrajo tal cual, sin cambiar ninguna linea de
 * su logica, unicamente para poder reintentarla desde
 * `createSaleWithGeneratedDocumentNumber`).
 *
 * `originalSaleId` (Bloque 3, "Correccion de Venta"): unicamente lo pasa
 * `correctSaleTransaction`, para enlazar la venta correctiva con la venta
 * original que reemplaza. `create()` (flujo normal del POS) nunca lo pasa,
 * por lo que el comportamiento existente no cambia.
 *
 * `precomputedQuote` (Bloque "reduccion de tiempo en transaccion", crash
 * bajo carga): `createSaleWithGeneratedDocumentNumber` ya calcula la
 * cotizacion ANTES de abrir esta transaccion (ver ahi) y la pasa aca, para
 * no repetir ese calculo con la transaccion ya abierta. `correctSale`
 * (unico otro llamador) NO lo pasa — su transaccion ya esta abierta antes
 * de invocar esta funcion (primero anula la venta original, mismo `tx`),
 * asi que aca se sigue calculando exactamente como antes, sin ningun
 * cambio de comportamiento para ese flujo.
 */
async function createSaleTransaction(
  dto: CreateSaleDto,
  tx: DbClient,
  originalSaleId?: string,
  precomputedQuote?: SaleQuoteCalculation,
) {
  const {
    computedItems,
    products,
    itemIds,
    promotionResult,
    promotionLineById,
    subtotal,
    taxTotal,
    discountType,
    discountValue,
    discountTotal,
    total,
  } =
    precomputedQuote ??
    (await computeSaleQuoteCalculation({
      sucursalId: dto.sucursalId,
      items: dto.items,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      now: dto.saleDate,
    }));

  // Reserva atomica de stock (`Hallazgo de rendimiento #2`, ver
  // `assertSufficientStock` mas arriba) — DEBE ejecutarse con `tx` (toma el
  // bloqueo de fila hasta el commit/rollback de ESTA transaccion), nunca
  // con el `prisma` del calculo precomputado. Misma posicion relativa que
  // antes: primer paso de la transaccion, antes de `assertNoBelowCostSale`
  // (ninguno de los pasos de `computeSaleQuoteCalculation` -- catalogo,
  // promociones, rentabilidad, descuento -- puede lanzar, asi que mover la
  // reserva de stock a este punto no cambia que validacion "gana" cuando
  // varias fallarian a la vez).
  await assertSufficientStock(dto.sucursalId, computedItems, products, tx);

  // Bloque 14.3 (Venta por debajo del costo): se valida ANTES de generar el
  // numero de documento o escribir cualquier fila — si hay al menos una
  // linea bajo costo, `assertNoBelowCostSale` lanza y ninguna de las
  // escrituras siguientes de esta transaccion se ejecuta.
  assertNoBelowCostSale(computedItems);

  const amountPaid = toMoney(dto.amountPaid ?? 0);

  // QA.3 (POS/Ventas): el sistema no modela ninguna forma de pago parcial o
  // a credito (ver `SaleStatus`/`PaymentMethod` en `schema.prisma` -- ambos
  // enums exigen que una venta quede pagada por completo al crearse), asi
  // que `amountPaid` menor al `total` real (calculado arriba, nunca el que
  // mande el cliente) nunca es valido -- sin este chequeo, `changeGiven`
  // (linea de abajo) quedaba negativo y se persistia tal cual, sin ningun
  // error. Se compara contra el `total` YA CALCULADO por este mismo
  // servicio (`computeSaleQuoteCalculation`/`precomputedQuote`), nunca uno
  // que mande el cliente, asi que no hay forma de eludir esta validacion
  // enviando un `total` distinto (`CreateSaleDto` ni siquiera acepta ese
  // campo).
  if (amountPaid.lessThan(total)) {
    throw new ValidationError(
      `El monto pagado (${formatCRC(amountPaid)}) es menor al total de la venta (${formatCRC(total)}).`,
    );
  }

  const changeGiven = amountPaid.sub(total);

  // Si el cliente no envio `documentNumber` (caso normal: el POS nunca
  // lo envia), se genera automaticamente aqui, dentro de la misma
  // transaccion que crea la venta. El incremento del consecutivo
  // (`incrementSaleDocumentSequence`) participa de esta transaccion via
  // `tx`, por lo que si la venta hace rollback, el numero tambien se
  // revierte — sin huecos en la numeracion. Formato: VTA-000001.
  const documentNumber =
    dto.documentNumber ??
    `VTA-${String(await salesRepository.incrementSaleDocumentSequence(tx)).padStart(6, '0')}`;

  const sale = await salesRepository.create(
    {
      sucursalId: dto.sucursalId,
      userId: dto.userId,
      cashSessionId: dto.cashSessionId,
      customerId: dto.customerId ?? null,
      documentNumber,
      status: dto.status,
      paymentMethod: dto.paymentMethod,
      paymentReference: dto.paymentReference ?? null,
      saleDate: dto.saleDate,
      subtotal,
      taxTotal,
      discountType,
      discountValue,
      discountTotal,
      total,
      amountPaid,
      changeGiven,
      notes: dto.notes ?? null,
      originalSaleId: originalSaleId ?? null,
      items: {
        // `lineSubtotal`/`lineTax`/`lineTotal` persistidos son los YA
        // AJUSTADOS por promociones automaticas (si alguna aplico a esta
        // linea especifica) — `item.discount` sigue siendo EXCLUSIVAMENTE
        // el descuento manual de linea (`CreateSaleItemDto.discount`, sin
        // cambios de significado): las dos fuentes de descuento por linea
        // quedan separadas, mismo criterio que ya distingue el descuento
        // manual de carrito del automatico a nivel de `SaleAppliedPromotion`.
        create: computedItems.map((item, index) => {
          const promotionLine = promotionLineById.get(itemIds[index]);

          return {
            id: itemIds[index],
            productId: item.productId,
            taxId: item.taxId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            discount: item.discount,
            // Bloque 14.2 (Costos Base): snapshot inmutable de
            // `Product.cost`. `correctSale` reutiliza esta misma funcion
            // para su venta correctiva, que relee el costo VIGENTE del
            // producto — igual que ya hace con `unitPrice`/`taxRate`, sin
            // ninguna excepcion nueva para este campo.
            unitCost: item.unitCost,
            // Bloque COST-03.2 (correccion de historico, Opcion A): mismo
            // criterio que `unitCost` — snapshot inmutable del dato maestro
            // vigente en el momento de ESTA venta (o de la correctiva, si
            // aplica). `reports.service.ts` debe leer estos dos campos,
            // nunca `Product.expectedWastePercent`/
            // `Product.applyExpectedWasteToCost`, para calcular la utilidad
            // de una venta ya realizada.
            expectedWastePercentAtSale: item.expectedWastePercentAtSale,
            applyExpectedWasteToCostAtSale: item.applyExpectedWasteToCostAtSale,
            lineSubtotal: promotionLine ? toMoney(promotionLine.adjustedLineSubtotal) : item.lineSubtotal,
            lineTax: promotionLine ? toMoney(promotionLine.adjustedLineTax) : item.lineTax,
            lineTotal: promotionLine ? toMoney(promotionLine.adjustedLineTotal) : item.lineTotal,
          };
        }),
      },
    },
    tx,
  );

  // Bloque 4 (offline/sync): encola la venta en la cola de salida, dentro
  // de la MISMA transaccion que la crea (patron outbox — si la venta hace
  // rollback, el trabajo tambien; si el proceso se cae justo despues del
  // commit, el trabajo ya quedo guardado en Postgres, no se pierde). Sin
  // destino real todavia (`cloudPushStubHandler` — ver Bloque 4,
  // "riesgos": la API de nube de Fase 2 no esta definida), pero la
  // mecanica de la cola queda probada de punta a punta con esta entidad.
  await enqueueSyncJob(
    {
      sucursalId: sale.sucursalId,
      jobType: 'CLOUD_PUSH',
      entityType: 'Sale',
      entityId: sale.id,
    },
    tx,
  );

  // Version 1.0.3, Bloque 1 (vuelto en efectivo): registra el vuelto real
  // entregado como un `CashMovement` tipo `CHANGE`, EXCLUSIVAMENTE para
  // trazabilidad/auditoria — `cash/service.ts::computeExpectedAmount` NO lo
  // suma (el arqueo ya excluye el vuelto al agregar `Sale.total`, no
  // `Sale.amountPaid`). Mismo patron que `returns/service.ts` (REFUND):
  // escritura directa dentro de esta misma transaccion, sin servicio
  // transversal. Solo aplica a ventas en efectivo con vuelto > 0 — el resto
  // de metodos de pago (CARD/SINPE_MOVIL/TRANSFER/MIXED) nunca generan este
  // movimiento.
  if (sale.paymentMethod === 'CASH' && changeGiven.greaterThan(0)) {
    await salesRepository.createCashMovement(
      {
        sucursalId: sale.sucursalId,
        cashSessionId: sale.cashSessionId,
        userId: sale.userId,
        type: CashMovementType.CHANGE,
        amount: changeGiven,
        reason: `Vuelto entregado en la venta ${sale.documentNumber}`,
        referenceType: InventoryReferenceType.SALE,
        referenceId: sale.id,
      },
      tx,
    );
  }

  // Bloque P.1 (Motor de Promociones, infraestructura de auditoria): el
  // descuento MANUAL de carrito queda registrado como un evento auditable
  // independiente — quien lo aplico (el cajero de esta venta), un
  // snapshot de la regla usada, y el monto real descontado. Solo se
  // registra si REALMENTE hubo descuento (`discountTotal > 0`): una venta
  // sin descuento manual no genera ninguna fila aca, sin ruido en la
  // auditoria.
  //
  // Bloque "reduccion de tiempo en transaccion" (crash bajo carga): esta
  // fila (si aplica) y todas las de promociones automaticas de mas abajo
  // se acumulan en `appliedPromotionRows` y se insertan en un UNICO
  // `createMany` al final (ver mas abajo), en vez de un `INSERT` por fila
  // — mismos datos, mismo orden de armado, una sola escritura en vez de
  // hasta N+1 round-trips a la base de datos dentro de la transaccion.
  const appliedPromotionRows: Prisma.SaleAppliedPromotionUncheckedCreateInput[] = [];

  if (discountTotal.greaterThan(0)) {
    appliedPromotionRows.push({
      saleId: sale.id,
      saleItemId: null,
      source: 'MANUAL',
      appliedByUserId: sale.userId,
      promotionNameSnapshot: 'Descuento manual',
      discountType,
      discountValue,
      amountApplied: discountTotal,
    });
  }

  // Bloque P.6 (integracion con el Motor de Promociones): una fila de
  // auditoria por CADA descuento AUTOMATICO que realmente se aplico —
  // `promotionResult.appliedPromotions` ya viene en la forma exacta que
  // esta tabla necesita (una entrada por combinacion promocion+linea,
  // `saleItemId: null` para las de alcance `CART`). `appliedByUserId:
  // null` siempre: ninguna persona "aplica" una promocion automatica.
  //
  // `discountType`/`discountValue` (SIN CAMBIOS, deuda tecnica conocida):
  // `SaleAppliedPromotion.discountType` solo admite `PERCENTAGE`/`FIXED`,
  // un vocabulario mas angosto que `PromotionEffectType` (que ademas
  // tiene `SPECIAL_PRICE`/`FIXED_PRICE`/`BUY_X_PAY_Y`). Se sigue mapeando `PERCENTAGE`
  // tal cual, y el resto a `FIXED` — este mapeo con perdida de
  // granularidad NO se toca en este bloque (ver Bloque 3 del analisis de
  // deuda tecnica: "no alterar ningun calculo existente").
  //
  // `effectType`/`promotionId` (Bloque 3, deuda tecnica — columnas
  // nullable agregadas en el Bloque 2): complementan, sin reemplazar,
  // `discountType`/`promotionNameSnapshot`. Ambos ya vienen resueltos en
  // `applied` (`PromotionApplicationAppliedPromotion.effectType`/
  // `.promotionId`, propagados desde el motor sin cambios) — no hace
  // falta ninguna consulta nueva para poblarlos.
  // PROMO-10 (snapshot historico de rentabilidad comercial): mismo
  // criterio ya usado para `SaleItem.expectedWastePercentAtSale`/
  // `applyExpectedWasteToCostAtSale` (CostEngine) — estos 5 campos se
  // copian tal cual del `Promotion` vigente AHORA (`applied`, ya
  // propagado sin cambios desde el catalogo por
  // `PromotionApplicationService`, PROMO-09) y nunca se vuelven a leer
  // desde `Promotion` despues de este `INSERT`. Si la promocion se edita
  // mas adelante (proveedor, financiamiento, origen), esta fila ya
  // persistida no cambia.
  //
  // `quantityBySaleItemId`: necesaria para `calculatePromotionSupplierContribution()`
  // cuando `fundingType: SUPPLIER_SUBSIDY_PER_UNIT` (el aporte total
  // depende de cuantas unidades se vendieron en la linea afectada) — `1`
  // para descuentos a nivel de CARRITO (`saleItemId: null`), unico caso
  // sin una cantidad de producto especifica a la que atribuir un "por
  // unidad" (mismo criterio documentado en
  // `shared/services/pricingAnalysis/pricingAnalysis.ts`).
  const quantityBySaleItemId = new Map(
    computedItems.map((item, index) => [itemIds[index], item.quantity]),
  );

  for (const applied of promotionResult.appliedPromotions) {
    const quantity = applied.saleItemId ? (quantityBySaleItemId.get(applied.saleItemId) ?? 1) : 1;
    const supplierContributionAmount = calculatePromotionSupplierContribution({
      fundingType: applied.fundingType,
      supplierSubsidyValue: applied.supplierSubsidyValue,
      amountApplied: applied.amountApplied,
      quantity,
    });

    appliedPromotionRows.push({
      saleId: sale.id,
      saleItemId: applied.saleItemId,
      source: 'AUTOMATIC',
      appliedByUserId: null,
      promotionNameSnapshot: applied.promotionName,
      discountType: applied.effectType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED',
      discountValue: toMoney(applied.effectValue ?? applied.amountApplied),
      amountApplied: toMoney(applied.amountApplied),
      effectType: applied.effectType,
      promotionId: applied.promotionId,
      commercialOrigin: applied.commercialOrigin,
      fundingType: applied.fundingType,
      supplierId: applied.supplierId,
      supplierSubsidyValue: applied.supplierSubsidyValue != null ? toMoney(applied.supplierSubsidyValue) : null,
      supplierContributionAmount:
        applied.fundingType !== 'NONE' ? toMoney(supplierContributionAmount) : null,
    });
  }

  if (appliedPromotionRows.length > 0) {
    await salesRepository.createAppliedPromotions(appliedPromotionRows, tx);
  }

  // Bloque LOTES-03 (Modulo de Lotes, integracion con Ventas): que
  // productos de ESTA venta requieren lotes -- lectura DENTRO de la misma
  // transaccion (mismo criterio que `assertSufficientStock`), nunca
  // confiada a un valor leido antes de abrir la transaccion.
  const distinctSaleProductIds = [...new Set(computedItems.map((item) => item.productId))];
  const batchFlags = await salesRepository.findProductBatchFlagsByIds(distinctSaleProductIds, tx);
  const requiresBatchByProductId = new Map(batchFlags.map((product) => [product.id, product.requiresBatch]));

  const batchAllocationsByItemIndex = await resolveBatchAllocations(
    computedItems,
    requiresBatchByProductId,
    sale.sucursalId,
    tx,
  );

  await recordMovements(
    computedItems.flatMap((item, index) => {
      const allocations = batchAllocationsByItemIndex.get(index);

      // Producto SIN `requiresBatch`: comportamiento identico al previo a
      // este bloque -- un unico movimiento, sin `batchId`.
      if (!allocations) {
        return [
          {
            tx,
            sucursalId: sale.sucursalId,
            productId: item.productId,
            userId: sale.userId,
            type: InventoryMovementType.SALE,
            quantity: -item.quantity,
            referenceType: InventoryReferenceType.SALE,
            referenceId: sale.id,
            reason: null,
          },
        ];
      }

      // Producto CON `requiresBatch`: un movimiento por cada lote del que
      // se consumio, cada uno con su `batchId` propio -- `recordMovements`
      // (via `applyBatchMovement`) descuenta `Batch.availableQuantity` de
      // CADA lote y cierra (`DEPLETED`) el que llegue a 0, mismo mecanismo
      // unico que ya usan Compras/el ajuste manual de lotes.
      //
      // `skipBatchQuantitySync` NUNCA se establece aca (se omite por
      // completo, igual que su default `undefined`): ese flag es EXCLUSIVO
      // de la creacion inicial de un lote durante la recepcion de una
      // compra (`purchases/service.ts::createBatchesForReceivedPurchase`),
      // el UNICO caso en el que `Batch.availableQuantity` ya nace igualada
      // a `initialQuantity` antes de que `recordMovement` corra. Una venta
      // JAMAS crea un lote, siempre consume saldo de uno ya existente, asi
      // que el descuento de `applyBatchMovement` debe aplicarse siempre.
      return allocations.map((allocation) => ({
        tx,
        sucursalId: sale.sucursalId,
        productId: item.productId,
        userId: sale.userId,
        type: InventoryMovementType.SALE,
        quantity: -allocation.quantity,
        referenceType: InventoryReferenceType.SALE,
        referenceId: sale.id,
        batchId: allocation.batchId,
        reason: null,
      }));
    }),
  );

  // QA critico (Bloque P.6, detectado durante la verificacion de esta
  // integracion — preexistente desde el Bloque P.1, nunca visible antes
  // porque el QA de ese bloque siempre volvia a leer la venta con un
  // segundo `GET` aparte, nunca inspecciono la respuesta inmediata de
  // `POST /sales`): `sale` es la instantanea que devolvio
  // `salesRepository.create()`, capturada ANTES de que existiera
  // cualquier fila de `SaleAppliedPromotion` (manual o automatica, ambas
  // se insertan DESPUES, mas arriba) — su `appliedPromotions` siempre
  // llegaba vacio en la respuesta de creacion, aunque las filas SI
  // quedaban bien persistidas (`GET /sales/:id` posterior ya las
  // mostraba). Se relee la venta DENTRO de la misma transaccion (mismo
  // criterio que `findById` en `voidSaleTransaction`) para que la
  // respuesta de creacion sea consistente con lo que ya esta en la base
  // de datos, sin otra escritura ni otro calculo.
  const saleWithPromotions = await salesRepository.findById(sale.id, tx);

  return saleWithPromotions ?? sale;
}

export async function findById(id: string): Promise<SaleResponse> {
  const sale = await salesRepository.findById(id);

  if (!sale) {
    throw new NotFoundError('Venta');
  }

  return toSaleResponse(sale);
}

export async function findMany(query: ListSalesQuery): Promise<ListSalesResult> {
  const [items, total] = await salesRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toSaleResponse(item)),
    total,
  };
}

/**
 * Version 1.0.3, Bloque 1 (vuelto en efectivo): mantiene el `CashMovement`
 * tipo `CHANGE` de una venta consistente con su estado DESPUES de editarla.
 * Nunca muta un movimiento existente (`amount`/`cashSessionId`) — siempre
 * borrado logico del activo + creacion de uno nuevo si corresponde, mismo
 * criterio que el resto del proyecto usa para no reescribir un registro
 * contable ya emitido (ver `voidSaleTransaction`/`correctSale`). El indice
 * unico parcial de `CashMovement` (ver migracion
 * `add_cash_movement_change_unique_index`) tolera esta secuencia porque el
 * borrado logico (que excluye la fila del indice) siempre corre ANTES de
 * crear la nueva.
 */
async function syncChangeMovementAfterUpdate(
  updated: Awaited<ReturnType<typeof salesRepository.update>>,
  tx: DbClient,
): Promise<void> {
  const shouldHaveActiveChange =
    updated.paymentMethod === 'CASH' && toMoney(updated.changeGiven).greaterThan(0);

  const activeMovement = await salesRepository.findActiveChangeMovement(updated.id, tx);

  if (!activeMovement) {
    if (!shouldHaveActiveChange) return;

    await salesRepository.createCashMovement(
      {
        sucursalId: updated.sucursalId,
        cashSessionId: updated.cashSessionId,
        userId: updated.userId,
        type: CashMovementType.CHANGE,
        amount: updated.changeGiven,
        reason: `Vuelto entregado en la venta ${updated.documentNumber}`,
        referenceType: InventoryReferenceType.SALE,
        referenceId: updated.id,
      },
      tx,
    );
    return;
  }

  if (!shouldHaveActiveChange) {
    await salesRepository.softDeleteCashMovement(activeMovement.id, tx);
    return;
  }

  const amountChanged = !activeMovement.amount.equals(updated.changeGiven);
  const sessionChanged = activeMovement.cashSessionId !== updated.cashSessionId;

  if (!amountChanged && !sessionChanged) return;

  await salesRepository.softDeleteCashMovement(activeMovement.id, tx);
  await salesRepository.createCashMovement(
    {
      sucursalId: updated.sucursalId,
      cashSessionId: updated.cashSessionId,
      userId: updated.userId,
      type: CashMovementType.CHANGE,
      amount: updated.changeGiven,
      reason: `Vuelto entregado en la venta ${updated.documentNumber} (corregido)`,
      referenceType: InventoryReferenceType.SALE,
      referenceId: updated.id,
    },
    tx,
  );
}

export async function update(id: string, dto: UpdateSaleDto): Promise<SaleResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await salesRepository.findById(id, tx);

    if (!existing) {
      throw new NotFoundError('Venta');
    }

    // Version 1.0.5, Bloque 1: asignar/cambiar el cliente de una venta ya
    // creada ("Publico General" -> cliente real, o viceversa) SOLO antes
    // de que exista o pueda existir un comprobante fiscal real para esta
    // venta. Las 3 primeras guardas son deliberadamente estrictas: una vez
    // que hay factura emitida, o la emision quedo en estado incierto tras
    // un timeout de red (`alegraEmissionUncertainAt` — ver
    // `alegra.service.ts::emitInvoice`, puede haber un comprobante real ya
    // timbrado del otro lado con el cliente ANTERIOR), o la venta esta
    // anulada, cambiar el cliente localmente dejaria una inconsistencia
    // real entre lo que el ERP muestra y lo que Hacienda ya certifico (o
    // certificaria) por otro lado. Solo se evalua si `customerId` viene en
    // el DTO — `undefined` (no se pidio cambiar) no dispara nada de esto.
    if (dto.customerId !== undefined) {
      if (existing.alegraInvoiceId) {
        throw new ConflictError(
          'No se puede asignar un cliente: esta venta ya tiene una Factura Electrónica emitida.',
        );
      }
      if (existing.alegraEmissionUncertainAt) {
        throw new ConflictError(
          'No se puede asignar un cliente: la emisión de la Factura Electrónica de esta venta está pendiente de confirmar con Alegra.',
        );
      }
      if (existing.status === 'CANCELLED') {
        throw new ConflictError('No se puede asignar un cliente a una venta anulada.');
      }
      if (dto.customerId) {
        const customer = await salesRepository.findCustomerById(dto.customerId);
        if (!customer) {
          throw new ConflictError('El cliente indicado no existe.');
        }
      }
    }

    const nextSucursalId = dto.sucursalId ?? existing.sucursalId;
    const nextDocumentNumber = dto.documentNumber ?? existing.documentNumber;

    if (
      nextDocumentNumber &&
      (nextSucursalId !== existing.sucursalId || nextDocumentNumber !== existing.documentNumber)
    ) {
      const existingByDocumentNumber = await salesRepository.findByDocumentNumber(
        nextSucursalId,
        nextDocumentNumber,
      );

      if (existingByDocumentNumber) {
        throw new ConflictError('El numero de documento ya se encuentra registrado.');
      }
    }

    const updatedSale = await salesRepository.update(
      id,
      {
        sucursalId: dto.sucursalId,
        userId: dto.userId,
        cashSessionId: dto.cashSessionId,
        documentNumber: dto.documentNumber,
        status: dto.status,
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference,
        saleDate: dto.saleDate,
        notes: dto.notes,
        customerId: dto.customerId,
        ...(dto.amountPaid !== undefined && {
          amountPaid: dto.amountPaid,
          changeGiven: toMoney(dto.amountPaid).sub(existing.total),
        }),
      },
      tx,
    );

    // Corre siempre (no solo cuando `amountPaid` viene en el DTO): un
    // cambio de `paymentMethod`/`cashSessionId` sin tocar `amountPaid`
    // tambien puede volver invalido o necesario el `CHANGE` activo (reglas
    // 5/6 aprobadas para este bloque).
    await syncChangeMovementAfterUpdate(updatedSale, tx);

    return updatedSale;
  }, transactionConfig.standard);

  return toSaleResponse(updated);
}

/**
 * Cuerpo transaccional de la anulacion (Bloque 3, "Anulacion/Correccion de
 * Venta"): cambia el estado a `CANCELLED`, reversa el inventario de cada
 * detalle con un movimiento `RETURN` (positivo — hasta este cambio, ese
 * valor del enum `InventoryMovementType` existia sin ningun uso real en
 * todo el sistema) y registra la auditoria — las tres escrituras en la
 * MISMA transaccion (`tx`): si el reverso de inventario fallara (ej. un
 * producto fue eliminado logicamente despues de la venta original), la
 * venta NO queda anulada a medias, y viceversa. La venta original nunca se
 * borra ni pierde sus detalles: solo cambia `status`, exactamente igual
 * que cualquier otra venta `CANCELLED`/`REFUNDED` ya soportada por el
 * modelo.
 *
 * Sprint QA 1 (fix de concurrencia): el cambio de estado usa
 * `salesRepository.tryCancel` (UPDATE condicional, `WHERE status !=
 * 'CANCELLED'`), no un `update` incondicional. Si `count === 0` (alguien
 * mas ya anulo/corrigio esta venta mientras esta transaccion esperaba —
 * la validacion de `voidSale`/`correctSale` que se hizo ANTES de abrir la
 * transaccion pudo haber quedado desactualizada), se aborta ANTES de
 * tocar inventario o auditoria: se lanza `ConflictError`, Prisma revierte
 * toda la transaccion (incluida, en el caso de `correctSale`, la venta
 * correctiva que se hubiera creado a continuacion).
 */
async function voidSaleTransaction(
  sale: SaleRecord,
  reason: string,
  performedByUserId: string,
  tx: DbClient,
) {
  const cancelResult = await salesRepository.tryCancel(sale.id, tx);

  if (cancelResult.count === 0) {
    throw new ConflictError(
      'La venta ya fue anulada o corregida por otra operación mientras se procesaba esta.',
    );
  }

  const updated = await salesRepository.findById(sale.id, tx);

  if (!updated) {
    throw new NotFoundError('Venta');
  }

  // Bloque LOTES-07 (QA integral, defecto real detectado): esta reversion
  // de inventario NUNCA habia considerado lotes -- para un producto con
  // `Product.requiresBatch`, anular o corregir una venta incrementaba
  // `Inventory.quantity` (via `recordMovements`, sin cambios) pero NINGUN
  // `Batch.availableQuantity` recibia ese mismo incremento, rompiendo en
  // silencio el invariante `SUM(Batch.availableQuantity WHERE status !=
  // DEPLETED) = Inventory.quantity`. Mismo motivo y misma solucion YA
  // aprobada para Devoluciones (LOTES-05, `returns/service.ts`): `SaleItem`
  // no registra de que lote(s) se descontio originalmente (una linea pudo
  // dividirse FEFO entre varios), asi que no hay forma de revertir al lote
  // EXACTO de origen -- se crea un lote de reingreso NUEVO reutilizando
  // `createBatchService` (sin `purchaseItemId` ni `supplierId`, `notes`
  // identifica el origen), y el movimiento `RETURN` que lo acompaña lleva
  // `batchId` + `skipBatchQuantitySync: true` (mismo motivo exacto que la
  // genesis de un lote en Compras/Devoluciones: ya nace con
  // `availableQuantity` = la cantidad reingresada).
  const distinctVoidProductIds = [...new Set(sale.items.map((item) => item.productId))];
  const voidBatchInfo = await salesRepository.findProductBatchFlagsByIds(
    distinctVoidProductIds,
    tx,
  );
  const requiresBatchByProductIdForVoid = new Map(
    voidBatchInfo.map((product) => [product.id, product.requiresBatch]),
  );
  const costByProductIdForVoid = new Map(voidBatchInfo.map((product) => [product.id, product.cost]));

  const voidMovementParams: RecordMovementParams[] = [];

  for (const item of sale.items) {
    if (!requiresBatchByProductIdForVoid.get(item.productId)) {
      voidMovementParams.push({
        tx,
        sucursalId: sale.sucursalId,
        productId: item.productId,
        userId: performedByUserId,
        type: InventoryMovementType.RETURN,
        quantity: Number(item.quantity),
        referenceType: InventoryReferenceType.SALE_VOID,
        referenceId: sale.id,
        reason,
      });
      continue;
    }

    const unitCost =
      item.unitCost !== null
        ? Number(item.unitCost)
        : Number(costByProductIdForVoid.get(item.productId) ?? 0);

    const reentryBatch = await createBatchService(
      {
        productId: item.productId,
        sucursalId: sale.sucursalId,
        receivedAt: new Date(),
        initialQuantity: Number(item.quantity),
        unitCost,
        notes: `Reingreso por anulación de venta ${sale.id}, línea ${item.id}.`,
      },
      tx,
    );

    voidMovementParams.push({
      tx,
      sucursalId: sale.sucursalId,
      productId: item.productId,
      userId: performedByUserId,
      type: InventoryMovementType.RETURN,
      quantity: Number(item.quantity),
      referenceType: InventoryReferenceType.SALE_VOID,
      referenceId: sale.id,
      reason,
      batchId: reentryBatch.id,
      skipBatchQuantitySync: true,
    });
  }

  await recordMovements(voidMovementParams);

  await auditService.log({
    // Sprint QA 3.3: este mismo cuerpo se ejecuta tanto para una anulacion
    // real (`voidSale`) como para el paso de anular la venta original dentro
    // de una correccion (`correctSale`) — en ambos casos la fila describe el
    // mismo evento (la venta paso a CANCELLED), asi que `SALE_VOID` aplica
    // por igual. `correctSale` distingue el paso de creacion de la venta
    // correctiva con su PROPIO evento `SALE_CORRECTION` (ver mas abajo) — no
    // se colapsan ambos eventos en uno solo, se preserva la misma
    // trazabilidad de dos filas que ya existia via `metadata.type`.
    action: AuditAction.SALE_VOID,
    entity: 'Sale',
    entityId: sale.id,
    userId: performedByUserId,
    sucursalId: sale.sucursalId,
    before: { status: sale.status },
    after: { status: 'CANCELLED' },
    metadata: { type: 'VOID', reason },
    tx,
  });

  return updated;
}

/**
 * Anula una venta (Bloque 3). La venta NUNCA se edita mas alla de su
 * `status`: no se tocan `items`, totales, ni ningun otro campo — la unica
 * forma de "corregir" el contenido de una venta es `correctSale()`, que
 * anula esta y crea una venta nueva.
 */
export async function voidSale(id: string, dto: VoidSaleDto): Promise<SaleResponse> {
  const existing = await salesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Venta');
  }

  if (existing.status === 'CANCELLED') {
    throw new ConflictError('La venta ya se encuentra anulada.');
  }

  const updated = await prisma.$transaction(
    (tx) => voidSaleTransaction(existing, dto.reason, dto.performedByUserId, tx),
    transactionConfig.bulk,
  );

  return toSaleResponse(updated);
}

/**
 * Corrige una venta (Bloque 3): NUNCA edita la venta original in-place.
 * En una unica transaccion, (1) anula la venta original exactamente igual
 * que `voidSale` (mismo motivo, misma reversa de inventario, misma
 * auditoria) y (2) crea una venta nueva con los datos corregidos —
 * reutilizando `createSaleTransaction` tal cual (mismo calculo de
 * totales, misma validacion de stock/productos/impuestos, mismo registro
 * de movimientos `SALE`), con `originalSaleId` enlazando ambas. La venta
 * correctiva SIEMPRE hereda `sucursalId`/`cashSessionId` de la original:
 * es una correccion de ESA venta, no una venta nueva e independiente en
 * otra sucursal o sesion.
 *
 * Sin reintento de numero de documento (a diferencia de `create()`/
 * `createSaleWithGeneratedDocumentNumber`): esta transaccion ya hace mas
 * de una escritura relacionada (anular + crear); reintentar la
 * transaccion COMPLETA ante una colision de numero autogenerado
 * reanularia una venta ya anulada. Una colision aqui es un caso extremo
 * (el mismo consecutivo global de `create()`); si ocurre, el error de
 * Postgres llega sin traducir, igual que cualquier otro error inesperado
 * de esta operacion.
 */
export async function correctSale(id: string, dto: CorrectSaleDto): Promise<CorrectSaleResult> {
  const existing = await salesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Venta');
  }

  if (existing.status === 'CANCELLED') {
    throw new ConflictError('La venta ya se encuentra anulada.');
  }

  if (existing.correctedBySale) {
    throw new ConflictError('La venta ya fue corregida anteriormente.');
  }

  const correctedSale = await prisma.$transaction(async (tx) => {
    await voidSaleTransaction(existing, dto.reason, dto.performedByUserId, tx);

    const createDto: CreateSaleDto = {
      sucursalId: existing.sucursalId,
      userId: dto.performedByUserId,
      cashSessionId: existing.cashSessionId,
      // Bloque 8.3: preserva el mismo cliente de la venta original — una
      // correccion reemplaza la venta, no cambia quien la compro.
      customerId: existing.customerId,
      paymentMethod: dto.paymentMethod,
      paymentReference: dto.paymentReference,
      amountPaid: dto.amountPaid,
      notes: dto.notes,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      items: dto.items,
    };

    const created = await createSaleTransaction(createDto, tx, existing.id);

    await auditService.log({
      // Segundo evento de `correctSale` (ver nota de `SALE_VOID` en
      // `voidSaleTransaction`): esta fila es la creacion de la venta
      // correctiva, un evento distinto al de anular la original.
      action: AuditAction.SALE_CORRECTION,
      entity: 'Sale',
      entityId: created.id,
      userId: dto.performedByUserId,
      sucursalId: existing.sucursalId,
      before: null,
      after: { originalSaleId: existing.id },
      metadata: { type: 'CORRECTION', reason: dto.reason, originalSaleId: existing.id },
      tx,
    });

    return created;
  }, transactionConfig.bulk);

  // Se releen ambas ventas DESPUES de que la transaccion confirma (en vez
  // de devolver los objetos ya obtenidos durante la transaccion): la
  // venta original se anulo ANTES de que la correctiva existiera, asi que
  // su relacion `correctedBySale` (resuelta en el momento de esa
  // escritura) todavia aparecia vacia — solo una lectura posterior a que
  // ambas escrituras confirmaron refleja la relacion completa en los dos
  // sentidos.
  const [originalWithRelations, correctedWithRelations] = await Promise.all([
    salesRepository.findById(existing.id),
    salesRepository.findById(correctedSale.id),
  ]);

  if (!originalWithRelations || !correctedWithRelations) {
    throw new NotFoundError('Venta');
  }

  return {
    original: toSaleResponse(originalWithRelations),
    corrected: toSaleResponse(correctedWithRelations),
  };
}
