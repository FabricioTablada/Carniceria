import { useLocation } from 'react-router-dom'
import { Download, PieChart, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { exportToCsv } from '@/utils/exportToCsv'
import { useSalesByCategory } from '../hooks/useSalesByCategory'
import { useReportMemoryState } from '../hooks/useReportMemoryState'
import { SalesByCategoryChart } from '../components/SalesByCategoryChart'
import { SalesByCategoryTable } from '../components/SalesByCategoryTable'
import { SalesByCategoryTableSkeleton } from '../components/SalesByCategoryTableSkeleton'
import { SalesByCategoryKpiRow } from '../components/SalesByCategoryKpiRow'
import { SalesByCategoryFilters } from '../components/SalesByCategoryFilters'
import { ReportRelatedNav } from '../components/ReportRelatedNav'
import type { SalesByCategoryFilters as SalesByCategoryFiltersValue } from '../types/report.types'

/**
 * features/reports/pages/SalesByCategoryPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): mismo Canvas Workspace/memoria de
 * filtros/siembra de período que `SalesReportPage.tsx`. El gráfico
 * (`SalesByCategoryChart`, sin cambios propios) deja de vivir en una
 * `Card` separada flotando sobre la tabla — pasa a ser una franja más del
 * mismo Workspace ("eliminar tarjetas innecesarias"), con una altura fija
 * (`h-72`) consistente con el resto de los reportes con gráfico
 * (`TopProductsPage.tsx`) — "altura uniforme para todos los gráficos".
 */
export function SalesByCategoryPage() {
  const location = useLocation()
  const [filters, setFilters] = useReportMemoryState<SalesByCategoryFiltersValue>(
    'sales-by-category-filters',
    () => {
      const navigationState = location.state as { dateFrom?: string; dateTo?: string } | null
      return navigationState?.dateFrom ? { dateFrom: navigationState.dateFrom, dateTo: navigationState.dateTo } : {}
    },
  )
  const { data, isLoading, isFetching, isError, error } = useSalesByCategory(filters)
  const items = data ?? []

  // TODO: `sucursales` sigue sin poblarse — no existe todavia el modulo
  // `features/sucursales` en el frontend (mismo TODO ya documentado en el
  // resto de Reportes).

  const handleExport = () => {
    exportToCsv(
      items,
      [
        { header: 'Categoría', value: (item) => item.categoryName },
        { header: 'Cantidad vendida', value: (item) => item.totalQuantitySold },
        { header: 'Importe vendido', value: (item) => item.totalSalesAmount },
        { header: 'Ventas', value: (item) => item.salesCount },
      ],
      'reporte-ventas-por-categoria.csv',
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Reportes', href: '/reports' },
          { label: 'Ventas por categoría' },
        ]}
        title="Ventas por categoría"
        description="Cantidad e importe vendido, agrupado por categoría de producto."
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
          <SalesByCategoryKpiRow items={items} isLoading={isLoading} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar bare filters={<SalesByCategoryFilters filters={filters} onFiltersChange={setFilters} />} />
        </div>

        {!isLoading && !isError && items.length > 0 && (
          <div className="border-b border-border/70 p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <PieChart className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ventas por categoría</p>
                <p className="text-xs text-muted-foreground">Importe vendido acumulado por categoría de producto.</p>
              </div>
            </div>
            <SalesByCategoryChart items={items} />
          </div>
        )}

        {isLoading && <SalesByCategoryTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <SalesByCategoryTable
              items={items}
              emptyMessage={
                <EmptyState
                  icon={PieChart}
                  title="No hay ventas por categoría para mostrar"
                  description="No se encontraron ventas que coincidan con los filtros seleccionados."
                />
              }
            />
          </div>
        )}
      </div>

      <ReportRelatedNav currentId="sales-by-category" group="sales" />
    </div>
  )
}
