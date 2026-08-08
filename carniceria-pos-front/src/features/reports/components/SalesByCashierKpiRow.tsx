import { Coins, ReceiptText, Trophy, Users, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/utils/formatCurrency'
import { useSalesByCashierSummary } from '../hooks/useSalesByCashierSummary'
import type { SalesByCashierFilters } from '../types/report.types'

interface SalesByCashierKpiRowProps {
  /** Mismos filtros activos que ya usa `SalesByCashierPage.tsx` para la
   * tabla (sin `page`/`limit`: este reporte nunca los tuvo) — reenviados
   * tal cual a `useSalesByCashierSummary`, para que el agregado SIEMPRE
   * refleje el mismo conjunto filtrado que ve el usuario. */
  filters: SalesByCashierFilters
}

function KpiValueSkeleton() {
  return <Skeleton className="h-[1.125rem] w-10" />
}

/**
 * features/reports/components/SalesByCashierKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-AGREGADOS (Ventas por Cajero): 5 tarjetas reales, mismo
 * patron que `CashReportKpiRow`/`ProfitReportKpiRow` — usa
 * `useSalesByCashierSummary(filters)` (`GET /reports/sales-by-cashier/summary`,
 * nuevo), calculado en el backend sobre el conjunto COMPLETO filtrado (no
 * el ranking truncado de `useSalesByCashier`).
 *
 * "Cajero líder": mismo criterio de orden que ya usa el listado
 * (`_sum.total desc` en el backend) — se calcula en el backend, no aca,
 * para que el "lider" del KPI siempre coincida con el primero de la tabla
 * sin duplicar esa logica en el frontend.
 */
export function SalesByCashierKpiRow({ filters }: SalesByCashierKpiRowProps) {
  const { data, isLoading } = useSalesByCashierSummary(filters)

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        bare
        label="Cajeros"
        value={isLoading ? <KpiValueSkeleton /> : (data?.totalCashiers ?? '—')}
        icon={Users}
        size="xs"
      />
      <KpiCard
        bare
        label="Ventas totales"
        value={isLoading ? <KpiValueSkeleton /> : (data?.totalSales ?? '—')}
        icon={ReceiptText}
        size="xs"
      />
      <KpiCard
        bare
        label="Importe total vendido"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalSalesAmount ?? 0)}
        icon={Coins}
        size="xs"
      />
      <KpiCard
        bare
        label="Ticket promedio"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.averageTicket ?? 0)}
        icon={Wallet}
        size="xs"
      />
      <KpiCard
        bare
        label="Cajero líder"
        value={isLoading ? <KpiValueSkeleton /> : (data?.topCashierName ?? '—')}
        icon={Trophy}
        size="xs"
        tone="success"
        description={isLoading ? '' : formatCurrency(data?.topCashierAmount ?? 0)}
      />
    </div>
  )
}
