import { useNavigate } from 'react-router-dom'
import { Boxes, Download, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { exportToCsv } from '@/utils/exportToCsv'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { useInventoryReport } from '../hooks/useInventoryReport'
import { useReportMemoryState, useReportMemoryPagination } from '../hooks/useReportMemoryState'
import { InventoryReportTable } from '../components/InventoryReportTable'
import { InventoryReportTableSkeleton } from '../components/InventoryReportTableSkeleton'
import { InventoryReportKpiRow } from '../components/InventoryReportKpiRow'
import { InventoryReportFilters } from '../components/InventoryReportFilters'
import { ReportRelatedNav } from '../components/ReportRelatedNav'
import type { InventoryReportFilters as InventoryReportFiltersValue } from '../types/report.types'

/**
 * features/reports/pages/InventoryReportPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): mismo Canvas Workspace/memoria de
 * filtros que `SalesReportPage.tsx` (la plantilla de referencia). Sin
 * período (este reporte no tiene `dateFrom`/`dateTo`): no siembra nada
 * desde `location.state`. Cero cambio de lógica: mismos filtros/consulta/
 * columnas de siempre.
 */
export function InventoryReportPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useReportMemoryState<Omit<InventoryReportFiltersValue, 'page' | 'limit'>>(
    'inventory-report-filters',
    {},
  )
  const { page, setPage, resetPage } = useReportMemoryPagination('inventory-report-page')
  const { data, isLoading, isFetching, isError, error } = useInventoryReport({ ...filters, page })

  const handleFiltersChange = (nextFilters: Omit<InventoryReportFiltersValue, 'page' | 'limit'>) => {
    setFilters(nextFilters)
    resetPage()
  }

  // Categorias para poblar el selector de filtro — mismo criterio ya
  // usado en ProductsPage.tsx: reutiliza un modulo ya existente y
  // funcional en vez de inventar uno nuevo.
  const { data: categoriesResponse } = useCategories({ active: true })
  const categories = (categoriesResponse?.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
  }))

  // TODO: `sucursales` sigue sin poblarse — no existe todavia el modulo
  // `features/sucursales` en el frontend (mismo TODO ya documentado en
  // SalesReportPage.tsx/PurchasesReportPage.tsx).

  const handleExport = () => {
    exportToCsv(
      data?.data ?? [],
      [
        { header: 'Producto', value: (item) => item.product.name },
        { header: 'SKU', value: (item) => item.product.sku ?? '' },
        { header: 'Sucursal', value: (item) => item.sucursal.name },
        { header: 'Cantidad', value: (item) => item.quantity },
        { header: 'Punto de reorden', value: (item) => item.reorderPoint ?? '' },
      ],
      `reporte-inventario-pagina-${page}.csv`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Reportes', href: '/reports' },
          { label: 'Reporte de inventario' },
        ]}
        title="Reporte de inventario"
        description="Existencias de productos por sucursal registradas en el sistema."
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
              disabled={!data?.data.length}
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
          <InventoryReportKpiRow filters={filters} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <InventoryReportFilters
                filters={filters}
                categories={categories}
                onFiltersChange={handleFiltersChange}
              />
            }
          />
        </div>

        {isLoading && <InventoryReportTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <InventoryReportTable
              items={data?.data ?? []}
              onRowClick={(item) => navigate(`/products/${item.product.id}/edit`)}
              emptyMessage={
                <EmptyState
                  icon={Boxes}
                  title="No hay existencias para mostrar"
                  description="No se encontraron registros que coincidan con los filtros seleccionados."
                />
              }
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={setPage} itemLabel="registros" />
              </div>
            )}
          </div>
        )}
      </div>

      <ReportRelatedNav currentId="inventory" group="operations" />
    </div>
  )
}
