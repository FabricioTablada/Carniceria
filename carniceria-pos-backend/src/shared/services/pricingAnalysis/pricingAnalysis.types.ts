/**
 * shared/services/pricingAnalysis/pricingAnalysis.types.ts
 * -----------------------------------------------------------------------------
 * Tipos de la capa coordinadora de rentabilidad comercial (PROMO-08,
 * Commercial Pricing Engine). Solo formas de datos — sin logica, sin
 * Prisma, sin acceso a base de datos. Mismo criterio ya aprobado para
 * `costEngine.types.ts`/`promotionEngine.types.ts`: formas MINIMAS y
 * auto-contenidas, nunca un `Product`/`Promotion` de Prisma directamente.
 *
 * ARQUITECTURA (PROMO-02, "Como integrar CostEngine para calcular
 * automaticamente la utilidad y el margen"): este modulo NO es un motor
 * nuevo — es un COORDINADOR puro que combina el resultado ya existente de
 * `CostEngine.getEffectiveCost()` y `PromotionEngine.evaluatePromotions()`
 * sin modificar ninguno de los dos. Sin persistencia.
 *
 * PROMO-08: `PricingAnalysisProductInput`/`PricingAnalysisPromotionInput`/
 * `PromotionProfitabilityAnalysis` + `analyzePromotionProfitability()` —
 * SIMULACION para la vista previa administrativa del formulario de
 * Promociones (invoca `evaluatePromotions()` sobre un carrito temporal de
 * un unico producto de referencia).
 *
 * PROMO-09: `LineProfitabilityInput`/`LinePromotionFundingInput`/
 * `LineProfitabilityAnalysis` + `calculateLineProfitability()` —
 * INTEGRACION real en `sales/service.ts` (`computeSaleQuoteCalculation()`). NO
 * vuelve a invocar `evaluatePromotions()` ("no recalcular promociones") —
 * recibe el resultado YA calculado por `PromotionApplicationService`
 * (precio ajustado por linea, montos ya prorrateados por promocion) y
 * unicamente combina eso con `CostEngine.getEffectiveCost()` (tambien ya
 * calculado por `computeItems()`) y los campos comerciales de cada
 * promocion aplicada.
 */

/** Datos MINIMOS del producto de referencia que la vista previa necesita
 * — mismo criterio que `CostContext`, no un `Product` de Prisma. */
export interface PricingAnalysisProductInput {
  /** `Product.cost` (costo promedio). */
  averageCost: number;
  /** `Product.expectedWastePercent`. */
  expectedWastePercent: number;
  /** `Product.applyExpectedWasteToCost`. */
  applyExpectedWasteToCost: boolean;
  /** `Product.salePrice` — precio de venta vigente, ANTES de la
   * promocion. */
  salePrice: number;
}

/** Financiamiento del descuento — mismo vocabulario que
 * `PromotionFundingType` (`modules/promotions/promotions.types.ts`),
 * redeclarado aca para no acoplar este modulo a ese (mismo criterio ya
 * usado por `EnginePromotion` con `PromotionScopeType`/`PromotionEffectType`). */
export type PricingFundingType = 'NONE' | 'SUPPLIER_SUBSIDY_PER_UNIT' | 'SUPPLIER_SUBSIDY_PERCENTAGE';

/** Datos MINIMOS de la promocion a simular — subconjunto de
 * `EnginePromotion` (mecanica) + los 2 campos comerciales de PROMO-03
 * (financiamiento). Quien invoque este coordinador (frontend o un futuro
 * endpoint) traduce la promocion real a esta forma. */
export interface PricingAnalysisPromotionInput {
  scopeType: 'PRODUCT' | 'CATEGORY' | 'COMBO' | 'CART';
  effectType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'SPECIAL_PRICE' | 'FIXED_PRICE' | 'BUY_X_PAY_Y';
  effectValue: number | null;
  buyQuantity: number | null;
  payQuantity: number | null;
  minQuantity: number | null;
  fundingType: PricingFundingType;
  supplierSubsidyValue: number | null;
}

/** Resultado de la simulacion — los 6 datos que PROMO-08 pide mostrar,
 * mas la cantidad simulada (para que quien lo muestre pueda aclarar
 * "por cada N unidades" cuando `simulatedQuantity > 1`, ej. `BUY_X_PAY_Y`). */
export interface PromotionProfitabilityAnalysis {
  /** Cantidad usada para la simulacion (mayor entre 1, `buyQuantity` y
   * `minQuantity` redondeado hacia arriba) — la minima cantidad que
   * satisface las condiciones de la propia promocion. */
  simulatedQuantity: number;
  /** Precio de venta EFECTIVO por unidad, ya con el descuento de la
   * promocion aplicado (antes de la promocion es `product.salePrice`). */
  salePrice: number;
  /** Costo efectivo del producto (`CostEngine`, SIN considerar esta
   * promocion — el costo de producirlo/comprarlo no cambia por venderlo
   * en oferta). */
  effectiveCost: number;
  /** Utilidad BRUTA por unidad: `salePrice - effectiveCost`, SIN
   * descontar el aporte del proveedor — "si el negocio absorbiera todo
   * el descuento solo". */
  profit: number;
  /** Margen REAL (%), ya considerando el aporte del proveedor —
   * `finalProfitability / salePrice * 100`. `null` si `salePrice` es 0
   * (division indefinida). */
  marginPercent: number | null;
  /** Cuanto devuelve el proveedor por unidad (0 si `fundingType: NONE`). */
  supplierContributionPerUnit: number;
  /** `supplierContributionPerUnit * simulatedQuantity`. */
  supplierContributionTotal: number;
  /** Rentabilidad FINAL por unidad: `salePrice - (effectiveCost -
   * supplierContributionPerUnit)` — la utilidad real del negocio una vez
   * que el proveedor devuelve su parte. Igual a `profit` cuando
   * `fundingType: NONE`. */
  finalProfitability: number;
}

/**
 * PROMO-09: el financiamiento de UNA promocion que ya aplico a una linea
 * de venta real — puede haber mas de una si la linea acumulo varias
 * promociones (`stackable`). `amountApplied` es el monto YA prorrateado
 * para esta linea especificamente (`PromotionApplicationAppliedPromotion.amountApplied`,
 * `modules/promotions/promotionApplication.types.ts`) — necesario para
 * `SUPPLIER_SUBSIDY_PERCENTAGE`, que se calcula como un % de LO QUE ESTA
 * promocion especifica desconto, no del descuento total de la linea (si
 * hay mas de una promocion en la misma linea, cada una financia
 * unicamente su propia porcion).
 */
export interface LinePromotionFundingInput {
  fundingType: PricingFundingType;
  supplierSubsidyValue: number | null;
  amountApplied: number;
}

/**
 * Datos MINIMOS de una linea de venta YA procesada por
 * `PromotionApplicationService` — a diferencia de
 * `PricingAnalysisPromotionInput` (PROMO-08), esto NO incluye
 * `scopeType`/`effectType`/`buyQuantity`/etc.: el descuento por
 * promocion ya esta calculado (`unitPriceAfterPromotion`), asi que esta
 * funcion no necesita saber COMO se calculo, solo el resultado — "no
 * recalcular promociones".
 */
export interface LineProfitabilityInput {
  quantity: number;
  /** `CostEngine.getEffectiveCost()` ya calculado por `computeItems()`
   * (`sales/service.ts`) — mismo valor que usa `assertNoBelowCostSale`,
   * sin volver a invocar el motor. */
  effectiveCost: number;
  /** Precio unitario ANTES de cualquier promocion automatica
   * (`ComputedSaleItem.unitPrice`). */
  unitPriceBeforePromotion: number;
  /** Precio unitario DESPUES de las promociones automaticas ya aplicadas
   * a esta linea (`PromotionApplicationLineResult.adjustedLineSubtotal /
   * quantity`) — el dato que `PromotionApplicationService` ya calculo,
   * nunca recalculado aca. */
  unitPriceAfterPromotion: number;
  /** Una entrada por cada promocion automatica que afecto esta linea
   * (vacio si ninguna aplico — la linea se vende a precio de lista). */
  appliedPromotionsFunding: LinePromotionFundingInput[];
}

/** Resultado de la integracion real (PROMO-09) — mismos 6 datos que
 * `PromotionProfitabilityAnalysis` (PROMO-08), mas el total de la linea
 * completa (`finalProfitabilityTotal`), util porque aca SI hay una
 * cantidad real vendida, no una cantidad minima simulada. */
export interface LineProfitabilityAnalysis {
  quantity: number;
  salePrice: number;
  effectiveCost: number;
  profit: number;
  marginPercent: number | null;
  supplierContributionPerUnit: number;
  supplierContributionTotal: number;
  finalProfitability: number;
  /** `finalProfitability * quantity` — utilidad real de la linea
   * completa, no solo por unidad. */
  finalProfitabilityTotal: number;
}
