/**
 * shared/services/promotionEngine/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del Motor de Reglas de Promociones (Bloque
 * P.4). Quien necesite el motor (bloque futuro de integracion con
 * `sales.service.ts` y/o un endpoint de cotizacion) importa unicamente
 * desde aca — nada fuera de esta carpeta debe importar los archivos
 * internos (`eligibility.ts`, `conditions.ts`, `calculation.ts`)
 * directamente.
 */
export { evaluatePromotions } from './promotionEngine';
export type {
  EngineAppliedPromotion,
  EngineCartLine,
  EngineContext,
  EngineDayOfWeek,
  EnginePromotion,
  EnginePromotionProduct,
  PromotionEffectType,
  PromotionEngineResult,
  PromotionScopeType,
} from './promotionEngine.types';
