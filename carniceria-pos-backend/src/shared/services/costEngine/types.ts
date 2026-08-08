/**
 * shared/services/costEngine/types.ts
 * -----------------------------------------------------------------------------
 * Tipos del Motor de Costos (CostEngine, Bloque COST-01). Solo formas de
 * datos — sin logica, sin Prisma, sin acceso a base de datos. Mismo
 * criterio ya aprobado para `promotionEngine.types.ts`: el motor recibe una
 * forma MINIMA y auto-contenida (`CostContext`), nunca un `Product` de
 * Prisma directamente, para que pueda probarse y usarse sin depender de la
 * capa HTTP/DTO de ningun modulo ni de un cliente de base de datos real.
 *
 * ARQUITECTURA (analisis aprobado, Bloque YIELD-01): este motor es
 * puramente de CALCULO. Nunca persiste nada, nunca modifica `Product.cost`
 * — recibe el costo promedio y la merma esperada ya resueltos por quien lo
 * invoque, y devuelve el costo efectivo calculado en memoria. Cargar el
 * `Product` real desde la base de datos y decidir que hacer con el
 * resultado es responsabilidad exclusiva de cada modulo consumidor
 * (Ventas/Reportes/Dashboard/Precios, todos en fases futuras de
 * integracion) — este archivo no sabe que esos modulos existen.
 */

/**
 * Tipo de estrategia de ajuste de costo. Hoy solo existe
 * `PERCENTAGE_WASTE` (merma esperada como porcentaje, la unica aprobada en
 * el Bloque COST-01) — preparado para agregar mas (merma fija, rendimiento
 * por corte, etc.) agregando un archivo bajo `strategies/` y una entrada en
 * `STRATEGIES` (`costEngine.ts`), sin tocar `getEffectiveCost()` ni ningun
 * consumidor.
 */
export type CostAdjustmentType = 'PERCENTAGE_WASTE';

/**
 * Datos MINIMOS que el motor necesita para calcular el costo efectivo de
 * un producto — deliberadamente NO es un `Product` de Prisma (ver nota de
 * archivo). Quien invoque el motor traduce su propio `Product` a esta
 * forma.
 */
export interface CostContext {
  /** Costo promedio de compra vigente (`Product.cost`, Bloque 14.8). El
   * motor SOLO LO LEE — nunca lo modifica ni lo recalcula. */
  averageCost: number;
  /** Porcentaje esperado de merma (`Product.expectedWastePercent`, Bloque
   * 14.4), 0-100. Solo se valida (0 <= wastePercent < 100) cuando
   * `applyExpectedWasteToCost` es `true` — ver `getEffectiveCost`. */
  wastePercent: number;
  /** Dato maestro del producto (`Product.applyExpectedWasteToCost`,
   * pendiente de agregar a `schema.prisma` en la fase de integracion).
   * `false` = el motor devuelve el costo promedio sin ningun ajuste,
   * exactamente el comportamiento actual del sistema (requisito de
   * compatibilidad del Bloque COST-01). */
  applyExpectedWasteToCost: boolean;
}

/** Resultado devuelto por `getEffectiveCost()` — el unico punto de salida
 * del motor. */
export interface CostEngineResult {
  /** Igual a `CostContext.averageCost`, sin modificar — se repite aca para
   * que quien consuma el resultado no tenga que guardar el input aparte. */
  averageCost: number;
  /** Costo a usar para la decision que corresponda (validar venta, calcular
   * margen, sugerir precio). Igual a `averageCost` cuando
   * `adjustmentApplied` es `false`. */
  effectiveCost: number;
  /** `true` unicamente cuando `applyExpectedWasteToCost` era `true` Y el
   * `wastePercent` paso las validaciones — nunca `true` con
   * `effectiveCost === averageCost` por casualidad. */
  adjustmentApplied: boolean;
  /** Estrategia efectivamente usada, o `null` si no se aplico ningun
   * ajuste. */
  adjustmentType: CostAdjustmentType | null;
  /** Igual a `CostContext.wastePercent`, sin modificar. */
  wastePercent: number;
}

/**
 * Contrato de una estrategia de ajuste de costo — cada archivo bajo
 * `strategies/` implementa esta forma. `calculate()` asume una entrada YA
 * validada (0 <= wastePercent < 100): las estrategias calculan, no
 * validan — esa responsabilidad es unica de `getEffectiveCost()`
 * (`costEngine.ts`), para no repetir la misma validacion en cada
 * estrategia futura.
 */
export interface CostAdjustmentStrategy {
  type: CostAdjustmentType;
  calculate(context: CostContext): number;
}
