import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Download, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { KbdHint } from '@/components/ui/KbdHint'
import { Pagination } from '@/components/ui/Pagination'
import { toast } from 'sonner'
import { PERMISSIONS } from '@/constants/permissions'
import { usePagination } from '@/hooks/usePagination'
import { usePermissions } from '@/hooks/usePermissions'
import { useSuppliers } from '../hooks/useSuppliers'
import { useUpdateSupplierStatus } from '../hooks/useUpdateSupplierStatus'
import { SupplierDrawer } from '../components/SupplierDrawer'
import { SuppliersKpiRow } from '../components/SuppliersKpiRow'
import { SuppliersTable } from '../components/SuppliersTable'
import { SuppliersTableSkeleton } from '../components/SuppliersTableSkeleton'
import { SupplierFilters } from '../components/SupplierFilters'
import { exportToCsv } from '@/utils/exportToCsv'
import { getSupplierErrorMessage } from '../utils/supplierErrors'
import type {
  Supplier,
  SupplierFilters as SupplierFiltersValue,
} from '../types/supplier.types'

/**
 * features/suppliers/pages/SuppliersPage.tsx
 * -----------------------------------------------------------------------------
 * Workspace Proveedores (aprobado, "mismo Design System que Productos/
 * Categorías/Impuestos/Promociones"): adopta el mismo Workspace unico —
 * un solo contenedor exterior (`rounded-2xl border bg-card shadow-sm`,
 * sin `overflow-hidden` propio), con KPIs/Toolbar/tabla/Paginación como
 * franjas internas separadas por `border-b`/`border-t`, en vez de
 * tarjetas independientes. "Nuevo Proveedor" se muda del `PageHeader` a
 * la Toolbar.
 */
export function SuppliersPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<SupplierFiltersValue>({})

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useSuppliers({ ...filters, page })
  const { mutate: updateSupplierStatus } = useUpdateSupplierStatus()

  const hasActiveFilters = Boolean(filters.search || filters.active !== undefined)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerSupplier, setDrawerSupplier] = useState<Supplier | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleFiltersChange = (nextFilters: SupplierFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  const handleClearFilters = () => handleFiltersChange({})

  // Workspace Proveedores (aprobado): las celdas "Proveedores"/"Activos"/
  // "Inactivos" de `SuppliersKpiRow.tsx` aplican el filtro "Estado" —
  // mismo `handleFiltersChange` que ya usa `SupplierFilters`, sin logica
  // de filtrado nueva. Mismo patron exacto del resto del ERP.
  const handleKpiStatusSelect = (active: boolean | undefined) => {
    handleFiltersChange({ ...filters, active })
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  const { hasPermission } = usePermissions()
  const canCreateSupplier = hasPermission(PERMISSIONS.SUPPLIERS_CREATE)

  const handleCreateSupplier = useCallback(() => {
    navigate('/suppliers/new')
  }, [navigate])

  const handleEdit = (supplier: Supplier) => {
    navigate(`/suppliers/${supplier.id}/edit`)
  }

  const handleRowClick = (supplier: Supplier) => {
    setDrawerSupplier(supplier)
  }

  // Rediseño de Proveedores (aprobado): mismo mecanismo `location.state`
  // ya construido para Categorías/Impuestos — `CreatePurchasePage.tsx`
  // ahora lo lee para preseleccionar el proveedor.
  const handleNewPurchase = (supplier: Supplier) => {
    navigate('/purchases/new', { state: { supplierId: supplier.id } })
  }

  const handleToggleStatus = (supplier: Supplier) => {
    updateSupplierStatus(
      { id: supplier.id, dto: { active: !supplier.active } },
      { onError: (error) => toast.error(getSupplierErrorMessage(error)) },
    )
  }

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((supplier) => selectedIds.includes(supplier.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Nombre', value: (supplier) => supplier.name },
        { header: 'Cédula jurídica', value: (supplier) => supplier.legalId ?? '' },
        { header: 'Contacto', value: (supplier) => supplier.contactName ?? '' },
        { header: 'Teléfono', value: (supplier) => supplier.phone ?? '' },
        { header: 'Correo', value: (supplier) => supplier.email ?? '' },
        { header: 'Estado', value: (supplier) => (supplier.active ? 'Activo' : 'Inactivo') },
      ],
      `proveedores-pagina-${page}.csv`,
    )
  }

  // Mismo patron que `ProductsPage.tsx`/`CategoriesPage.tsx`/`TaxesPage.tsx`:
  // atajos de teclado sin libreria, `Esc` cierra el Drawer gratis via
  // `@base-ui/react/dialog`.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTextField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (!isTextField && !drawerSupplier && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleCreateSupplier()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerSupplier, handleCreateSupplier])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Proveedores' }]}
        title="Proveedores"
        description="Administra los proveedores del sistema."
      />

      {/* Workspace Proveedores (aprobado): KPIs, filtros/acciones, tabla y
          paginación pasan a ser franjas de UNA sola superficie — mismo
          contenedor exacto que Productos/Categorías/Impuestos/Promociones. */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <SuppliersKpiRow activeFilter={filters.active} onSelectActive={handleKpiStatusSelect} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <SupplierFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                searchInputRef={searchInputRef}
              />
            }
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
                <Can permission={PERMISSIONS.SUPPLIERS_CREATE}>
                  <Button
                    type="button"
                    onClick={handleCreateSupplier}
                    className="h-10 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                  >
                    <Plus className="size-4" />
                    Nuevo Proveedor
                    <KbdHint className="border-brand-foreground/30 bg-brand-foreground/15 text-brand-foreground">
                      N
                    </KbdHint>
                  </Button>
                </Can>
              </>
            }
          />
        </div>

        {isLoading && <SuppliersTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar los proveedores.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <SuppliersTable
              suppliers={data?.data ?? []}
              emptyMessage={
                hasActiveFilters ? (
                  <EmptyState
                    icon={Building2}
                    title="Sin resultados para estos filtros"
                    description="Probá ajustar la búsqueda o los filtros seleccionados."
                    action={{ label: 'Limpiar filtros', onClick: handleClearFilters }}
                  />
                ) : (
                  <EmptyState
                    icon={Building2}
                    title="Todavía no hay proveedores"
                    description="Registrá tu primer proveedor para empezar a comprarle."
                    action={
                      canCreateSupplier
                        ? { label: 'Nuevo Proveedor', onClick: handleCreateSupplier, variant: 'brand' }
                        : undefined
                    }
                  />
                )
              }
              onRowClick={handleRowClick}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="proveedores" />
              </div>
            )}
          </div>
        )}
      </div>

      <SupplierDrawer
        supplier={drawerSupplier}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerSupplier(null)
          }
        }}
        onEdit={(supplier) => {
          setDrawerSupplier(null)
          handleEdit(supplier)
        }}
        onNewPurchase={handleNewPurchase}
      />
    </div>
  )
}
