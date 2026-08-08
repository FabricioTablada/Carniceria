import { useNavigate } from 'react-router-dom'
import { Download, Printer, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { exportToCsv } from '@/utils/exportToCsv'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { formatQuantity } from '@/utils/formatQuantity'
import { useLowStock } from '../hooks/useLowStock'
import { useReportMemoryState } from '../hooks/useReportMemoryState'
import { LowStockTable } from '../components/LowStockTable'
import { LowStockTableSkeleton } from '../components/LowStockTableSkeleton'
import { LowStockKpiRow } from '../components/LowStockKpiRow'
import { LowStockFilters } from '../components/LowStockFilters'
import { ReportRelatedNav } from '../components/ReportRelatedNav'
import type { LowStockFilters as LowStockFiltersValue } from '../types/report.types'

/**
 * features/reports/pages/LowStockPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): mismo Canvas Workspace/memoria de
 * filtros que `SalesReportPage.tsx`, adaptado a que este reporte nunca
 * pagina (`useLowStock` siempre trae el conjunto completo). Fila
 * completa en rojo cuando la existencia es 0 — ver
 * `LowStockTable.tsx`. Sin período (sin `dateFrom`/`dateTo` en este
 * reporte): no siembra nada desde `location.state`.
 */
export function LowStockPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useReportMemoryState<LowStockFiltersValue>('low-stock-filters', {})
  const { data, isLoading, isFetching, isError, error } = useLowStock(filters)
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
        { header: 'Producto', value: (item) => item.productName },
        { header: 'SKU', value: (item) => item.sku ?? '' },
        { header: 'Categoría', value: (item) => item.categoryName ?? '' },
        { header: 'Sucursal', value: (item) => item.sucursalName },
        { header: 'Cantidad', value: (item) => formatQuantity(item.quantity, item.unitOfMeasure) },
        { header: 'Punto de reorden', value: (item) => item.reorderPoint ?? '' },
        { header: 'Punto de corte usado', value: (item) => item.thresholdUsed ?? '' },
      ],
      'reporte-bajo-inventario.csv',
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Reportes', href: '/reports' },
          { label: 'Bajo inventario' },
        ]}
        title="Bajo inventario"
        description="Productos cuya existencia está en o por debajo de su punto de reorden."
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
          <LowStockKpiRow items={items} isLoading={isLoading} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <LowStockFilters filters={filters} categories={categories} onFiltersChange={setFilters} />
            }
          />
        </div>

        {isLoading && <LowStockTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <LowStockTable
              items={items}
              onRowClick={(item) => navigate(`/products/${item.productId}/edit`)}
              emptyMessage={
                <EmptyState
                  icon={TriangleAlert}
                  title="No hay productos con bajo inventario"
                  description="No se encontraron productos que coincidan con los filtros seleccionados."
                />
              }
            />
          </div>
        )}
      </div>

      <ReportRelatedNav currentId="low-stock" group="operations" />
    </div>
  )
}
