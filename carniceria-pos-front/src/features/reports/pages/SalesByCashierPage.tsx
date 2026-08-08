import { useLocation, useNavigate } from 'react-router-dom'
import { Download, Printer, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { exportToCsv } from '@/utils/exportToCsv'
import { useSalesByCashier } from '../hooks/useSalesByCashier'
import { useReportMemoryState } from '../hooks/useReportMemoryState'
import { SalesByCashierTable } from '../components/SalesByCashierTable'
import { SalesByCashierTableSkeleton } from '../components/SalesByCashierTableSkeleton'
import { SalesByCashierKpiRow } from '../components/SalesByCashierKpiRow'
import { SalesByCashierFilters } from '../components/SalesByCashierFilters'
import { ReportRelatedNav } from '../components/ReportRelatedNav'
import type { SalesByCashierFilters as SalesByCashierFiltersValue } from '../types/report.types'

/**
 * features/reports/pages/SalesByCashierPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): mismo Canvas Workspace/memoria de
 * filtros/siembra de período que `SalesReportPage.tsx`, adaptado a que
 * este reporte nunca pagina (`useSalesByCashier` siempre trae el conjunto
 * completo). Sin gráfico: nunca existió uno para este reporte.
 */
export function SalesByCashierPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [filters, setFilters] = useReportMemoryState<SalesByCashierFiltersValue>(
    'sales-by-cashier-filters',
    () => {
      const navigationState = location.state as { dateFrom?: string; dateTo?: string } | null
      return navigationState?.dateFrom ? { dateFrom: navigationState.dateFrom, dateTo: navigationState.dateTo } : {}
    },
  )
  const { data, isLoading, isFetching, isError, error } = useSalesByCashier(filters)
  const items = data ?? []

  // TODO: `sucursales` sigue sin poblarse — no existe todavia el modulo
  // `features/sucursales` en el frontend (mismo TODO ya documentado en el
  // resto de Reportes). `SalesByCashierFilters` ya esta preparado para
  // recibirlo por props cuando exista.

  const handleExport = () => {
    exportToCsv(
      items,
      [
        { header: 'Cajero', value: (item) => item.userName },
        { header: 'Ventas', value: (item) => item.totalSales },
        { header: 'Importe vendido', value: (item) => item.totalSalesAmount },
        { header: 'Ticket promedio', value: (item) => item.averageTicket },
      ],
      'reporte-ventas-por-cajero.csv',
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Reportes', href: '/reports' },
          { label: 'Ventas por cajero' },
        ]}
        title="Ventas por cajero"
        description="Cantidad de ventas, importe vendido y ticket promedio por cajero."
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="h-10 gap-2 rounded-xl"
              title="Imprimir este reporte"
            >
              <Printer className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={!items.length}
              className="h-10 gap-2 rounded-xl"
            >
              <Download className="size-4" />
              Exportar
            </Button>
          </div>
        }
      />

      <div data-report-print-root className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <SalesByCashierKpiRow filters={filters} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar bare filters={<SalesByCashierFilters filters={filters} onFiltersChange={setFilters} />} />
        </div>

        {isLoading && <SalesByCashierTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <SalesByCashierTable
              items={items}
              onRowClick={(item) => {
                if (item.userId) {
                  navigate(`/users/${item.userId}/edit`)
                }
              }}
              emptyMessage={
                <EmptyState
                  icon={Users}
                  title="No hay ventas por cajero para mostrar"
                  description="No se encontraron ventas que coincidan con los filtros seleccionados."
                />
              }
            />
          </div>
        )}
      </div>

      <ReportRelatedNav currentId="sales-by-cashier" group="sales" />
    </div>
  )
}
