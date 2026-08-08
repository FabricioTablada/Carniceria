import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, Printer, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { exportToCsv } from '@/utils/exportToCsv'
import { formatDateTime } from '@/utils/formatDateTime'
import { useUsers } from '@/features/users/hooks/useUsers'
import { PAYMENT_METHOD_OPTIONS } from '@/features/sales/utils/payment'
import { SaleDetailDialog } from '@/features/sales/components/SaleDetailDialog'
import { useSalesReport } from '../hooks/useSalesReport'
import { useReportMemoryState, useReportMemoryPagination } from '../hooks/useReportMemoryState'
import { SalesReportTable } from '../components/SalesReportTable'
import { SalesReportTableSkeleton } from '../components/SalesReportTableSkeleton'
import { SalesReportKpiRow } from '../components/SalesReportKpiRow'
import { SalesReportFilters } from '../components/SalesReportFilters'
import { ReportRelatedNav } from '../components/ReportRelatedNav'
import type { SalesReportFilters as SalesReportFiltersValue } from '../types/report.types'

/**
 * features/reports/pages/SalesReportPage.tsx
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): Canvas Workspace único (mismo contenedor
 * exacto que `ProductsPage.tsx`/`UsersPage.tsx` — `rounded-2xl border
 * bg-card shadow-sm`, sin `overflow-hidden` propio) con KPIs/Toolbar/
 * Tabla/Paginación como franjas internas, en vez de piezas independientes
 * apiladas. Mismos datos y mismas consultas de siempre — cero cambio de
 * lógica.
 *
 * Filtros/página persisten mientras el usuario se queda en Reportes
 * (`useReportMemoryState`/`useReportMemoryPagination`, memoria en
 * proceso, no `localStorage` — se pierde con F5, mismo criterio que
 * cualquier estado de React). Si se llega desde el selector de período
 * del Centro de Análisis (`location.state`), ese rango siembra el filtro
 * inicial la primera vez — el usuario puede seguir editándolo libremente
 * después, como cualquier filtro.
 */
export function SalesReportPage() {
  const location = useLocation()
  const [filters, setFilters] = useReportMemoryState<Omit<SalesReportFiltersValue, 'page' | 'limit'>>(
    'sales-report-filters',
    () => {
      const navigationState = location.state as { dateFrom?: string; dateTo?: string } | null
      return navigationState?.dateFrom ? { dateFrom: navigationState.dateFrom, dateTo: navigationState.dateTo } : {}
    },
  )
  const { page, setPage, resetPage } = useReportMemoryPagination('sales-report-page')
  const { data, isLoading, isFetching, isError, error } = useSalesReport({ ...filters, page })
  // Navegación contextual (aprobado, "Historial de ventas → abrir la
  // Venta correspondiente"): reutiliza `SaleDetailDialog` TAL CUAL, el
  // mismo modal que ya usan `SalesPage.tsx`/`CashSessionDetailPage.tsx` —
  // ningún Drawer/ruta/vista nueva.
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

  const handleFiltersChange = (nextFilters: Omit<SalesReportFiltersValue, 'page' | 'limit'>) => {
    setFilters(nextFilters)
    resetPage()
  }

  // Cajeros para poblar el selector de filtro — mismo criterio ya usado en
  // CashReportPage.tsx/ProductsPage.tsx: reutiliza un modulo ya existente y
  // funcional en vez de inventar uno nuevo.
  const { data: usersResponse } = useUsers({ active: true })
  const users = (usersResponse?.data ?? []).map((user) => ({
    id: user.id,
    name: user.fullName,
  }))

  // TODO: `sucursales` sigue sin poblarse — no existe todavia el modulo
  // `features/sucursales` en el frontend (mismo TODO ya documentado en
  // CashReportPage.tsx/SalesPage.tsx). `SalesReportFilters` ya esta
  // preparado para recibirlo por props cuando exista.

  // Mismo criterio que `ProductsPage.tsx::handleExport`: exporta la pagina
  // actual ya cargada, no todo el reporte (evita una peticion nueva fuera
  // del alcance de este bloque).
  const handleExport = () => {
    exportToCsv(
      data?.data ?? [],
      [
        { header: 'Documento', value: (item) => item.documentNumber ?? '' },
        // Bloque 7.35: mismo fix ya validado en `SalesReportTable.tsx`
        // (05/08/2026) — `saleDate` es un instante UTC real, `slice(0,10)`
        // mostraba un día adelantado para ventas de 18:00 a 23:59 hora CR.
        { header: 'Fecha', value: (item) => formatDateTime(item.saleDate).split(' ')[0] },
        { header: 'Sucursal', value: (item) => item.sucursal.name },
        { header: 'Cajero', value: (item) => item.user.fullName },
        {
          header: 'Método de pago',
          value: (item) =>
            PAYMENT_METHOD_OPTIONS.find((option) => option.value === item.paymentMethod)?.label ??
            item.paymentMethod,
        },
        { header: 'Referencia', value: (item) => item.paymentReference ?? '' },
        { header: 'Subtotal', value: (item) => item.subtotal },
        { header: 'Impuesto', value: (item) => item.taxTotal },
        { header: 'Descuento', value: (item) => item.discountAmount },
        { header: 'Total', value: (item) => item.total },
      ],
      `reporte-ventas-pagina-${page}.csv`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Reportes', href: '/reports' },
          { label: 'Reporte de ventas' },
        ]}
        title="Reporte de ventas"
        description="Detalle de las ventas completadas registradas en el sistema."
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
          <SalesReportKpiRow filters={filters} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar bare filters={<SalesReportFilters filters={filters} users={users} onFiltersChange={handleFiltersChange} />} />
        </div>

        {isLoading && <SalesReportTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <SalesReportTable
              items={data?.data ?? []}
              onRowClick={(item) => setSelectedSaleId(item.id)}
              emptyMessage={
                <EmptyState
                  icon={ShoppingCart}
                  title="No hay ventas para mostrar"
                  description="No se encontraron ventas que coincidan con los filtros seleccionados."
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

      <ReportRelatedNav currentId="sales" group="sales" />

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
