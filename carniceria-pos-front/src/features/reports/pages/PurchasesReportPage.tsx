import { useLocation, useNavigate } from 'react-router-dom'
import { Download, Printer, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { exportToCsv } from '@/utils/exportToCsv'
import { formatDateTime } from '@/utils/formatDateTime'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { usePurchasesReport } from '../hooks/usePurchasesReport'
import { useReportMemoryState, useReportMemoryPagination } from '../hooks/useReportMemoryState'
import { PurchasesReportTable } from '../components/PurchasesReportTable'
import { PurchasesReportTableSkeleton } from '../components/PurchasesReportTableSkeleton'
import { PurchasesReportKpiRow } from '../components/PurchasesReportKpiRow'
import { PurchasesReportFilters } from '../components/PurchasesReportFilters'
import { ReportRelatedNav } from '../components/ReportRelatedNav'
import type { PurchasesReportFilters as PurchasesReportFiltersValue } from '../types/report.types'

/**
 * features/reports/pages/PurchasesReportPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): mismo Canvas Workspace/memoria de
 * filtros/siembra de período que `SalesReportPage.tsx` (la plantilla de
 * referencia de este bloque) — ver su comentario de archivo. Cero cambio
 * de lógica: mismos filtros/consulta/columnas de siempre.
 */
export function PurchasesReportPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [filters, setFilters] = useReportMemoryState<Omit<PurchasesReportFiltersValue, 'page' | 'limit'>>(
    'purchases-report-filters',
    () => {
      const navigationState = location.state as { dateFrom?: string; dateTo?: string } | null
      return navigationState?.dateFrom ? { dateFrom: navigationState.dateFrom, dateTo: navigationState.dateTo } : {}
    },
  )
  const { page, setPage, resetPage } = useReportMemoryPagination('purchases-report-page')
  const { data, isLoading, isFetching, isError, error } = usePurchasesReport({ ...filters, page })

  const handleFiltersChange = (nextFilters: Omit<PurchasesReportFiltersValue, 'page' | 'limit'>) => {
    setFilters(nextFilters)
    resetPage()
  }

  // Proveedores para poblar el selector de filtro — mismo criterio ya
  // usado en ProductsPage.tsx/CashReportPage.tsx: reutiliza un modulo ya
  // existente y funcional en vez de inventar uno nuevo.
  const { data: suppliersResponse } = useSuppliers({ active: true })
  const suppliers = (suppliersResponse?.data ?? []).map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
  }))

  // TODO: `sucursales` sigue sin poblarse — no existe todavia el modulo
  // `features/sucursales` en el frontend (mismo TODO ya documentado en
  // CashReportPage.tsx/SalesReportPage.tsx).

  const handleExport = () => {
    exportToCsv(
      data?.data ?? [],
      [
        { header: 'Documento', value: (item) => item.documentNumber ?? '' },
        // Bloque 7.35: mismo fix ya validado en `SalesReportTable.tsx`
        // (05/08/2026) — `purchaseDate` (fila del reporte) es un instante
        // UTC real, `slice(0,10)` mostraba un día adelantado para compras
        // de 18:00 a 23:59 hora CR.
        { header: 'Fecha', value: (item) => formatDateTime(item.purchaseDate).split(' ')[0] },
        { header: 'Proveedor', value: (item) => item.supplier.name },
        { header: 'Usuario', value: (item) => item.user.fullName },
        { header: 'Estado', value: (item) => item.status },
        { header: 'Subtotal', value: (item) => item.subtotal },
        { header: 'Impuesto', value: (item) => item.taxTotal },
        { header: 'Total', value: (item) => item.total },
      ],
      `reporte-compras-pagina-${page}.csv`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Reportes', href: '/reports' },
          { label: 'Reporte de compras' },
        ]}
        title="Reporte de compras"
        description="Detalle de las compras registradas en el sistema."
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
          <PurchasesReportKpiRow filters={filters} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <PurchasesReportFilters
                filters={filters}
                suppliers={suppliers}
                onFiltersChange={handleFiltersChange}
              />
            }
          />
        </div>

        {isLoading && <PurchasesReportTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <PurchasesReportTable
              items={data?.data ?? []}
              onRowClick={(item) => navigate(`/purchases/${item.id}`)}
              emptyMessage={
                <EmptyState
                  icon={Truck}
                  title="No hay compras para mostrar"
                  description="No se encontraron compras que coincidan con los filtros seleccionados."
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

      <ReportRelatedNav currentId="purchases" group="operations" />
    </div>
  )
}
