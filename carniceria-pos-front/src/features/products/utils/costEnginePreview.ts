/**
 * features/products/utils/costEnginePreview.ts
 * -----------------------------------------------------------------------------
 * Bloque COST-05: espejo, EXCLUSIVAMENTE para la vista previa del
 * formulario de Productos, del `CostEngine` real (backend,
 * `shared/services/costEngine/`). No se puede importar el motor del
 * backend directamente (repos separados, ver CLAUDE.md — el backend no es
 * una dependencia de este proyecto), asi que esta es la UNICA funcion de
 * todo el frontend que conoce la formula — ningun otro componente/hook de
 * este modulo (ni de ningun otro) debe repetirla. `ProductForm.tsx` es su
 * consumidor original; Bloque COST-06.3 sumo un segundo consumidor,
 * `features/purchases/components/PurchaseItemRow.tsx` (vista previa del
 * costo efectivo ESTIMADO de un lote de compra, con la merma propia del
 * lote en vez de la del producto); Bloque PROMO-08 sumo un tercero,
 * `features/promotions/utils/promotionProfitabilityPreview.ts` (usa
 * `calculateEffectiveCost`, mas abajo, como INSUMO de la vista previa de
 * rentabilidad comercial) — mismo motivo por el que este archivo
 * existe: un solo lugar que conoce la formula.
 *
 * Formula identica a `getEffectiveCost()` (backend, Bloque COST-01):
 *   effectiveCost = averageCost / (1 - wastePercent / 100)
 *
 * DIFERENCIA DELIBERADA con el backend: el motor real LANZA
 * (`ValidationError`) si `applyExpectedWasteToCost` es `true` y
 * `wastePercent` esta fuera de rango (`< 0` o `>= 100`) — comportamiento
 * correcto para una escritura de negocio (bloquear una venta), pero
 * inaceptable para un calculo de vista previa que corre en cada
 * `keystroke` (un componente de React no debe lanzar durante el render).
 * Aca, cualquier entrada invalida devuelve `null` (sin vista previa) en
 * vez de lanzar — consistente con el requisito del bloque ("si el costo
 * esta vacio, no calcular la vista previa").
 *
 * El resultado de esta funcion es PURAMENTE INFORMATIVO: nunca se envia al
 * backend, nunca se persiste — el formulario solo envia `cost`,
 * `expectedWastePercent` y `applyExpectedWasteToCost` (los INSUMOS), nunca
 * un costo efectivo ya calculado.
 */

export interface CostPreviewInput {
  /** `Product.cost` (costo promedio), tal como esta en el formulario. */
  averageCost: number | null | undefined
  /** `Product.expectedWastePercent`, tal como esta en el formulario. */
  wastePercent: number | null | undefined
  /** `Product.applyExpectedWasteToCost` (el Switch). */
  applyExpectedWasteToCost: boolean
}

export interface CostPreviewResult {
  averageCost: number
  wastePercent: number
  effectiveCost: number
}

/**
 * Calcula la vista previa del costo efectivo, o `null` si no hay
 * suficiente informacion valida para hacerlo (costo ausente/invalido,
 * switch apagado, o porcentaje fuera del rango 0-100 exclusivo).
 */
export function calculateCostPreview(input: CostPreviewInput): CostPreviewResult | null {
  if (!input.applyExpectedWasteToCost) {
    return null
  }

  if (
    input.averageCost === null ||
    input.averageCost === undefined ||
    !Number.isFinite(input.averageCost) ||
    input.averageCost < 0
  ) {
    return null
  }

  if (
    input.wastePercent === null ||
    input.wastePercent === undefined ||
    !Number.isFinite(input.wastePercent) ||
    input.wastePercent < 0 ||
    input.wastePercent >= 100
  ) {
    return null
  }

  return {
    averageCost: input.averageCost,
    wastePercent: input.wastePercent,
    effectiveCost: input.averageCost / (1 - input.wastePercent / 100),
  }
}

/**
 * Bloque PROMO-08: variante de `calculateCostPreview` SIN el gate de
 * `applyExpectedWasteToCost` — siempre devuelve un costo efectivo
 * (numerico) en vez de `null` cuando el switch esta apagado, exactamente
 * el mismo contrato que `CostEngine.getEffectiveCost()` en el backend
 * ("`false` = el motor devuelve el costo promedio sin ningun ajuste").
 *
 * `calculateCostPreview` (arriba) NO cambia: sigue siendo la que usan
 * `ProductForm.tsx`/`PurchaseItemRow.tsx`, donde "switch apagado" debe
 * significar "sin vista previa que mostrar" — un caso de UI distinto. Esta
 * variante es para consumidores (`promotionProfitabilityPreview.ts`) que
 * necesitan el costo efectivo SIEMPRE, porque lo usan como INSUMO de un
 * calculo mayor (rentabilidad), no como el dato final a mostrar.
 */
export function calculateEffectiveCost(input: CostPreviewInput): number | null {
  if (
    input.averageCost === null ||
    input.averageCost === undefined ||
    !Number.isFinite(input.averageCost) ||
    input.averageCost < 0
  ) {
    return null
  }

  if (!input.applyExpectedWasteToCost) {
    return input.averageCost
  }

  if (
    input.wastePercent === null ||
    input.wastePercent === undefined ||
    !Number.isFinite(input.wastePercent) ||
    input.wastePercent < 0 ||
    input.wastePercent >= 100
  ) {
    return null
  }

  return input.averageCost / (1 - input.wastePercent / 100)
}
