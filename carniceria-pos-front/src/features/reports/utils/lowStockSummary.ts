import type { LowStockItem } from '../types/report.types'

export interface LowStockSummary {
  total: number
  outOfStockCount: number
  lowStockCount: number
  categoriesAffected: number
  sucursalesAffected: number
}

/**
 * features/reports/utils/lowStockSummary.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Inventario — extraído de `LowStockKpiRow.tsx` para que un
 * segundo consumidor (`InventoryWorkspaceKpiRow.tsx`, dentro del propio
 * módulo de Inventario) no repita el mismo cálculo — mismos 5 números,
 * misma fuente (`useLowStock`, conjunto completo sin paginar), sin volver
 * a sumarlos en dos lugares distintos.
 */
export function summarizeLowStock(items: LowStockItem[]): LowStockSummary {
  const outOfStockCount = items.filter((item) => item.quantity === 0).length
  const lowStockCount = items.length - outOfStockCount
  const categoriesAffected = new Set(items.map((item) => item.categoryId)).size
  const sucursalesAffected = new Set(items.map((item) => item.sucursalId)).size

  return {
    total: items.length,
    outOfStockCount,
    lowStockCount,
    categoriesAffected,
    sucursalesAffected,
  }
}
