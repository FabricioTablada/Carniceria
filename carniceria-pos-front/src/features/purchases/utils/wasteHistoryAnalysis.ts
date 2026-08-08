/**
 * features/purchases/utils/wasteHistoryAnalysis.ts
 * -----------------------------------------------------------------------------
 * Bloque COST-06.5: unica funcion de todo el frontend que decide si el
 * historial de `PurchaseItem.expectedWastePercent` de un producto amerita
 * sugerir una revision de `Product.expectedWastePercent` (el estandar).
 * Puramente informativo — no escribe nada, no llama a la API, no conoce
 * React. `PurchaseItemRow.tsx` es su unico consumidor.
 *
 * Criterio de "informacion suficiente" (documentado, ver bloque):
 *   - `MIN_SAMPLE_SIZE`: se requieren al menos 5 compras historicas con
 *     `expectedWastePercent` definido para el producto. Con menos datos, un
 *     promedio simple queda demasiado expuesto a que UN lote atipico (ej.
 *     una merma inusualmente alta por un problema puntual del proveedor)
 *     lo distorsione — no es representativo todavia.
 *   - `MIN_DIFF_POINTS_TO_SUGGEST`: incluso con suficientes datos, solo se
 *     invita a revisar el estandar si el promedio observado difiere del
 *     estandar vigente en 1 punto porcentual o mas. Diferencias menores
 *     entran dentro del ruido normal de redondeo/variacion entre lotes y
 *     no justifican una accion.
 * Ambos umbrales son criterios de negocio razonables, no un valor fijado
 * por el backend — si el negocio pide afinarlos, se cambian solo aca.
 */

export const MIN_SAMPLE_SIZE = 5
export const MIN_DIFF_POINTS_TO_SUGGEST = 1

export interface WasteHistoryAnalysisInput {
  /** `PurchaseItem.expectedWastePercent` de compras historicas de este
   * producto, ya filtrado a valores no nulos (cada entrada es una compra
   * considerada). */
  observedWastePercents: number[]
  /** `Product.expectedWastePercent` vigente, tal como esta hoy. */
  currentStandardWaste: number
}

export interface WasteHistoryAnalysis {
  sampleSize: number
  averageWaste: number
  currentStandardWaste: number
  /** `averageWaste - currentStandardWaste`, en puntos porcentuales. */
  diffPoints: number
  /** `true` cuando la diferencia supera `MIN_DIFF_POINTS_TO_SUGGEST` —
   * unicamente entonces se invita a revisar el estandar. */
  hasSuggestion: boolean
}

/**
 * Calcula el analisis, o `null` si no hay suficientes compras historicas
 * (`observedWastePercents.length < MIN_SAMPLE_SIZE`) para que un promedio
 * simple sea informativo.
 */
export function analyzeWasteHistory(
  input: WasteHistoryAnalysisInput,
): WasteHistoryAnalysis | null {
  const sampleSize = input.observedWastePercents.length

  if (sampleSize < MIN_SAMPLE_SIZE) {
    return null
  }

  const sum = input.observedWastePercents.reduce((total, value) => total + value, 0)
  const averageWaste = Math.round((sum / sampleSize) * 100) / 100
  const diffPoints = Math.round((averageWaste - input.currentStandardWaste) * 100) / 100

  return {
    sampleSize,
    averageWaste,
    currentStandardWaste: input.currentStandardWaste,
    diffPoints,
    hasSuggestion: Math.abs(diffPoints) >= MIN_DIFF_POINTS_TO_SUGGEST,
  }
}
