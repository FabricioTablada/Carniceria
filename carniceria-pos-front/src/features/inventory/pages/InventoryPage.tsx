import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Boxes, Columns3, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useInventory } from '../hooks/useInventory'
import { useUpdateInventory } from '../hooks/useUpdateInventory'
import { useCreateInventoryWaste } from '../hooks/useCreateInventoryWaste'
import { useProducts } from '@/features/products/hooks/useProducts'
import { InventoryAdjustDrawer } from '../components/InventoryAdjustDrawer'
import { InventoryFilters } from '../components/InventoryFilters'
import { InventoryKpiRow } from '../components/InventoryKpiRow'
import { InventoryTable } from '../components/InventoryTable'
import { InventoryTableSkeleton } from '../components/InventoryTableSkeleton'
import { InventoryWasteForm } from '../components/InventoryWasteForm'
import { InventoryWorkspaceTabs } from '../components/InventoryWorkspaceTabs'
import { resolveStockStatus, type StockStatus } from '@/utils/stockStatus'
import { formatQuantity } from '@/utils/formatQuantity'
import { exportToCsv } from '@/utils/exportToCsv'
import { getInventoryErrorMessage } from '../utils/inventoryErrors'
import type {
  CreateInventoryWasteDto,
  Inventory,
  InventoryFilters as InventoryFiltersValue,
  UpdateInventoryDto,
} from '../types/inventory.types'

const STOCK_STATUS_LABELS = {
  critical: 'Sin stock',
  low: 'Bajo stock',
  optimal: 'Normal',
} as const

/**
 * features/inventory/pages/InventoryPage.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — adaptación de Inventario al estándar visual de
 * Productos/Categorías/Impuestos/Proveedores/Promociones: `PageHeader`
 * (con `breadcrumb`) + `InventoryKpiRow` + `Toolbar` (filtros + Exportar +
 * Historial de mermas, reemplaza el botón que antes vivía en
 * `PageHeader.action`) + tabla (selección, skeleton de carga, estado
 * vacío enriquecido, atenuación durante refetch) + `Pagination`.
 *
 * Mantiene exactamente la misma lógica: "Ajustar" sigue navegando a
 * `/inventory/:id/adjust` (ruta dedicada, sin convertir a Drawer — no
 * aprobado para este bloque) y "Registrar merma" sigue siendo el mismo
 * `Dialog` genérico con `InventoryWasteForm` (aprobado explícitamente
 * "mantener como diálogo").
 */
export function InventoryPage() {
  // Rediseño de Productos: accesos directos desde `ProductInventoryWorkspace.tsx`
  // (`/inventory?productId=X`) preseleccionan el filtro por producto — sin
  // esto, el link llegaba a esta pantalla pero mostraba TODO el inventario,
  // no el del producto de origen. Solo se lee al montar (`useState` con
  // inicializador perezoso), igual que cualquier otro valor inicial de
  // filtro — cambiar el filtro despues sigue funcionando exactamente igual.
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<InventoryFiltersValue>(() => {
    const productId = searchParams.get('productId')
    return productId ? { productId } : {}
  })

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useInventory({ ...filters, page })

  const hasActiveFilters = Boolean(filters.sucursalId || filters.productId || filters.search)

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Centro de Control de Inventario (aprobado): filtro "Estado" clicable
  // desde `InventoryKpiRow.tsx` — sobre la página YA CARGADA (la API de
  // Inventario no expone ese parámetro; ver wireframe aprobado). Se
  // resetea al cambiar cualquier otro filtro/página, mismo criterio que
  // `selectedIds`.
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatus | undefined>(undefined)

  const handleFiltersChange = (nextFilters: InventoryFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
    setStockStatusFilter(undefined)
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  // Rediseño de Inventario: "Ajustar" deja de navegar a
  // `/inventory/:id/adjust` (pagina completa para 2 campos) y abre
  // `InventoryAdjustDrawer.tsx` en su lugar — mismo `InventoryAdjustForm`/
  // `useUpdateInventory` de siempre, con contexto y linea de tiempo
  // nuevos. La ruta sigue existiendo (no se elimina funcionalidad), deja
  // de ser el camino principal desde la tabla.
  const [adjustItem, setAdjustItem] = useState<Inventory | null>(null)
  const { mutate: updateInventory, isPending: isAdjusting } = useUpdateInventory()

  const handleAdjust = (item: Inventory) => {
    setAdjustItem(item)
  }

  const handleAdjustSubmit = (values: UpdateInventoryDto) => {
    if (!adjustItem) {
      return
    }

    updateInventory(
      { id: adjustItem.id, dto: values },
      {
        onSuccess: () => setAdjustItem(null),
        onError: (error) => toast.error(getInventoryErrorMessage(error)),
      },
    )
  }

  // Bloque 5.4 ("Modulo de Mermas"): a diferencia de "Ajustar" (ahora
  // Drawer), "Registrar merma" sigue siendo un dialog — mismo criterio ya
  // usado por `SaleDetailDialog.tsx`/`SessionSalesDialog.tsx` en Ventas
  // ("Reutilizar: Dialogs"), sin agregar una ruta nueva.
  const [wasteItem, setWasteItem] = useState<Inventory | null>(null)
  // Flujo de conciliación de inventario (aprobado): cuando "Registrar como
  // Merma" viene del diálogo de conciliación, precarga "Cantidad a mermar"
  // con la diferencia ya detectada — `undefined` (caso normal, "Crear
  // merma" directo desde la tabla/Drawer) deja el campo vacío exactamente
  // como siempre.
  const [wasteQuantityPrefill, setWasteQuantityPrefill] = useState<number | undefined>(undefined)
  const { mutate: createWaste, isPending: isCreatingWaste, error: wasteError } =
    useCreateInventoryWaste()

  const handleRegisterWasteSubmit = (values: CreateInventoryWasteDto) => {
    createWaste(values, { onSuccess: () => setWasteItem(null) })
  }

  const handleOpenRegisterWaste = (item: Inventory) => {
    setWasteItem(item)
    setWasteQuantityPrefill(undefined)
  }

  // Rediseño de Inventario: acción rápida "Crear merma" desde
  // `InventoryAdjustDrawer.tsx` — cierra el Drawer de ajuste y abre el
  // mismo diálogo de merma de siempre para la misma fila. Flujo de
  // conciliación (aprobado): `prefillQuantity` opcional (la diferencia ya
  // detectada) se reenvía como cantidad inicial del formulario.
  const handleRegisterWasteFromDrawer = (item: Inventory, prefillQuantity?: number) => {
    setAdjustItem(null)
    setWasteItem(item)
    setWasteQuantityPrefill(prefillQuantity)
  }

  // Rediseño de Inventario: columnas opcionales (Estado/Última compra/
  // Última venta/Lotes activos) — apagadas por defecto, cada una dispara
  // hooks por fila.
  const [showExtraColumns, setShowExtraColumns] = useState(false)

  // Productos para poblar el selector de filtro. `limit: 100` (techo real
  // del backend): sin esto, el default de 20 dejaba fuera del selector de
  // filtro cualquier producto mas alla de la primera pagina.
  const { data: productsResponse } = useProducts({ active: true, limit: 100 })
  const products = (productsResponse?.data ?? []).map((product) => ({
    id: product.id,
    name: product.name,
  }))

  // Centro de Control de Inventario (aprobado): franja lateral de color de
  // categoría en `InventoryTable.tsx` — cruce en cliente contra la misma
  // lista de productos ya traída arriba (mismo criterio que "Valor total"
  // de `InventoryKpiRow.tsx`), sin endpoint nuevo. Solo cubre los
  // productos activos de la primera página (100) — igual limitación
  // honesta que el resto de los "techo real" del proyecto.
  const categoryByProductId = useMemo(() => {
    const map = new Map<string, { id: string; color: string | null }>()
    for (const product of productsResponse?.data ?? []) {
      map.set(product.id, { id: product.category.id, color: product.category.color })
    }
    return map
  }, [productsResponse])

  const visibleInventory = useMemo(() => {
    const rows = data?.data ?? []
    if (!stockStatusFilter) return rows
    return rows.filter((item) => resolveStockStatus(item.quantity, item.reorderPoint) === stockStatusFilter)
  }, [data, stockStatusFilter])

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((item) => selectedIds.includes(item.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Producto', value: (item) => item.product.name },
        { header: 'SKU', value: (item) => item.product.sku ?? '' },
        { header: 'Sucursal', value: (item) => item.sucursal.name },
        {
          header: 'Cantidad',
          value: (item) => formatQuantity(item.quantity, item.product.unitOfMeasure),
        },
        { header: 'Punto de reorden', value: (item) => item.reorderPoint ?? '' },
        {
          header: 'Estado',
          value: (item) => {
            const status = resolveStockStatus(item.quantity, item.reorderPoint)
            return status ? STOCK_STATUS_LABELS[status] : 'Sin umbral'
          },
        },
      ],
      `inventario-pagina-${page}.csv`,
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Inventario' }]}
        title="Inventario"
        description="Consulta las existencias de productos por sucursal."
      />

      <InventoryWorkspaceTabs />

      {/* Centro de Control de Inventario (aprobado): KPIs, filtros/
          acciones, tabla y paginación pasan a ser franjas de UNA sola
          superficie — mismo contenedor Canvas Workspace ya aprobado en
          Productos/Categorías/Impuestos/Proveedores/Promociones. */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <InventoryKpiRow activeStockStatus={stockStatusFilter} onSelectStockStatus={setStockStatusFilter} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <InventoryFilters filters={filters} products={products} onFiltersChange={handleFiltersChange} />
            }
            actions={
              <>
                <Button
                  type="button"
                  variant={showExtraColumns ? 'default' : 'outline'}
                  onClick={() => setShowExtraColumns((prev) => !prev)}
                  className="h-10 gap-2 rounded-xl"
                >
                  <Columns3 className="size-4" />
                  {showExtraColumns ? 'Menos columnas' : 'Más columnas'}
                </Button>
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
              </>
            }
          />
        </div>

        {isLoading && <InventoryTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el inventario.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <InventoryTable
              inventory={visibleInventory}
              emptyMessage={
                hasActiveFilters || stockStatusFilter ? (
                  <EmptyState
                    icon={Boxes}
                    title="Sin resultados para estos filtros"
                    description="Probá ajustar la sucursal, el producto o el estado seleccionados."
                    action={{
                      label: 'Limpiar filtros',
                      onClick: () => {
                        handleFiltersChange({})
                      },
                    }}
                  />
                ) : (
                  <EmptyState
                    icon={Boxes}
                    title="Todavía no hay existencias registradas"
                    description="Las existencias aparecen aquí a medida que se registran compras o ajustes de inventario."
                  />
                )
              }
              onAdjust={handleAdjust}
              onRegisterWaste={handleOpenRegisterWaste}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              showExtraColumns={showExtraColumns}
              categoryByProductId={categoryByProductId}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="registros" />
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(wasteItem)}
        onOpenChange={(open) => {
          if (!open) {
            setWasteItem(null)
            setWasteQuantityPrefill(undefined)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar merma</DialogTitle>
            <DialogDescription>
              Esta acción descuenta el stock y queda registrada en la auditoría del sistema.
            </DialogDescription>
          </DialogHeader>

          {wasteItem && (
            <InventoryWasteForm
              item={wasteItem}
              isSubmitting={isCreatingWaste}
              onSubmit={handleRegisterWasteSubmit}
              onCancel={() => setWasteItem(null)}
              defaultQuantity={wasteQuantityPrefill}
            />
          )}

          {wasteError && <ErrorAlert>{getInventoryErrorMessage(wasteError)}</ErrorAlert>}
        </DialogContent>
      </Dialog>

      <InventoryAdjustDrawer
        item={adjustItem}
        onOpenChange={(open) => !open && setAdjustItem(null)}
        isSubmitting={isAdjusting}
        onSubmit={handleAdjustSubmit}
        onRegisterWaste={handleRegisterWasteFromDrawer}
      />
    </div>
  )
}
