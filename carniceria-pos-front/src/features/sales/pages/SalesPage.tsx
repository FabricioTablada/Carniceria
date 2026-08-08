import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { Pagination } from '@/components/ui/Pagination'
import { useSales } from '../hooks/useSales'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useCashSessions } from '@/features/cashSession/hooks/useCashSessions'
import { useCashReportDetail } from '@/features/reports/hooks/useCashReportDetail'
import { CashSessionSummaryKpis } from '@/features/reports/components/CashSessionSummaryKpis'
import { useSaleMemoryState, useSaleMemoryPagination } from '../hooks/useSaleMemoryState'
import { SaleFilters } from '../components/SaleFilters'
import { SalesEmptyState } from '../components/SalesEmptyState'
import { SalesTable } from '../components/SalesTable'
import { SalesTableSkeleton } from '../components/SalesTableSkeleton'
import { SaleDetailDialog } from '../components/SaleDetailDialog'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { exportToCsv } from '@/utils/exportToCsv'
import { formatDiscountCell, getSaleTotalDiscount } from '../utils/saleDiscount'
import type { SaleFilters as SaleFiltersValue } from '../types/sale.types'

/**
 * features/sales/pages/SalesPage.tsx
 * -----------------------------------------------------------------------------
 * Bloque 1 de "Ventas = sesion de caja activa" (aprobado): esta pantalla deja
 * de ser un historial navegable y pasa a ser la pantalla de trabajo de la
 * caja actualmente abierta — muestra unicamente las ventas de esa sesion, sin
 * forma de elegir otra. El historial completo (todas las sesiones, pasadas
 * incluidas) vive en Reportes.
 *
 * Fuente de verdad de "hay una caja abierta": `useCashSessions({status:'OPEN'})`
 * contra el backend, NO `cashSessionStore`/`localStorage`.
 *
 * Centro de Operaciones (aprobado): Canvas Workspace único (mismo
 * contenedor exacto que `ProductsPage.tsx`/`UsersPage.tsx`/`ReportsIndexPage.tsx`
 * — `rounded-2xl border bg-card shadow-sm`, sin `overflow-hidden` propio)
 * con KPIs/Toolbar/Tabla/Paginación como franjas internas. Filtros/página
 * persisten mientras el usuario permanece en el módulo
 * (`useSaleMemoryState`/`useSaleMemoryPagination`, memoria en proceso —
 * mismo patrón exacto que Reportes, sin `localStorage`).
 *
 * Corrección de consistencia (aprobado, "copiar literalmente la
 * estructura de Productos"): la franja de KPIs replica EXACTAMENTE
 * `ProductsKpiRow.tsx` — `grid divide-x divide-border`, sin padding
 * propio, sin `gap`, `KpiCard` `bare`/`size="xs"`. `CashSessionSummaryKpis`
 * ahora acepta una prop `bare` (aditiva, `false` por defecto — ver ese
 * archivo) para poder pedirle exactamente esa variante sin afectar a sus
 * otros dos consumidores (`CashSessionSummaryPanel.tsx` del POS,
 * `CashSessionDetailPage.tsx` de Reportes, ninguno de los dos la pasa).
 */
export function SalesPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useSaleMemoryState<Omit<SaleFiltersValue, 'cashSessionId'>>(
    'sales-page-filters',
    {},
  )
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)

  const { data: openSessionsResponse, isLoading: isLoadingSession } = useCashSessions({
    status: 'OPEN',
  })
  const openCashSession = openSessionsResponse?.data[0] ?? null

  // Arquitectura de listados, Bloque 4: `usePagination`/`Pagination`
  // agregan paginacion real.
  const { page, setPage, resetPage } = useSaleMemoryPagination('sales-page-page')

  const {
    data,
    isLoading: isLoadingSales,
    isFetching,
    isError,
    error,
  } = useSales(
    { ...filters, page, cashSessionId: openCashSession?.id },
    { enabled: Boolean(openCashSession) },
  )

  // Bloque 11: mismo criterio que `ProductsPage.tsx` (`hasActiveFilters`)
  // — distingue "0 resultados por los filtros" de "la sesión todavía no
  // tiene ventas" para `SalesEmptyState.tsx`.
  const hasActiveFilters = Boolean(filters.status || filters.userId || filters.sucursalId)

  // Cualquier cambio de filtro vuelve a la pagina 1, mismo criterio que
  // ProductsPage.tsx.
  const handleFiltersChange = (nextFilters: Omit<SaleFiltersValue, 'cashSessionId'>) => {
    setFilters(nextFilters)
    resetPage()
  }

  const handleClearFilters = () => handleFiltersChange({})
  const handleGoToPos = () => navigate('/sales/pos')

  // Cajeros para poblar el selector de filtro. Mismo criterio que
  // ProductsPage con useCategories(): reutiliza un modulo ya existente
  // y funcional en vez de inventar uno nuevo.
  const { data: usersResponse } = useUsers({ active: true })
  const users = (usersResponse?.data ?? []).map((user) => ({
    id: user.id,
    name: user.fullName,
  }))

  // TODO: `sucursales` sigue sin poblarse — no existe todavia el modulo
  // `features/sucursales` en el frontend. `SaleFilters` ya esta preparado
  // para recibirlo por props cuando exista.

  // Rediseño de Ventas: KPIs del listado — reutiliza `useCashReportDetail`/
  // `CashSessionSummaryKpis`, el MISMO hook/componente ya construidos para
  // `CashSessionDetailPage.tsx` (Reportes). Es un agregado real del
  // backend (ventas/montos por método de pago de TODA la sesión), no un
  // cálculo client-side sobre la página filtrada actual.
  const { data: sessionDetailResponse, isLoading: isLoadingSessionDetail } = useCashReportDetail(
    openCashSession?.id ?? '',
    { enabled: Boolean(openCashSession) },
  )
  const sessionDetail = sessionDetailResponse?.data

  // Rediseño de Ventas: exportar CSV — mismo patrón ya usado en
  // Productos/Compras/Inventario/Reportes (`exportToCsv`, sin backend
  // nuevo). Exporta la página actualmente cargada.
  const handleExport = () => {
    exportToCsv(
      data?.data ?? [],
      [
        { header: 'Documento', value: (sale) => sale.documentNumber ?? '' },
        { header: 'Fecha', value: (sale) => formatDateTime(sale.saleDate) },
        { header: 'Cajero', value: (sale) => sale.user.fullName },
        { header: 'Sucursal', value: (sale) => sale.sucursal.name },
        { header: 'Estado', value: (sale) => sale.status },
        {
          header: 'Descuento',
          value: (sale) => formatDiscountCell(getSaleTotalDiscount(sale.items, sale.appliedPromotions)),
        },
        { header: 'Total', value: (sale) => formatCurrency(sale.total) },
      ],
      `ventas-pagina-${page}.csv`,
    )
  }

  const isLoading = isLoadingSession || (Boolean(openCashSession) && isLoadingSales)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Ventas' }]}
        title="Ventas"
        description="Ventas registradas en la sesión de caja actualmente abierta."
        action={
          openCashSession && (
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
          )
        }
      />

      {isLoadingSession && <LoadingState message="Verificando sesión de caja..." />}

      {!isLoadingSession && !openCashSession && (
        <Card className="items-center gap-3 border-dashed px-6 py-16 text-center shadow-none">
          <div className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Wallet className="size-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-lg font-bold tracking-tight">No hay una caja abierta</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Abra una nueva caja para comenzar a registrar ventas.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => navigate('/cash-session/open')}
            className="mt-2 gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
          >
            <Wallet className="size-4" />
            Abrir caja
          </Button>
        </Card>
      )}

      {!isLoadingSession && openCashSession && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border/70">
            <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
              {sessionDetail && !isLoadingSessionDetail && (
                <CashSessionSummaryKpis session={sessionDetail} bare />
              )}
            </div>
          </div>

          <div className="border-b border-border/70 px-4 py-3">
            <Toolbar
              bare
              filters={
                <SaleFilters filters={filters} users={users} onFiltersChange={handleFiltersChange} />
              }
            />
          </div>

          {isLoading && <SalesTableSkeleton bare />}

          {isError && (
            <div className="p-4">
              <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar las ventas.'}</ErrorAlert>
            </div>
          )}

          {!isLoading && !isError && (
            // Bloque 11: mismo patron "atenuar en vez de reemplazar" que
            // `ProductsPage.tsx` — un cambio de filtro/pagina ya no
            // parpadea (vaciar y volver a llenar), la tabla se atenua
            // mientras `useSales` refetchea en segundo plano.
            <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
              <SalesTable
                sales={data?.data ?? []}
                emptyMessage={
                  <SalesEmptyState
                    isFiltered={hasActiveFilters}
                    onClearFilters={handleClearFilters}
                    onGoToPos={handleGoToPos}
                  />
                }
                onSelectSale={setSelectedSaleId}
                onRowClick={(sale) => setSelectedSaleId(sale.id)}
              />

              {data?.meta && (
                <div className="border-t border-border/70 px-4 py-3">
                  <Pagination meta={data.meta} onPageChange={setPage} itemLabel="ventas" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
