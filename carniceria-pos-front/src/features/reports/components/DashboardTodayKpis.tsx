import { BellRing, Percent, Receipt, ShoppingCart, TrendingUp } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { formatCurrency } from '@/utils/formatCurrency'

interface DashboardTodayKpisProps {
  /** Monto vendido HOY — ultimo item de `useSalesByDate` (Bloque Dashboard
   * "centro de control": sin endpoint nuevo, ese reporte ya incluye el dia
   * actual). `null` mientras carga. */
  todaySalesAmount: number | null
  /** `DashboardResponse.totalProfitToday` (Bloque COST-04.1, sin cambios). */
  todayProfit: number | null
  /** `DashboardResponse.averageMarginToday` (Bloque COST-04.1, sin cambios). */
  todayMargin: number | null
  /** `SalesByCashierSummary.averageTicket` filtrado a HOY (mismo hook que
   * `SalesByCashierPage.tsx`, solo con `dateFrom`/`dateTo` de hoy). */
  todayAverageTicket: number | null
  /** Total de notificaciones activas (`useNotifications`, cualquier
   * severidad) y cuantas son `critical` — mismo dato que ya usa
   * `NotificationBell.tsx`, solo presentado como KPI en vez de badge. */
  activeAlertsCount: number
  criticalAlertsCount: number
  isLoading: boolean
}

/**
 * features/reports/components/DashboardTodayKpis.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del Dashboard ("centro de control", aprobado): franja de KPIs
 * enfocada en HOY, reemplazando los `heroMetrics` historicos (acumulado
 * desde siempre) que antes ocupaban ese lugar en `DashboardSummaryCards.tsx`
 * — esos totales historicos no se eliminan, se mudan al panel lateral
 * (`DashboardSummaryCards.tsx`, ahora panel de Administrador). Presentacion
 * pura: recibe los 5 valores ya resueltos por `DashboardPage.tsx`, sin
 * llamar a ningun hook por si misma (mismo criterio que
 * `SalesByDateLineChart.tsx`).
 */
export function DashboardTodayKpis({
  todaySalesAmount,
  todayProfit,
  todayMargin,
  todayAverageTicket,
  activeAlertsCount,
  criticalAlertsCount,
  isLoading,
}: DashboardTodayKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Ventas de hoy"
        value={isLoading || todaySalesAmount === null ? '—' : formatCurrency(todaySalesAmount)}
        icon={ShoppingCart}
        size="compact"
      />
      <KpiCard
        label="Utilidad de hoy"
        value={isLoading || todayProfit === null ? '—' : formatCurrency(todayProfit)}
        icon={TrendingUp}
        size="compact"
      />
      <KpiCard
        label="Margen de hoy"
        value={isLoading || todayMargin === null ? '—' : `${todayMargin.toFixed(1)}%`}
        icon={Percent}
        size="compact"
      />
      <KpiCard
        label="Ticket promedio"
        value={isLoading || todayAverageTicket === null ? '—' : formatCurrency(todayAverageTicket)}
        icon={Receipt}
        size="compact"
      />
      <KpiCard
        label="Alertas activas"
        value={isLoading ? '—' : activeAlertsCount}
        icon={BellRing}
        size="compact"
        tone={criticalAlertsCount > 0 ? 'brand' : 'muted'}
        description={
          !isLoading && criticalAlertsCount > 0
            ? `${criticalAlertsCount} crítica${criticalAlertsCount === 1 ? '' : 's'}`
            : undefined
        }
      />
    </div>
  )
}
