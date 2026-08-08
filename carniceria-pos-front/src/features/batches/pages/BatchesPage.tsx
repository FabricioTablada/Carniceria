import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Layers3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useProducts } from '@/features/products/hooks/useProducts'
import { InventoryWorkspaceTabs } from '@/features/inventory/components/InventoryWorkspaceTabs'
import { useBatches } from '../hooks/useBatches'
import { BatchFilters } from '../components/BatchFilters'
import { BatchesKpiRow } from '../components/BatchesKpiRow'
import { BatchesTable } from '../components/BatchesTable'
import { BatchesTableSkeleton } from '../components/BatchesTableSkeleton'
import { BatchDrawer } from '../components/BatchDrawer'
import { formatQuantity } from '@/utils/formatQuantity'
import { formatBatchDate } from '../utils/batch.utils'
import { exportToCsv } from '@/utils/exportToCsv'
import type { Batch, BatchFilters as BatchFiltersValue } from '../types/batch.types'

/**
 * features/batches/pages/BatchesPage.tsx
 * -----------------------------------------------------------------------------
 * Bloque LOTES-04 (frontend del Modulo de Lotes). Mismo estandar visual
 * PIPASA V1 ya usado en `InventoryWastesPage.tsx`: `PageHeader` (con
 * `breadcrumb`) + `BatchesKpiRow` + `Toolbar` (filtros + Exportar) + tabla
 * (seleccion, skeleton de carga, estado vacio enriquecido, atenuacion
 * durante refetch) + `Pagination` + `BatchDrawer` (consulta de detalle).
 *
 * "Ajustar / Bloquear" navega a una ruta dedicada (`/inventory/batches/:id/adjust`),
 * mismo criterio que "Ajustar" en `InventoryPage.tsx`/`InventoryAdjustPage.tsx` —
 * no un Drawer de edicion.
 */
export function BatchesPage() {
  const navigate = useNavigate()
  // Rediseño de Productos: acceso directo desde `ProductInventoryWorkspace.tsx`
  // (`/inventory/batches?productId=X`) preselecciona el filtro por producto,
  // mismo criterio ya aplicado en `InventoryPage.tsx`.
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<BatchFiltersValue>(() => {
    const productId = searchParams.get('productId')
    // Centro de Control de Inventario (aprobado): acceso directo desde
    // `InventoryKpiRow.tsx`/`BatchesKpiRow.tsx` (`?status=ACTIVE`, etc.)
    // — mismo criterio ya usado para `productId` arriba.
    const status = searchParams.get('status') as BatchFiltersValue['status'] | null
    return {
      ...(productId ? { productId } : {}),
      ...(status ? { status } : {}),
    }
  })
  const [batchDetailId, setBatchDetailId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useBatches({ ...filters, page })

  const hasActiveFilters = Boolean(filters.productId || filters.supplierId || filters.status)

  const handleFiltersChange = (nextFilters: BatchFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  // Productos para poblar el selector de filtro. `limit: 100` (techo real
  // del backend): mismo criterio ya usado en `InventoryWastesPage.tsx`.
  const { data: productsResponse } = useProducts({ limit: 100 })
  const products = (productsResponse?.data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
  }))

  const handleViewDetail = (batch: Batch) => {
    setBatchDetailId(batch.id)
  }

  const handleAdjust = (batchId: string) => {
    navigate(`/inventory/batches/${batchId}/adjust`)
  }

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((batch) => selectedIds.includes(batch.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Código', value: (batch) => batch.code },
        { header: 'Producto', value: (batch) => batch.product.name },
        { header: 'Sucursal', value: (batch) => batch.sucursal.name },
        { header: 'Proveedor', value: (batch) => batch.supplier?.name ?? '' },
        {
          header: 'Cantidad inicial',
          value: (batch) => formatQuantity(batch.initialQuantity, batch.product.unitOfMeasure),
        },
        {
          header: 'Cantidad disponible',
          value: (batch) => formatQuantity(batch.availableQuantity, batch.product.unitOfMeasure),
        },
        { header: 'Recepción', value: (batch) => formatBatchDate(batch.receivedAt) },
        { header: 'Vencimiento', value: (batch) => formatBatchDate(batch.expiryDate) },
        { header: 'Estado', value: (batch) => batch.status },
      ],
      `lotes-pagina-${page}.csv`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Inventario', href: '/inventory' },
          { label: 'Lotes' },
        ]}
        title="Lotes"
        description="Consulta los lotes por producto, sucursal y proveedor, y ajusta o bloquea los que lo requieran."
      />

      <InventoryWorkspaceTabs />

      {/* Centro de Control de Inventario (aprobado): mismo Canvas
          Workspace único que `InventoryPage.tsx`/`InventoryWastesPage.tsx`. */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <BatchesKpiRow
            activeStatus={filters.status}
            onSelectStatus={(status) => handleFiltersChange({ ...filters, status })}
          />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <BatchFilters filters={filters} products={products} onFiltersChange={handleFiltersChange} />
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

        {isLoading && <BatchesTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar los lotes.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <BatchesTable
              batches={data?.data ?? []}
              emptyMessage={
                hasActiveFilters ? (
                  <EmptyState
                    icon={Layers3}
                    title="Sin resultados para estos filtros"
                    description="Probá ajustar la búsqueda o los filtros seleccionados."
                    action={{ label: 'Limpiar filtros', onClick: () => handleFiltersChange({}) }}
                  />
                ) : (
                  <EmptyState
                    icon={Layers3}
                    title="Todavía no hay lotes registrados"
                    description="Los lotes se crean automáticamente al recibir compras de productos que requieren control por lote."
                  />
                )
              }
              onViewDetail={handleViewDetail}
              onAdjust={(batch) => handleAdjust(batch.id)}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="lotes" />
              </div>
            )}
          </div>
        )}
      </div>

      <BatchDrawer
        batchId={batchDetailId}
        onOpenChange={(open) => !open && setBatchDetailId(null)}
        onAdjust={(batchId) => {
          setBatchDetailId(null)
          handleAdjust(batchId)
        }}
      />
    </div>
  )
}
