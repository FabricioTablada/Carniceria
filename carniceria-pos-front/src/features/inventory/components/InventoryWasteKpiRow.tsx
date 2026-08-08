import { DollarSign, Hash, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { useWasteReport } from '@/features/reports/hooks/useWasteReport'
import { WASTE_REASON_OPTIONS } from '../constants/wasteReason.constants'
import type { WasteReason } from '../types/inventory.types'

interface InventoryWasteKpiRowProps {
  /** Motivo actualmente filtrado en `InventoryWastesPage.tsx` — determina
   * qué celda se muestra "presionada". */
  activeReason: WasteReason | undefined
  /** Aplica (o quita) el filtro "Motivo" — mismo `handleFiltersChange` que
   * ya usa `InventoryWasteFilters`. */
  onSelectReason: (reason: WasteReason | undefined) => void
}

function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-14" />
}

/** Primer día del mes actual — mismo criterio "fecha-solo" que
 * `InventoryKpiRow.tsx`/`getDaysUntilExpiry`. */
function firstDayOfMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/** Primer y último día del mes ANTERIOR — para la tendencia de "Valor del
 * mes" (mismo criterio "fecha-solo" de arriba). */
function previousMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfPrevious = new Date(firstOfCurrent.getTime() - 1)
  const firstOfPrevious = new Date(lastOfPrevious.getFullYear(), lastOfPrevious.getMonth(), 1)

  const toIso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  return { dateFrom: toIso(firstOfPrevious), dateTo: toIso(lastOfPrevious) }
}

/**
 * features/inventory/components/InventoryWasteKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Centro de Control de Inventario (aprobado): reemplaza los 2 KPIs
 * genéricos ("Mermas registradas"/"Coincidencias con el filtro") por
 * datos reales agregados de `GET /reports/waste` (`useWasteReport`,
 * endpoint ya construido, hasta ahora sin consumir) — deja de estar
 * limitado a "no hay endpoint de agregación", que ya no es cierto. Mismo
 * patrón `bare`/`xs` clicable que `InventoryKpiRow.tsx`/`BatchesKpiRow.tsx`.
 * Ventana: mes en curso (mismo criterio que "Mermas del mes" de
 * `InventoryKpiRow.tsx`).
 */
export function InventoryWasteKpiRow({ activeReason, onSelectReason }: InventoryWasteKpiRowProps) {
  const { data: report, isLoading } = useWasteReport({ dateFrom: firstDayOfMonth() })
  const { data: previousReport } = useWasteReport(previousMonthRange())

  const trendPercent =
    previousReport && previousReport.totalValue > 0 && report
      ? ((report.totalValue - previousReport.totalValue) / previousReport.totalValue) * 100
      : null

  const topReason = [...(report?.byReason ?? [])].sort((a, b) => b.count - a.count)[0]
  const topReasonLabel = topReason
    ? (WASTE_REASON_OPTIONS.find((option) => option.value === topReason.reason)?.label ?? topReason.reason)
    : '—'

  const topVarianceProduct = [...(report?.byProduct ?? [])]
    .filter((entry) => entry.variancePercent !== null)
    .sort((a, b) => (b.variancePercent ?? 0) - (a.variancePercent ?? 0))[0]

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
      <button
        type="button"
        onClick={() => onSelectReason(undefined)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeReason === undefined && 'bg-brand/5 shadow-[inset_0_-2px_0_var(--brand)]',
        )}
      >
        <KpiCard
          bare
          label="Valor del mes"
          value={isLoading ? <KpiValueSkeleton /> : formatCurrency(report?.totalValue ?? 0)}
          icon={trendPercent !== null && trendPercent > 0 ? TrendingUp : trendPercent !== null ? TrendingDown : DollarSign}
          size="xs"
          tone={(report?.totalValue ?? 0) > 0 ? 'muted' : 'success'}
          description={
            trendPercent !== null
              ? `${trendPercent > 0 ? '+' : ''}${trendPercent.toFixed(0)}% vs. mes anterior`
              : undefined
          }
        />
      </button>
      <button
        type="button"
        onClick={() => onSelectReason(undefined)}
        className="text-left transition-colors duration-150 hover:bg-brand/5"
      >
        <KpiCard bare label="Registros del mes" value={isLoading ? <KpiValueSkeleton /> : (report?.totalCount ?? 0)} icon={Hash} size="xs" />
      </button>
      <button
        type="button"
        onClick={() => onSelectReason(topReason && activeReason === topReason.reason ? undefined : topReason?.reason)}
        disabled={!topReason}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5 disabled:cursor-default disabled:hover:bg-transparent',
          topReason && activeReason === topReason.reason && 'bg-destructive/5 shadow-[inset_0_-2px_0_var(--destructive)]',
        )}
      >
        <KpiCard bare label="Motivo frecuente" value={isLoading ? <KpiValueSkeleton /> : topReasonLabel} icon={TriangleAlert} size="xs" tone={topReason ? 'muted' : 'success'} />
      </button>
      <KpiCard
        bare
        label="Mayor variación"
        value={
          isLoading ? (
            <KpiValueSkeleton />
          ) : topVarianceProduct ? (
            topVarianceProduct.productName
          ) : (
            '—'
          )
        }
        description={
          topVarianceProduct?.variancePercent !== undefined && topVarianceProduct?.variancePercent !== null
            ? `${topVarianceProduct.variancePercent > 0 ? '+' : ''}${topVarianceProduct.variancePercent.toFixed(1)}% vs. esperado`
            : undefined
        }
        icon={TrendingUp}
        size="xs"
        tone={topVarianceProduct && (topVarianceProduct.variancePercent ?? 0) > 0 ? 'muted' : 'success'}
      />
    </div>
  )
}
