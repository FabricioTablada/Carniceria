/**
 * utils/stockStatus.ts
 * -----------------------------------------------------------------------------
 * Extraído de `components/common/StockStatusBadge.tsx` (regla de lint
 * `react-refresh/only-export-components`: un archivo de componente no
 * puede exportar también una función suelta). Sin lógica nueva — mismo
 * criterio ya documentado en `StockStatusBadge.tsx`.
 */
export type StockStatus = 'critical' | 'low' | 'optimal'

/**
 * Sin `reorderPoint` definido no hay umbral contra el cual juzgar el
 * stock — se devuelve `undefined` (neutral) en vez de asumir un umbral
 * que nadie configuró. Con `reorderPoint` definido: `quantity <= 0` es
 * crítico, `quantity <= reorderPoint` es bajo, el resto es óptimo.
 */
export function resolveStockStatus(
  quantity: number,
  reorderPoint: number | null,
): StockStatus | undefined {
  if (quantity <= 0) {
    return 'critical'
  }

  if (reorderPoint !== null && quantity <= reorderPoint) {
    return 'low'
  }

  return reorderPoint !== null ? 'optimal' : undefined
}
