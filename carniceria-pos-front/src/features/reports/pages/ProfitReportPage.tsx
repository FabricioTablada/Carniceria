import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, Printer, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { exportToCsv } from '@/utils/exportToCsv'
import { formatDateTime } from '@/utils/formatDateTime'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { SaleDetailDialog } from '@/features/sales/components/SaleDetailDialog'
import { useProfitReport } from '../hooks/useProfitReport'
import { useReportMemoryState, useReportMemoryPagination } from '../hooks/useReportMemoryState'
import { ProfitReportTable } from '../components/ProfitReportTable'
import { ProfitReportTableSkeleton } from '../components/ProfitReportTableSkeleton'
import { ProfitReportKpiRow } from '../components/ProfitReportKpiRow'
import { ProfitReportFilters } from '../components/ProfitReportFilters'
import { ReportRelatedNav } from '../components/ReportRelatedNav'
import type { ProfitReportFilters as ProfitReportFiltersValue } from '../types/report.types'

/**
 * features/reports/pages/ProfitReportPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): mismo Canvas Workspace/memoria de
 * filtros/siembra de período que `SalesReportPage.tsx` (la plantilla de
 * referencia). Cero cambio de lógica: mismos filtros/consulta/columnas de
 * siempre.
 */
export function ProfitReportPage() {
  const location = useLocation()
  const [filters, setFilters] = useReportMemoryState<Omit<ProfitReportFiltersValue, 'page' | 'limit'>>(
    'profit-report-filters',
    () => {
      const navigationState = location.state as { dateFrom?: string; dateTo?: string } | null
      return navigationState?.dateFrom ? { dateFrom: navigationState.dateFrom, dateTo: navigationState.dateTo } : {}
    },
  )
  const { page, setPage, resetPage } = useReportMemoryPagination('profit-report-page')
  const { data, isLoading, isFetching, isError, error } = useProfitReport({ ...filters, page })
  // Navegación contextual (aprobado): abre la venta de la línea clicada,
  // mismo `SaleDetailDialog` que `SalesReportPage.tsx`.
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

  const handleFiltersChange = (nextFilters: Omit<ProfitReportFiltersValue, 'page' | 'limit'>) => {
    setFilters(nextFilters)
    resetPage()
  }

  // Categorias para poblar el selector de filtro — mismo criterio ya
  // usado en InventoryReportPage.tsx/ProductsPage.tsx.
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
      data?.data ?? [],
      [
        { header: 'Documento', value: (item) => item.sale.documentNumber ?? '' },
        // Bloque 7.35: mismo fix ya validado en `SalesReportTable.tsx`
        // (05/08/2026) — `saleDate` es un instante UTC real, `slice(0,10)`
        // mostraba un día adelantado para ventas de 18:00 a 23:59 hora CR.
        { header: 'Fecha', value: (item) => formatDateTime(item.sale.saleDate).split(' ')[0] },
        { header: 'Producto', value: (item) => item.product.name },
        { header: 'SKU', value: (item) => item.product.sku ?? '' },
        { header: 'Cantidad', value: (item) => item.quantity },
        { header: 'Precio unitario', value: (item) => item.unitPrice },
        { header: 'Subtotal', value: (item) => item.lineSubtotal },
        { header: 'Impuesto', value: (item) => item.lineTax },
        { header: 'Total', value: (item) => item.lineTotal },
        { header: 'Costo total', value: (item) => item.costTotal ?? '' },
        { header: 'Utilidad', value: (item) => item.profit ?? '' },
        { header: 'Margen', value: (item) => item.marginPercent ?? '' },
      ],
      `reporte-utilidad-pagina-${page}.csv`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Reportes', href: '/reports' },
          { label: 'Reporte de utilidad' },
        ]}
        title="Reporte de utilidad"
        description="Detalle de costo y precio por línea de venta registrada en el sistema."
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
          <ProfitReportKpiRow filters={filters} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <ProfitReportFilters
                filters={filters}
                categories={categories}
                onFiltersChange={handleFiltersChange}
              />
            }
          />
        </div>

        {isLoading && <ProfitReportTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <ProfitReportTable
              items={data?.data ?? []}
              onRowClick={(item) => setSelectedSaleId(item.saleId)}
              emptyMessage={
                <EmptyState
                  icon={TrendingUp}
                  title="No hay detalle de utilidad para mostrar"
                  description="No se encontraron líneas de venta que coincidan con los filtros seleccionados."
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

      <ReportRelatedNav currentId="profit" group="finance" />

      <SaleDetailDialog
        saleId={selectedSaleId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSaleId(null)
          }
        }}
      />
    </div>
  )
}
