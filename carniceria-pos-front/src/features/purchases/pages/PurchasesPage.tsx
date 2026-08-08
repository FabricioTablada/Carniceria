import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { usePurchases } from '../hooks/usePurchases'
import { PurchaseFilters } from '../components/PurchaseFilters'
import { PurchasesKpiRow } from '../components/PurchasesKpiRow'
import { PurchasesTable } from '../components/PurchasesTable'
import { PurchasesTableSkeleton } from '../components/PurchasesTableSkeleton'
import { getPurchaseErrorMessage } from '../utils/purchaseErrors'
import { formatPurchaseDate } from '../utils/purchase.utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { exportToCsv } from '@/utils/exportToCsv'
import type {
  Purchase,
  PurchaseFilters as PurchaseFiltersValue,
} from '../types/purchase.types'

const STATUS_LABELS: Record<Purchase['status'], string> = {
  DRAFT: 'Borrador',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
}

/**
 * features/purchases/pages/PurchasesPage.tsx
 * -----------------------------------------------------------------------------
 * Canvas Workspace (aprobado) — adaptación de Compras al estándar visual
 * de Productos/Categorías/Impuestos/Proveedores/Promociones/Inventario:
 * `PageHeader` (con `breadcrumb`) + un único contenedor
 * (`rounded-2xl border bg-card shadow-sm`, sin `overflow-hidden` propio)
 * con KPIs/Toolbar/tabla/paginación como franjas internas separadas por
 * `border-b`/`border-t`, en vez de tarjetas independientes — mismo
 * patrón exacto que `SuppliersPage.tsx`/`InventoryPage.tsx`. Mantiene
 * exactamente la misma lógica: mismos hooks, misma paginación, mismas
 * rutas de destino (`/purchases/new`, `/purchases/:id`,
 * `/purchases/:id/edit`) — sin Drawer, ya que convertir el detalle en
 * `WorkspacePanel` implicaría un cambio de navegación no solicitado para
 * este bloque.
 */
export function PurchasesPage() {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canCreatePurchase = hasPermission(PERMISSIONS.PURCHASES_CREATE)
  const [filters, setFilters] = useState<PurchaseFiltersValue>({})

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = usePurchases({ ...filters, page })

  const hasActiveFilters = Boolean(filters.status || filters.supplierId)

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const handleFiltersChange = (nextFilters: PurchaseFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  // Canvas Workspace (aprobado): las celdas de `PurchasesKpiRow.tsx`
  // aplican el filtro "Estado" — mismo `handleFiltersChange` que ya usa
  // `PurchaseFilters`, sin lógica de filtrado nueva.
  const handleKpiStatusSelect = (status: PurchaseFiltersValue['status']) => {
    handleFiltersChange({ ...filters, status })
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  const handleCreatePurchase = () => {
    navigate('/purchases/new')
  }

  const handleEdit = (purchase: Purchase) => {
    navigate(`/purchases/${purchase.id}/edit`)
  }

  const handleView = (purchase: Purchase) => {
    navigate(`/purchases/${purchase.id}`)
  }

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((purchase) => selectedIds.includes(purchase.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Documento', value: (purchase) => purchase.documentNumber ?? '' },
        { header: 'Fecha', value: (purchase) => formatPurchaseDate(purchase.purchaseDate) },
        { header: 'Proveedor', value: (purchase) => purchase.supplier.name },
        { header: 'Usuario', value: (purchase) => purchase.user.fullName },
        { header: 'Estado', value: (purchase) => STATUS_LABELS[purchase.status] },
        { header: 'Subtotal', value: (purchase) => formatCurrency(purchase.subtotal) },
        { header: 'Impuesto', value: (purchase) => formatCurrency(purchase.taxTotal) },
        { header: 'Total', value: (purchase) => formatCurrency(purchase.total) },
      ],
      `compras-pagina-${page}.csv`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Compras' }]}
        title="Compras"
        description="Consulta el historial de compras registradas en el sistema."
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <PurchasesKpiRow activeStatus={filters.status} onSelectStatus={handleKpiStatusSelect} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={<PurchaseFilters filters={filters} onFiltersChange={handleFiltersChange} />}
            actions={
              <>
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
                <Can permission={PERMISSIONS.PURCHASES_CREATE}>
                  <Button
                    type="button"
                    onClick={handleCreatePurchase}
                    className="h-10 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                  >
                    <Plus className="size-4" />
                    Nueva compra
                  </Button>
                </Can>
              </>
            }
          />
        </div>

        {isLoading && <PurchasesTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{getPurchaseErrorMessage(error)}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <PurchasesTable
              purchases={data?.data ?? []}
              emptyMessage={
                hasActiveFilters ? (
                  <EmptyState
                    icon={Truck}
                    title="Sin resultados para estos filtros"
                    description="Probá ajustar el estado o el proveedor seleccionados."
                    action={{ label: 'Limpiar filtros', onClick: () => handleFiltersChange({}) }}
                  />
                ) : (
                  <EmptyState
                    icon={Truck}
                    title="Todavía no hay compras registradas"
                    description="Registrá tu primera compra a proveedor para empezar."
                    action={
                      canCreatePurchase
                        ? { label: 'Nueva compra', onClick: handleCreatePurchase, variant: 'brand' }
                        : undefined
                    }
                  />
                )
              }
              onEdit={handleEdit}
              onView={handleView}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="compras" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
