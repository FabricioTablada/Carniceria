import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { usePagination } from '@/hooks/usePagination'
import { useInventoryWastes } from '../hooks/useInventoryWastes'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useUsers } from '@/features/users/hooks/useUsers'
import { InventoryWasteAnalysis } from '../components/InventoryWasteAnalysis'
import { InventoryWasteFilters } from '../components/InventoryWasteFilters'
import { InventoryWasteKpiRow } from '../components/InventoryWasteKpiRow'
import { InventoryWasteTable } from '../components/InventoryWasteTable'
import { InventoryWasteTableSkeleton } from '../components/InventoryWasteTableSkeleton'
import { InventoryWasteDrawer } from '../components/InventoryWasteDrawer'
import { InventoryWorkspaceTabs } from '../components/InventoryWorkspaceTabs'
import { WASTE_REASON_OPTIONS } from '../constants/wasteReason.constants'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatQuantity } from '@/utils/formatQuantity'
import { exportToCsv } from '@/utils/exportToCsv'
import type { InventoryWaste, ListInventoryWasteFilters } from '../types/inventory.types'

/**
 * features/inventory/pages/InventoryWastesPage.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — mismo estándar visual que `InventoryPage.tsx`:
 * `PageHeader` (con `breadcrumb`) + `InventoryWasteKpiRow` + `Toolbar`
 * (filtros + Exportar) + tabla (selección, skeleton, estado vacío,
 * atenuación durante refetch) + `Pagination` + `InventoryWasteDrawer`
 * (reemplaza a `InventoryWasteDetailDialog.tsx`, mismo `wasteId` como
 * estado de apertura, misma consulta).
 */
export function InventoryWastesPage() {
  const [filters, setFilters] = useState<ListInventoryWasteFilters>({})
  const [wasteDetailId, setWasteDetailId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Centro de Control de Inventario (aprobado): "Detalle" es la tabla de
  // siempre; "Análisis" es la nueva sub-vista de merma real vs. esperada
  // (`InventoryWasteAnalysis.tsx`) — mismo filtro de sucursal, sin
  // paginación (es un agregado, no un listado).
  const [view, setView] = useState<'detail' | 'analysis'>('detail')

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useInventoryWastes({ ...filters, page })

  const hasActiveFilters = Boolean(filters.productId || filters.userId || filters.reason)

  const handleFiltersChange = (nextFilters: ListInventoryWasteFilters) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  // Productos y usuarios para poblar los selectores de filtro. `limit:
  // 100` (techo real del backend): sin esto, el default de 20 dejaba
  // fuera del selector de filtro cualquier producto mas alla de la
  // primera pagina.
  const { data: productsResponse } = useProducts({ active: true, limit: 100 })
  const products = (productsResponse?.data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
  }))

  const { data: usersResponse } = useUsers({ active: true })
  const users = (usersResponse?.data ?? []).map((user) => ({
    id: user.id,
    name: user.fullName,
  }))

  const handleViewDetail = (waste: InventoryWaste) => {
    setWasteDetailId(waste.id)
  }

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((waste) => selectedIds.includes(waste.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Fecha', value: (waste) => formatDateTime(waste.createdAt) },
        { header: 'Producto', value: (waste) => waste.product.name },
        {
          header: 'Cantidad',
          value: (waste) => formatQuantity(waste.quantity, waste.product.unitOfMeasure),
        },
        {
          header: 'Motivo',
          value: (waste) =>
            WASTE_REASON_OPTIONS.find((option) => option.value === waste.reason)?.label ??
            waste.reason,
        },
        {
          header: 'Origen',
          value: (waste) => (waste.sourceReturnItemId ? 'Devolución de venta' : 'Registro manual'),
        },
        { header: 'Usuario', value: (waste) => waste.user.fullName },
        { header: 'Sucursal', value: (waste) => waste.sucursal.name },
        { header: 'Valor', value: (waste) => formatCurrency(waste.totalValue) },
      ],
      `mermas-pagina-${page}.csv`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Inventario', href: '/inventory' },
          { label: 'Historial de mermas' },
        ]}
        title="Historial de mermas"
        description="Consulta el registro de mermas de inventario por producto, usuario y motivo."
      />

      <InventoryWorkspaceTabs />

      {/* Centro de Control de Inventario (aprobado): mismo Canvas
          Workspace único que `InventoryPage.tsx`/`BatchesPage.tsx` —
          Mermas deja de ser "solo una tabla" y suma KPIs con identidad
          propia + una sub-vista de Análisis (real vs. esperada). */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <InventoryWasteKpiRow
            activeReason={filters.reason}
            onSelectReason={(reason) => handleFiltersChange({ ...filters, reason })}
          />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <>
                <SegmentedControl
                  options={[
                    { value: 'detail', label: 'Detalle' },
                    { value: 'analysis', label: 'Análisis' },
                  ]}
                  value={view}
                  onChange={(value) => setView(value as 'detail' | 'analysis')}
                />
                <InventoryWasteFilters
                  filters={filters}
                  products={products}
                  users={users}
                  onFiltersChange={handleFiltersChange}
                />
              </>
            }
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={handleExport}
                disabled={!data?.data.length}
                className="h-10 gap-2 rounded-xl"
              >
                <Download className="size-4" />
                {selectedIds.length > 0 ? `Exportar (${selectedIds.length})` : 'Exportar'}
              </Button>
            }
          />
        </div>

        {view === 'analysis' && (
          <InventoryWasteAnalysis filters={{ sucursalId: filters.sucursalId }} />
        )}

        {view === 'detail' && (
          <>
            {isLoading && <InventoryWasteTableSkeleton bare />}

            {isError && (
              <div className="p-4">
                <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar las mermas.'}</ErrorAlert>
              </div>
            )}

            {!isLoading && !isError && (
              <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
                <InventoryWasteTable
                  wastes={data?.data ?? []}
                  emptyMessage={
                    hasActiveFilters ? (
                      <EmptyState
                        icon={Trash2}
                        title="Sin resultados para estos filtros"
                        description="Probá ajustar la búsqueda o los filtros seleccionados."
                        action={{ label: 'Limpiar filtros', onClick: () => handleFiltersChange({}) }}
                      />
                    ) : (
                      <EmptyState
                        icon={Trash2}
                        title="Todavía no hay mermas registradas"
                        description="Las mermas quedan aquí a medida que se registran desde Inventario."
                      />
                    )
                  }
                  onViewDetail={handleViewDetail}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                />

                {data?.meta && (
                  <div className="border-t border-border/70 px-4 py-3">
                    <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="registros" />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <InventoryWasteDrawer
        wasteId={wasteDetailId}
        onOpenChange={(open) => !open && setWasteDetailId(null)}
      />
    </div>
  )
}
