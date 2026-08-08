/**
 * shared/services/pricingAnalysis/pricingAnalysis.ts
 * -----------------------------------------------------------------------------
 * COORDINADOR DE RENTABILIDAD COMERCIAL. Dos puntos de entrada:
 *  - `analyzePromotionProfitability()` (PROMO-08): SIMULACION para la
 *    vista previa administrativa del formulario de Promociones.
 *  - `calculateLineProfitability()` (PROMO-09): INTEGRACION real, usada
 *    por `sales/service.ts` sobre el resultado YA calculado de una venta.
 *
 * ARQUITECTURA (PROMO-02): este archivo NO reimplementa ninguna formula
 * de `CostEngine` ni de `PromotionEngine` — los invoca tal cual, a traves
 * de sus barrels publicos (`@/shared/services/costEngine`,
 * `@/shared/services/promotionEngine`), exactamente igual que ya hace
 * `sales/service.ts`. Ninguno de los dos motores se modifica ni sabe que
 * este coordinador existe. Funciones puras: sin Prisma, sin persistencia.
 *
 * `computeMarginBreakdown()` (privada) es la formula de margen/aporte del
 * proveedor compartida por ambos puntos de entrada — un solo lugar que la
 * conoce, para no repetirla entre la simulacion y la integracion real.
 *
 * `analyzePromotionProfitability()` — SIMULACION, NO EVALUACION REAL: para
 * poder reutilizar `evaluatePromotions()` sin tocarlo, se arma un carrito
 * temporal de UNA sola linea con un producto/categoria "placeholder" que
 * SIEMPRE coincide con el `scopeType` de la promocion (se agrega el mismo
 * placeholder a `products`/`categoryIds` de la promocion simulada) — asi
 * el motor evalua la misma mecanica (PERCENTAGE/FIXED_AMOUNT/
 * SPECIAL_PRICE/FIXED_PRICE/BUY_X_PAY_Y) que usaria en una venta real, sin que la
 * vista previa dependa de que el producto de referencia ya este asociado
 * a la promocion en el catalogo.
 *
 * DELIBERADAMENTE IGNORADO (solo en la simulacion): vigencia
 * (`active`/fechas/horas/dias) — la promocion simulada siempre se arma
 * `active: true`, sin fechas/horas/dias. El objetivo de esa vista previa
 * es "cuanto se ganaria/perderia SI la promocion aplicara", no "aplicaria
 * en este instante" (esa pregunta ya la responde la narrativa de vigencia
 * del propio formulario) — sin este ajuste, editar un "Martes de Pechuga"
 * un miercoles mostraria la vista previa vacia, que no es el objetivo.
 * `calculateLineProfitability()` (PROMO-09) NO tiene este problema: recibe
 * el precio YA ajustado de una venta REAL, donde la vigencia ya se
 * evaluo correctamente en `evaluatePromotions()`.
 *
 * LIMITACION CONOCIDA de la simulacion (`scopeType: COMBO`): un combo
 * real exige varios productos DISTINTOS con sus propias cantidades — esa
 * vista previa simula un unico producto de referencia, asi que un combo
 * que necesite mas de un producto no encontrara elegibilidad completa y
 * el resultado reflejara "sin descuento" para esa combinacion
 * (economicamente correcto para lo que SI se puede simular, pero no
 * representa el combo completo). Documentado, no resuelto en ese bloque.
 * No aplica a `calculateLineProfitability()` (PROMO-09): esa recibe el
 * carrito REAL, con todas sus lineas.
 */
import { getEffectiveCost } from '@/shared/services/costEngine';
import type { CostContext } from '@/shared/services/costEngine';
import { evaluatePromotions } from '@/shared/services/promotionEngine';
import type { EngineCartLine, EngineContext, EnginePromotion } from '@/shared/services/promotionEngine';
import type {
  LineProfitabilityAnalysis,
  LineProfitabilityInput,
  PricingAnalysisProductInput,
  PricingAnalysisPromotionInput,
  PricingFundingType,
  PromotionProfitabilityAnalysis,
} from './pricingAnalysis.types';

const PREVIEW_PRODUCT_ID = '__pricing-analysis-preview-product__';
const PREVIEW_CATEGORY_ID = '__pricing-analysis-preview-category__';
const PREVIEW_SUCURSAL_ID = '__pricing-analysis-preview-sucursal__';

/**
 * Formula de margen/aporte del proveedor compartida por
 * `analyzePromotionProfitability()` y `calculateLineProfitability()` —
 * unico lugar que la conoce. Puramente aritmetica: no decide nada sobre
 * promociones ni costos, solo combina los 3 numeros que ya le llegan
 * calculados.
 */
function computeMarginBreakdown(input: {
  effectiveCost: number;
  salePrice: number;
  supplierContributionPerUnit: number;
}): { profit: number; finalProfitability: number; marginPercent: number | null } {
  const netCostPerUnit = input.effectiveCost - input.supplierContributionPerUnit;
  const profit = input.salePrice - input.effectiveCost;
  const finalProfitability = input.salePrice - netCostPerUnit;
  const marginPercent = input.salePrice > 0 ? (finalProfitability / input.salePrice) * 100 : null;

  return { profit, finalProfitability, marginPercent };
}

/**
 * PROMO-10: aporte TOTAL de UNA promocion especifica (no por unidad) —
 * misma granularidad que `amountApplied`/`EngineAppliedPromotion.amount`
 * (el monto REAL que esa promocion descolto en esta linea/simulacion).
 * Es el numero que se snapshotea tal cual en
 * `SaleAppliedPromotion.supplierContributionAmount` — exportada porque
 * `sales/service.ts` tambien la necesita directamente al persistir cada
 * fila (una por promocion aplicada), no solo agregada por linea como
 * hace `calculateLineProfitability()`.
 */
export function calculatePromotionSupplierContribution(input: {
  fundingType: PricingFundingType;
  supplierSubsidyValue: number | null;
  /** Monto de ESTA promocion especifica (no el descuento acumulado de
   * varias promociones en la misma linea) — base del porcentaje para
   * `SUPPLIER_SUBSIDY_PERCENTAGE`, y unidad de referencia (junto con
   * `quantity`) para `SUPPLIER_SUBSIDY_PER_UNIT`. */
  amountApplied: number;
  quantity: number;
}): number {
  if (input.fundingType === 'SUPPLIER_SUBSIDY_PER_UNIT' && input.supplierSubsidyValue != null) {
    return input.supplierSubsidyValue * input.quantity;
  }

  if (input.fundingType === 'SUPPLIER_SUBSIDY_PERCENTAGE' && input.supplierSubsidyValue != null) {
    return input.amountApplied * (input.supplierSubsidyValue / 100);
  }

  return 0;
}

/** Aporte por unidad de UNA promocion — mismo calculo que
 * `calculatePromotionSupplierContribution()`, dividido por `quantity`
 * (usado internamente para el margen por unidad; el aporte TOTAL vive en
 * la funcion exportada de arriba). */
function computeSupplierContributionPerUnit(input: {
  fundingType: PricingFundingType;
  supplierSubsidyValue: number | null;
  amountApplied: number;
  quantity: number;
}): number {
  const total = calculatePromotionSupplierContribution(input);
  return input.quantity > 0 ? total / input.quantity : 0;
}

/**
 * Calcula la simulacion de rentabilidad de una promocion sobre un
 * producto de referencia, o `null` si no hay suficiente informacion
 * valida para hacerlo (mismo criterio que `costEnginePreview.ts` en el
 * frontend: entrada invalida => sin vista previa, nunca una excepcion).
 */
export function analyzePromotionProfitability(
  product: PricingAnalysisProductInput,
  promotion: PricingAnalysisPromotionInput,
): PromotionProfitabilityAnalysis | null {
  if (!Number.isFinite(product.averageCost) || product.averageCost < 0) {
    return null;
  }

  if (!Number.isFinite(product.salePrice) || product.salePrice < 0) {
    return null;
  }

  // Mismo rango que valida `getEffectiveCost()` — se verifica ANTES de
  // llamarlo para devolver `null` en vez de dejar que lance
  // `ValidationError` (esta funcion nunca debe lanzar, es una vista
  // previa que corre en cada cambio del formulario).
  if (
    product.applyExpectedWasteToCost &&
    (!Number.isFinite(product.expectedWastePercent) ||
      product.expectedWastePercent < 0 ||
      product.expectedWastePercent >= 100)
  ) {
    return null;
  }

  const costContext: CostContext = {
    averageCost: product.averageCost,
    wastePercent: product.expectedWastePercent,
    applyExpectedWasteToCost: product.applyExpectedWasteToCost,
  };
  const { effectiveCost } = getEffectiveCost(costContext);

  // Cantidad minima que satisface, a la vez, `buyQuantity` (BUY_X_PAY_Y)
  // y `minQuantity` (condicion de cantidad) de la propia promocion — para
  // que la simulacion represente el caso en que la promocion SI aplica.
  const simulatedQuantity = Math.max(
    1,
    promotion.buyQuantity ?? 0,
    promotion.minQuantity != null ? Math.ceil(promotion.minQuantity) : 0,
  );

  const cart: EngineCartLine[] = [
    {
      lineId: 'preview',
      productId: PREVIEW_PRODUCT_ID,
      categoryId: PREVIEW_CATEGORY_ID,
      quantity: simulatedQuantity,
      unitPrice: product.salePrice,
    },
  ];

  const enginePromotion: EnginePromotion = {
    id: 'preview',
    name: 'preview',
    scopeType: promotion.scopeType,
    effectType: promotion.effectType,
    effectValue: promotion.effectValue,
    buyQuantity: promotion.buyQuantity,
    payQuantity: promotion.payQuantity,
    minQuantity: promotion.minQuantity,
    startDate: null,
    endDate: null,
    startTime: null,
    endTime: null,
    daysOfWeek: [],
    priority: 0,
    stackable: false,
    exclusiveGroup: null,
    active: true,
    sucursalId: null,
    products: [{ productId: PREVIEW_PRODUCT_ID, requiredQuantity: null }],
    categoryIds: [PREVIEW_CATEGORY_ID],
  };

  const context: EngineContext = { now: new Date(), sucursalId: PREVIEW_SUCURSAL_ID };

  const result = evaluatePromotions(cart, [enginePromotion], context);

  const totalBeforePromotion = simulatedQuantity * product.salePrice;
  const totalAfterPromotion = totalBeforePromotion - result.totalDiscount;
  const salePrice = totalAfterPromotion / simulatedQuantity;

  const supplierContributionPerUnit = computeSupplierContributionPerUnit({
    fundingType: promotion.fundingType,
    supplierSubsidyValue: promotion.supplierSubsidyValue,
    amountApplied: result.totalDiscount,
    quantity: simulatedQuantity,
  });

  const { profit, finalProfitability, marginPercent } = computeMarginBreakdown({
    effectiveCost,
    salePrice,
    supplierContributionPerUnit,
  });

  return {
    simulatedQuantity,
    salePrice,
    effectiveCost,
    profit,
    marginPercent,
    supplierContributionPerUnit,
    supplierContributionTotal: supplierContributionPerUnit * simulatedQuantity,
    finalProfitability,
  };
}

/**
 * PROMO-09: calcula utilidad/margen/aporte del proveedor/rentabilidad
 * final para UNA linea de una venta REAL (o su cotizacion), a partir del
 * resultado YA calculado por `PromotionApplicationService` — "no
 * recalcular promociones": esta funcion nunca invoca `evaluatePromotions()`,
 * solo combina numeros que ya existen (`unitPriceAfterPromotion`,
 * `effectiveCost`) con los campos comerciales de cada promocion aplicada.
 * `null` si no hay suficiente informacion valida (mismo criterio que
 * `analyzePromotionProfitability`: entrada invalida => sin analisis,
 * nunca una excepcion — esta funcion corre dentro de `computeSaleQuoteCalculation()`,
 * que no debe fallar por un dato de rentabilidad incompleto).
 */
export function calculateLineProfitability(
  input: LineProfitabilityInput,
): LineProfitabilityAnalysis | null {
  if (!Number.isFinite(input.effectiveCost) || input.effectiveCost < 0) {
    return null;
  }

  if (!Number.isFinite(input.unitPriceAfterPromotion) || input.unitPriceAfterPromotion < 0) {
    return null;
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return null;
  }

  // Suma el aporte de CADA promocion aplicada a esta linea por separado
  // (cada una financia unicamente su propia porcion del descuento) — si
  // no hubo ninguna (`appliedPromotionsFunding` vacio, linea sin
  // promocion), el aporte total es 0, mismo resultado que
  // `fundingType: NONE`.
  const supplierContributionPerUnit = input.appliedPromotionsFunding.reduce(
    (sum, funding) =>
      sum +
      computeSupplierContributionPerUnit({
        fundingType: funding.fundingType,
        supplierSubsidyValue: funding.supplierSubsidyValue,
        amountApplied: funding.amountApplied,
        quantity: input.quantity,
      }),
    0,
  );

  const { profit, finalProfitability, marginPercent } = computeMarginBreakdown({
    effectiveCost: input.effectiveCost,
    salePrice: input.unitPriceAfterPromotion,
    supplierContributionPerUnit,
  });

  return {
    quantity: input.quantity,
    salePrice: input.unitPriceAfterPromotion,
    effectiveCost: input.effectiveCost,
    profit,
    marginPercent,
    supplierContributionPerUnit,
    supplierContributionTotal: supplierContributionPerUnit * input.quantity,
    finalProfitability,
    finalProfitabilityTotal: finalProfitability * input.quantity,
  };
}
