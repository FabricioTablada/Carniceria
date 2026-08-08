/**
 * shared/services/pricingAnalysis/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del coordinador de rentabilidad comercial
 * (PROMO-08 simulacion, PROMO-09 integracion real). Quien lo necesite
 * importa unicamente desde aca — mismo criterio que
 * `costEngine`/`promotionEngine`.
 */
export {
  analyzePromotionProfitability,
  calculateLineProfitability,
  calculatePromotionSupplierContribution,
} from './pricingAnalysis';
export type {
  LinePromotionFundingInput,
  LineProfitabilityAnalysis,
  LineProfitabilityInput,
  PricingAnalysisProductInput,
  PricingAnalysisPromotionInput,
  PricingFundingType,
  PromotionProfitabilityAnalysis,
} from './pricingAnalysis.types';
