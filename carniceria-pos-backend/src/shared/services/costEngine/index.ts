/**
 * shared/services/costEngine/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del Motor de Costos (CostEngine, Bloque
 * COST-01). Quien necesite el motor (fases futuras de integracion con
 * Ventas/Reportes/Dashboard/Precios) importa unicamente desde aca — nada
 * fuera de esta carpeta debe importar `costEngine.ts` ni
 * `strategies/percentageWaste.strategy.ts` directamente.
 */
export { getEffectiveCost } from './costEngine';
export type {
  CostAdjustmentStrategy,
  CostAdjustmentType,
  CostContext,
  CostEngineResult,
} from './types';
