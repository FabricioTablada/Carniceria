import { useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  CircleCheck,
  CircleOff,
  DollarSign,
  Package,
  PackageCheck,
  PackageMinus,
  TriangleAlert,
} from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import type { StockStatus } from '@/utils/stockStatus'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useLowStock } from '@/features/reports/hooks/useLowStock'
import { summarizeLowStock } from '@/features/reports/utils/lowStockSummary'
import { useBatchesReport } from '@/features/reports/hooks/useBatchesReport'
import { useWasteReport } from '@/features/reports/hooks/useWasteReport'
import { useInventory } from '../hooks/useInventory'

interface InventoryKpiRowProps {
  /** Filtro "Estado" (crítico/bajo/óptimo) actualmente activo en
   * `InventoryPage.tsx` — determina qué celda se muestra "presionada". */
  activeStockStatus: StockStatus | undefined
  /** Aplica (o quita) el filtro "Estado" — filtra sobre la página YA
   * CARGADA (mismo criterio documentado en el wireframe aprobado: la API
   * de Inventario no expone ese parámetro, sin cambio de backend). */
  onSelectStockStatus: (status: StockStatus | undefined) => void
}

function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-10" />
}

/** Primer día del mes actual, formato `YYYY-MM-DD` (mismo criterio
 * "fecha-solo, sin zona horaria" que `formatBatchDate`/`getDaysUntilExpiry`). */
function firstDayOfMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/**
 * features/inventory/components/InventoryKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Centro de Control de Inventario (aprobado): cada KPI pasa de ser un
 * número suelto a tener identidad visual propia (ícono + tono) y ser
 * clicable — franja `bare`/`xs` dividida (`divide-x`/`divide-y`), mismo
 * patrón ya aprobado en Proveedores/Productos/Categorías/Impuestos/Lotes
 * (`BatchesKpiRow.tsx`).
 *
 * "Óptimas"/"Bajo stock"/"Agotados" filtran la tabla de ESTA pestaña
 * (client-side sobre la página ya cargada — la API de Inventario no
 * expone un parámetro de estado, ver wireframe aprobado). "Lotes
 * activos"/"Próximos a vencer" (`useBatchesReport`, dato real) y "Mermas
 * del mes" (`useWasteReport`, dato real) son de OTRAS pestañas del mismo
 * Workspace: al hacer click navegan a esa pestaña — misma cáscara, mismo
 * criterio ya usado en `InventoryAdjustDrawer.tsx` ("Ver lotes").
 */
export function InventoryKpiRow({ activeStockStatus, onSelectStockStatus }: InventoryKpiRowProps) {
  const navigate = useNavigate()

  const { data: totalResponse, isLoading: isTotalLoading } = useInventory({ limit: 1 })
  const total = totalResponse?.meta.total

  const { data: valueInventoryResponse, isLoading: isValueLoading } = useInventory({ limit: 200 })
  const { data: valueProductsResponse } = useProducts({ limit: 200 })
  const products = valueProductsResponse?.data ?? []
  const totalValue = (valueInventoryResponse?.data ?? []).reduce((sum, row) => {
    const cost = products.find((product) => product.id === row.productId)?.cost ?? 0
    return sum + row.quantity * cost
  }, 0)

  const { data: lowStockItems, isLoading: isLowStockLoading } = useLowStock({})
  const { outOfStockCount, lowStockCount } = summarizeLowStock(lowStockItems ?? [])
  const optimalCount =
    total !== undefined ? Math.max(total - outOfStockCount - lowStockCount, 0) : undefined

  const { data: batchesReport, isLoading: isBatchesLoading } = useBatchesReport({})
  const activeBatchesCount = batchesReport?.byStatus.find((entry) => entry.status === 'ACTIVE')?.count ?? 0
  const expiringSoonCount = batchesReport?.expiringSoonCount ?? 0

  const { data: wasteReport, isLoading: isWasteLoading } = useWasteReport({ dateFrom: firstDayOfMonth() })

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4">
      <button
        type="button"
        onClick={() => onSelectStockStatus(undefined)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStockStatus === undefined && 'bg-brand/5 shadow-[inset_0_-2px_0_var(--brand)]',
        )}
      >
        <KpiCard bare label="Productos" value={isTotalLoading ? <KpiValueSkeleton /> : (total ?? '—')} icon={Package} size="xs" />
      </button>
      <button
        type="button"
        onClick={() => onSelectStockStatus(activeStockStatus === 'optimal' ? undefined : 'optimal')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStockStatus === 'optimal' && 'bg-success/5 shadow-[inset_0_-2px_0_var(--success)]',
        )}
      >
        <KpiCard bare label="Existencias óptimas" value={isLowStockLoading || isTotalLoading ? <KpiValueSkeleton /> : (optimalCount ?? '—')} icon={CircleCheck} size="xs" tone="success" />
      </button>
      <button
        type="button"
        onClick={() => onSelectStockStatus(activeStockStatus === 'low' ? undefined : 'low')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStockStatus === 'low' && 'bg-destructive/5 shadow-[inset_0_-2px_0_var(--destructive)]',
        )}
      >
        <KpiCard bare label="Bajo stock" value={isLowStockLoading ? <KpiValueSkeleton /> : lowStockCount} icon={TriangleAlert} size="xs" tone={lowStockCount > 0 ? 'muted' : 'success'} />
      </button>
      <button
        type="button"
        onClick={() => onSelectStockStatus(activeStockStatus === 'critical' ? undefined : 'critical')}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeStockStatus === 'critical' && 'bg-destructive/5 shadow-[inset_0_-2px_0_var(--destructive)]',
        )}
      >
        <KpiCard bare label="Agotados" value={isLowStockLoading ? <KpiValueSkeleton /> : outOfStockCount} icon={CircleOff} size="xs" tone={outOfStockCount > 0 ? 'muted' : 'success'} />
      </button>
      <button type="button" onClick={() => navigate('/inventory/batches?status=ACTIVE')} className="text-left transition-colors duration-150 hover:bg-brand/5">
        <KpiCard bare label="Lotes activos" value={isBatchesLoading ? <KpiValueSkeleton /> : activeBatchesCount} icon={PackageCheck} size="xs" tone="success" />
      </button>
      <button type="button" onClick={() => navigate('/inventory/batches?status=ACTIVE')} className="text-left transition-colors duration-150 hover:bg-brand/5">
        <KpiCard bare label="Vencen ≤7 días" value={isBatchesLoading ? <KpiValueSkeleton /> : expiringSoonCount} icon={CalendarClock} size="xs" tone={expiringSoonCount > 0 ? 'muted' : 'success'} />
      </button>
      <button type="button" onClick={() => navigate('/inventory/waste')} className="text-left transition-colors duration-150 hover:bg-brand/5">
        <KpiCard bare label="Mermas del mes" value={isWasteLoading ? <KpiValueSkeleton /> : formatCurrency(wasteReport?.totalValue ?? 0)} icon={PackageMinus} size="xs" tone={(wasteReport?.totalValue ?? 0) > 0 ? 'muted' : 'success'} />
      </button>
      <button type="button" onClick={() => onSelectStockStatus(undefined)} className="text-left transition-colors duration-150 hover:bg-brand/5">
        <KpiCard bare label="Valor total" value={isValueLoading ? <KpiValueSkeleton /> : formatCurrency(totalValue)} icon={DollarSign} size="xs" tone="brand" description="Primeras 200 existencias" />
      </button>
    </div>
  )
}
