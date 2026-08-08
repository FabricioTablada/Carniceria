/**
 * shared/services/costEngine/costEngine.ts
 * -----------------------------------------------------------------------------
 * MOTOR DE COSTOS (CostEngine, Bloque COST-01) — orquestador. Unico punto
 * de entrada del motor: `getEffectiveCost()`.
 *
 * ARQUITECTURA (analisis aprobado, Bloque YIELD-01; mismo criterio ya
 * probado con `shared/services/promotionEngine/`): este motor NUNCA
 * persiste nada, nunca importa Prisma, nunca llama a ningun repositorio ni
 * a ningun otro modulo. Recibe un `CostContext` (costo promedio + merma
 * esperada + si el producto participa de la regla) y devuelve un resultado
 * en memoria. Cargar el `Product` real y decidir que hacer con el
 * resultado es responsabilidad de quien invoque este motor (fases futuras
 * de integracion con Ventas/Reportes/Dashboard/Precios) — este archivo no
 * sabe que esos modulos existen.
 *
 * REGLA CRITICA: `Product.cost` (aca, `CostContext.averageCost`) NUNCA se
 * modifica por este motor — solo se lee, para derivar `effectiveCost` en
 * memoria. `effectiveCost` NUNCA se persiste.
 *
 * ESTRATEGIAS (`strategies/`): agregar una estrategia nueva es agregar un
 * archivo + una entrada en `STRATEGIES`, sin ningun `if`/`else` en cascada
 * y sin tocar `getEffectiveCost()` — mismo patron ya aprobado en
 * `promotionEngine/calculation.ts` (`EFFECT_CALCULATORS`).
 */
import { ValidationError } from '@/shared/errors';
import { percentageWasteStrategy } from './strategies/percentageWaste.strategy';
import type { CostAdjustmentStrategy, CostAdjustmentType, CostContext, CostEngineResult } from './types';

/** Estrategias de ajuste de costo disponibles, indexadas por su `type`.
 * Hoy solo existe una — la unica aprobada — pero la tabla ya esta lista
 * para mas sin cambiar la forma en que se seleccionan. */
const STRATEGIES: Record<CostAdjustmentType, CostAdjustmentStrategy> = {
  PERCENTAGE_WASTE: percentageWasteStrategy,
};

/** Estrategia usada cuando `applyExpectedWasteToCost: true` (Bloque
 * COST-01: unica aprobada). Si en el futuro un producto necesita elegir
 * ENTRE varias estrategias, este valor pasaria a venir de `CostContext`
 * (cambio aditivo sobre el tipo, sin romper el contrato actual) en vez de
 * estar fijo aca. */
const DEFAULT_STRATEGY_TYPE: CostAdjustmentType = 'PERCENTAGE_WASTE';

/**
 * Punto de entrada unico del motor. Funcion pura: mismo input siempre
 * produce el mismo output, sin efectos secundarios, sin acceso a base de
 * datos.
 *
 * Compatibilidad (requisito del Bloque COST-01): si
 * `context.applyExpectedWasteToCost` es `false`, se devuelve el costo
 * promedio sin ningun ajuste ni ninguna validacion de `wastePercent` —
 * exactamente el comportamiento actual del sistema, sin excepcion, sin
 * importar que valor tenga `wastePercent` (un producto con merma esperada
 * mal cargada pero el interruptor apagado nunca debe romperse).
 *
 * Validaciones (solo quando `applyExpectedWasteToCost` es `true`, unico
 * caso en que `wastePercent` participa de una division):
 *  - `wastePercent >= 0` (una merma negativa no tiene sentido de negocio).
 *  - `wastePercent < 100` (a partir de 100, la formula divide entre cero o
 *    produce un costo negativo/infinito — nunca se permite).
 */
export function getEffectiveCost(context: CostContext): CostEngineResult {
  if (!context.applyExpectedWasteToCost) {
    return {
      averageCost: context.averageCost,
      effectiveCost: context.averageCost,
      adjustmentApplied: false,
      adjustmentType: null,
      wastePercent: context.wastePercent,
    };
  }

  if (context.wastePercent < 0) {
    throw new ValidationError('El porcentaje de merma esperada no puede ser negativo.');
  }

  if (context.wastePercent >= 100) {
    throw new ValidationError(
      'El porcentaje de merma esperada debe ser menor a 100 para calcular un costo efectivo.',
    );
  }

  const strategy = STRATEGIES[DEFAULT_STRATEGY_TYPE];
  const effectiveCost = strategy.calculate(context);

  return {
    averageCost: context.averageCost,
    effectiveCost,
    adjustmentApplied: true,
    adjustmentType: strategy.type,
    wastePercent: context.wastePercent,
  };
}
