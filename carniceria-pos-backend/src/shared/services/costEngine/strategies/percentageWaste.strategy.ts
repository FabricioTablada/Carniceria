/**
 * shared/services/costEngine/strategies/percentageWaste.strategy.ts
 * -----------------------------------------------------------------------------
 * Estrategia de ajuste de costo por merma esperada en PORCENTAJE (Bloque
 * COST-01) — la unica aprobada hoy. Formula aprobada en el analisis
 * (Bloque YIELD-01, §1.2):
 *
 *   effectiveCost = averageCost / (1 - wastePercent / 100)
 *
 * Razonamiento de negocio: si se compran 100 kg a un costo `averageCost`
 * por kg y se espera perder `wastePercent`% en merma, solo
 * `100 * (1 - wastePercent/100)` kg quedan vendibles. Para recuperar el
 * costo total invertido sobre esos kilos vendibles, el costo real por kilo
 * vendible es `averageCost / (1 - wastePercent/100)` — no
 * `averageCost * (1 + wastePercent/100)`, que subestimaria el costo real.
 *
 * Esta estrategia NO valida `wastePercent` (0 <= wastePercent < 100): esa
 * responsabilidad es UNICAMENTE de `getEffectiveCost()` (`costEngine.ts`),
 * antes de invocar cualquier estrategia — evita repetir la misma
 * validacion en cada estrategia futura (merma fija, rendimiento por
 * corte, etc.).
 */
import type { CostAdjustmentStrategy, CostContext } from '../types';

export const percentageWasteStrategy: CostAdjustmentStrategy = {
  type: 'PERCENTAGE_WASTE',
  calculate(context: CostContext): number {
    return context.averageCost / (1 - context.wastePercent / 100);
  },
};
