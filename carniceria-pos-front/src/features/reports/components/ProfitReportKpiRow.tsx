import { Calculator, Coins, Percent, ReceiptText, TrendingUp } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/utils/formatCurrency'
import { useProfitReportSummary } from '../hooks/useProfitReportSummary'
import type { ProfitReportFilters } from '../types/report.types'

interface ProfitReportKpiRowProps {
  /** Mismos filtros activos que ya usa `ProfitReportPage.tsx` para la
   * tabla/paginacion (sin `page`/`limit`) — reenviados tal cual a
   * `useProfitReportSummary`, para que el agregado SIEMPRE refleje el
   * mismo conjunto filtrado que ve el usuario. */
  filters: Omit<ProfitReportFilters, 'page' | 'limit'>
}

function KpiValueSkeleton() {
  return <Skeleton className="h-[1.125rem] w-10" />
}

/**
 * features/reports/components/ProfitReportKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-AGREGADOS: las 5 tarjetas ahora son reales — usa
 * `useProfitReportSummary(filters)` (`GET /reports/profit/summary`,
 * nuevo). A diferencia de Ventas/Compras (un `aggregate()` nativo de
 * Prisma alcanzaba), este agregado se resuelve en el backend con
 * `CostEngine` sobre snapshots crudos (`costTotal`/`profit` no son
 * columnas reales) — mismo criterio ya usado por la utilidad de HOY del
 * Dashboard (`calculateTodayProfit`). El calculo sigue ocurriendo
 * enteramente en el servidor; el frontend solo recibe los 5 numeros ya
 * agregados, nunca las filas.
 *
 * "Costo total"/"Utilidad total"/"Margen promedio" solo consideran las
 * lineas con snapshot de costo conocido (`unitCost` no nulo) — mismo
 * criterio que `marginPercent` por linea en la tabla paginada, para no
 * mezclar "costo desconocido" con un margen que implicaria confianza en
 * el dato.
 */
export function ProfitReportKpiRow({ filters }: ProfitReportKpiRowProps) {
  const { data, isLoading } = useProfitReportSummary(filters)

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        bare
        label="Líneas de venta"
        value={isLoading ? <KpiValueSkeleton /> : (data?.totalLines ?? '—')}
        icon={ReceiptText}
        size="xs"
      />
      <KpiCard
        bare
        label="Importe total vendido"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalAmount ?? 0)}
        icon={Coins}
        size="xs"
      />
      <KpiCard
        bare
        label="Costo total"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalCost ?? 0)}
        icon={Calculator}
        size="xs"
      />
      <KpiCard
        bare
        label="Utilidad total"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalProfit ?? 0)}
        icon={TrendingUp}
        size="xs"
        tone="success"
      />
      <KpiCard
        bare
        label="Margen promedio"
        value={isLoading ? <KpiValueSkeleton /> : `${(data?.averageMargin ?? 0).toFixed(1)}%`}
        icon={Percent}
        size="xs"
      />
    </div>
  )
}
