import { useLocation, useNavigate } from 'react-router-dom'
import { Download, Printer, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { exportToCsv } from '@/utils/exportToCsv'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { useTopProducts } from '../hooks/useTopProducts'
import { useReportMemoryState } from '../hooks/useReportMemoryState'
import { TopProductsChart } from '../components/TopProductsChart'
import { TopProductsTable } from '../components/TopProductsTable'
import { TopProductsTableSkeleton } from '../components/TopProductsTableSkeleton'
import { TopProductsKpiRow } from '../components/TopProductsKpiRow'
import { TopProductsFilters } from '../components/TopProductsFilters'
import { ReportRelatedNav } from '../components/ReportRelatedNav'
import type { TopProductsFilters as TopProductsFiltersValue } from '../types/report.types'

const DEFAULT_LIMIT = 10

/**
 * features/reports/pages/TopProductsPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): mismo Canvas Workspace/memoria de
 * filtros/siembra de período que `SalesReportPage.tsx`. El gráfico
 * (`TopProductsChart`, sin cambios propios) deja de vivir en una `Card`
 * separada — mismo criterio que `SalesByCategoryPage.tsx`.
 */
export function TopProductsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [filters, setFilters] = useReportMemoryState<TopProductsFiltersValue>(
    'top-products-filters',
    () => {
      const navigationState = location.state as { dateFrom?: string; dateTo?: string } | null
      return navigationState?.dateFrom ? { dateFrom: navigationState.dateFrom, dateTo: navigationState.dateTo } : {}
    },
  )
  const { data, isLoading, isFetching, isError, error } = useTopProducts({
    ...filters,
    limit: DEFAULT_LIMIT,
  })
  const items = data ?? []

  // Categorias para poblar el selector de filtro — mismo criterio ya
  // usado en InventoryReportPage.tsx/ProfitReportPage.tsx.
  const { data: categoriesResponse } = useCategories({ active: true })
  const categories = (categoriesResponse?.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
  }))

  // TODO: `sucursales` sigue sin poblarse — no existe todavia el modulo
  // `features/sucursales` en el frontend (mismo TODO ya documentado en el
  // resto de Reportes).

  const handleExport = () => {
    exportToCsv(
      items,
      [
        { header: 'Producto', value: (item) => item.name },
        { header: 'SKU', value: (item) => item.sku ?? '' },
        { header: 'Categoría', value: (item) => item.categoryName ?? '' },
        { header: 'Cantidad vendida', value: (item) => item.totalQuantitySold },
        { header: 'Importe vendido', value: (item) => item.totalSalesAmount },
        { header: 'Ventas', value: (item) => item.salesCount },
      ],
      'reporte-productos-mas-vendidos.csv',
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Reportes', href: '/reports' },
          { label: 'Productos más vendidos' },
        ]}
        title="Productos más vendidos"
        description="Ranking de productos por cantidad e importe vendido."
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
          <TopProductsKpiRow items={items} isLoading={isLoading} limit={DEFAULT_LIMIT} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <TopProductsFilters filters={filters} categories={categories} onFiltersChange={setFilters} />
            }
          />
        </div>

        {!isLoading && !isError && items.length > 0 && (
          <div className="border-b border-border/70 p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Trophy className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ranking por cantidad vendida</p>
                <p className="text-xs text-muted-foreground">Top {DEFAULT_LIMIT} productos con mayor cantidad vendida.</p>
              </div>
            </div>
            <TopProductsChart items={items} />
          </div>
        )}

        {isLoading && <TopProductsTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <TopProductsTable
              items={items}
              onRowClick={(item) => navigate(`/products/${item.productId}/edit`)}
              emptyMessage={
                <EmptyState
                  icon={Trophy}
                  title="No hay productos vendidos para mostrar"
                  description="No se encontraron ventas que coincidan con los filtros seleccionados."
                />
              }
            />
          </div>
        )}
      </div>

      <ReportRelatedNav currentId="top-products" group="sales" />
    </div>
  )
}
