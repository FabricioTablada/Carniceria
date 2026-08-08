import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, LineChart, PieChart, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { formatCurrency } from '@/utils/formatCurrency'
import { useSalesReportSummary } from '../hooks/useSalesReportSummary'
import { useProfitReportSummary } from '../hooks/useProfitReportSummary'
import { usePurchasesReportSummary } from '../hooks/usePurchasesReportSummary'
import { useLowStock } from '../hooks/useLowStock'
import { useSalesByDate } from '../hooks/useSalesByDate'
import { useSalesByCategory } from '../hooks/useSalesByCategory'
import { SalesByDateLineChart } from '../components/SalesByDateLineChart'
import { SalesByCategoryDonutChart } from '../components/SalesByCategoryDonutChart'
import { RecentActivityStrip } from '../components/RecentActivityStrip'
import { REPORT_GROUP_LABELS, REPORT_NAV_ITEMS, type ReportGroup } from '../constants/reportNav'
import { REPORT_PERIOD_OPTIONS, resolveReportPeriod, type ReportPeriodId } from '../constants/reportPeriods'

function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-16" />
}

const GROUP_ORDER: ReportGroup[] = ['sales', 'operations', 'finance']

/**
 * features/reports/pages/ReportsIndexPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado, "verdadero Centro de Análisis del
 * negocio"): reemplaza la grilla de 9 tarjetas grandes (una por reporte,
 * sin ningún dato propio) por un Canvas Workspace real:
 *
 * - Selector de período (`Hoy`/`7 días`/`30 días`/`Este mes`/
 *   `Personalizado`, `reportPeriods.ts`) que alimenta las 6 tarjetas de
 *   KPI y los 2 gráficos de abajo — mismos hooks de resumen que YA usa
 *   cada reporte individual (`useSalesReportSummary`/
 *   `useProfitReportSummary`/`usePurchasesReportSummary`), sin ningún
 *   endpoint nuevo. "Bajo inventario" es la única tarjeta sin período
 *   (ese reporte no tiene filtro de fecha — es una alerta de existencia
 *   actual, no algo que varíe "en los últimos 7 días").
 * - Las 6 tarjetas son clicables — navegan al reporte correspondiente
 *   pasando el mismo rango de fechas por `location.state` (mismo patrón
 *   ya usado por `CategoryDrawer.tsx` -> `ProductsPage.tsx`), que cada
 *   página de reporte lee una única vez al montar (ver
 *   `SalesReportPage.tsx` y el resto).
 * - Gráficos (`SalesByDateLineChart`/`SalesByCategoryDonutChart`) — los
 *   MISMOS componentes ya usados en `DashboardPage.tsx` (pestaña
 *   "Analítica"), reutilizados tal cual. La diferencia real con el
 *   Dashboard (que sigue existiendo, sin tocar) es el período: acá
 *   responde al selector de arriba; en el Dashboard es siempre "hoy"/
 *   "últimos 7 días" fijo — Reportes es el destino para elegir un rango y
 *   analizar a fondo, Dashboard el de "qué pasa ahora".
 * - Navegación agrupada (Ventas/Operación/Finanzas, `reportNav.ts` — misma
 *   fuente que usa `ReportRelatedNav.tsx` en cada reporte individual): de
 *   9 tarjetas grandes en grilla a una lista compacta de 3 columnas, con
 *   estado hover — mismos 9 destinos, mismas rutas, mucho menos espacio
 *   desperdiciado.
 * - "Actividad reciente" (`RecentActivityStrip.tsx`): última venta/compra
 *   recibida/sesión de caja cerrada/merma registrada — datos que el
 *   sistema ya genera, sin ningún cálculo nuevo.
 */
export function ReportsIndexPage() {
  const navigate = useNavigate()
  const [periodId, setPeriodId] = useState<ReportPeriodId>('30d')
  const range = resolveReportPeriod(periodId)

  const { data: salesSummary, isLoading: isSalesLoading, isError: isSalesError } = useSalesReportSummary(range)
  const { data: profitSummary, isLoading: isProfitLoading, isError: isProfitError } = useProfitReportSummary(range)
  const { data: purchasesSummary, isLoading: isPurchasesLoading, isError: isPurchasesError } =
    usePurchasesReportSummary(range)
  const { data: lowStockItems, isLoading: isLowStockLoading } = useLowStock()

  const { data: salesByDate, isLoading: isSalesByDateLoading, isError: isSalesByDateError } =
    useSalesByDate(range)
  const { data: salesByCategory, isLoading: isSalesByCategoryLoading, isError: isSalesByCategoryError } =
    useSalesByCategory(range)

  const hasAnySummaryError = isSalesError || isProfitError || isPurchasesError

  const goToReport = (path: string) => {
    navigate(path, { state: range.dateFrom ? { dateFrom: range.dateFrom, dateTo: range.dateTo } : undefined })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Reportes' }]}
        title="Centro de Análisis"
        description="Los reportes disponibles en el sistema, organizados para tomar decisiones rápido."
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="h-10 gap-2 rounded-xl"
            title="Imprimir este resumen"
          >
            <Printer className="size-4" />
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Período</span>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          {REPORT_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPeriodId(option.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150',
                periodId === option.id
                  ? 'bg-brand text-brand-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div data-report-print-root className="rounded-2xl border border-border bg-card shadow-sm">
        {hasAnySummaryError ? (
          <div className="p-4">
            <ErrorAlert>Ocurrió un error al cargar los indicadores del período.</ErrorAlert>
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border/70 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
            <button type="button" onClick={() => goToReport('/reports/sales')} className="text-left transition-colors duration-150 hover:bg-brand/5">
              <KpiCard
                bare
                label="Ventas del período"
                value={isSalesLoading ? <KpiValueSkeleton /> : formatCurrency(salesSummary?.totalAmount ?? 0)}
                size="xs"
              />
            </button>
            <button type="button" onClick={() => goToReport('/reports/profit')} className="text-left transition-colors duration-150 hover:bg-brand/5">
              <KpiCard
                bare
                label="Utilidad"
                value={isProfitLoading ? <KpiValueSkeleton /> : formatCurrency(profitSummary?.totalProfit ?? 0)}
                size="xs"
                tone="success"
              />
            </button>
            <button type="button" onClick={() => goToReport('/reports/profit')} className="text-left transition-colors duration-150 hover:bg-brand/5">
              <KpiCard
                bare
                label="Margen promedio"
                value={isProfitLoading ? <KpiValueSkeleton /> : `${(profitSummary?.averageMargin ?? 0).toFixed(1)}%`}
                size="xs"
              />
            </button>
            <button type="button" onClick={() => goToReport('/reports/purchases')} className="text-left transition-colors duration-150 hover:bg-brand/5">
              <KpiCard
                bare
                label="Compras"
                value={isPurchasesLoading ? <KpiValueSkeleton /> : formatCurrency(purchasesSummary?.totalAmount ?? 0)}
                size="xs"
              />
            </button>
            <button type="button" onClick={() => goToReport('/reports/low-stock')} className="text-left transition-colors duration-150 hover:bg-brand/5">
              <KpiCard
                bare
                label="Bajo inventario"
                value={isLowStockLoading ? <KpiValueSkeleton /> : (lowStockItems?.length ?? 0)}
                size="xs"
                tone={(lowStockItems?.length ?? 0) > 0 ? 'muted' : 'success'}
              />
            </button>
            <button type="button" onClick={() => goToReport('/reports/sales')} className="text-left transition-colors duration-150 hover:bg-brand/5">
              <KpiCard
                bare
                label="Ticket promedio"
                value={isSalesLoading ? <KpiValueSkeleton /> : formatCurrency(salesSummary?.averageTicket ?? 0)}
                size="xs"
              />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 divide-y divide-border border-b border-border/70 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          <div className="flex flex-col gap-3 p-4 lg:col-span-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <LineChart className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Tendencia de ventas</p>
                <p className="text-xs text-muted-foreground">Monto vendido y cantidad de ventas por día.</p>
              </div>
            </div>
            {isSalesByDateLoading && <LoadingState message="Cargando reporte..." />}
            {isSalesByDateError && <ErrorAlert>Ocurrió un error al cargar el reporte.</ErrorAlert>}
            {!isSalesByDateLoading && !isSalesByDateError && (
              <SalesByDateLineChart items={salesByDate ?? []} />
            )}
          </div>

          <div className="flex flex-col gap-3 p-4 lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <PieChart className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ventas por categoría</p>
                <p className="text-xs text-muted-foreground">Importe vendido acumulado.</p>
              </div>
            </div>
            {isSalesByCategoryLoading && <LoadingState message="Cargando reporte..." />}
            {isSalesByCategoryError && <ErrorAlert>Ocurrió un error al cargar el reporte.</ErrorAlert>}
            {!isSalesByCategoryLoading && !isSalesByCategoryError && (
              <SalesByCategoryDonutChart items={salesByCategory ?? []} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {GROUP_ORDER.map((group) => (
            <div key={group} className="flex flex-col">
              <span className="px-4 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {REPORT_GROUP_LABELS[group]}
              </span>
              {REPORT_NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-brand/5"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <item.icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand" />
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      <RecentActivityStrip />
    </div>
  )
}
