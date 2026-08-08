import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Percent, Plus } from 'lucide-react'
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
import { useTaxes } from '../hooks/useTaxes'
import { useUpdateTaxStatus } from '../hooks/useUpdateTaxStatus'
import { TaxDefaultHero } from '../components/TaxDefaultHero'
import { TaxDrawer } from '../components/TaxDrawer'
import { TaxesKpiRow } from '../components/TaxesKpiRow'
import { TaxesTable } from '../components/TaxesTable'
import { TaxesTableSkeleton } from '../components/TaxesTableSkeleton'
import { TaxFilters } from '../components/TaxFilters'
import { exportToCsv } from '@/utils/exportToCsv'
import { getTaxErrorMessage } from '../utils/taxErrors'
import type { Tax, TaxFilters as TaxFiltersValue } from '../types/tax.types'

/**
 * features/taxes/pages/TaxesPage.tsx
 * -----------------------------------------------------------------------------
 * Workspace Impuestos (aprobado, "misma familia visual que Productos/
 * Categorías"): adopta el mismo Workspace unico de `ProductsPage.tsx`/
 * `CategoriesPage.tsx` — un solo contenedor exterior
 * (`rounded-2xl border bg-card shadow-sm`, sin `overflow-hidden` propio),
 * con KPIs/banner de impuesto por defecto/Toolbar/tabla/Paginación como
 * franjas internas separadas por `border-b`/`border-t`, en vez de
 * tarjetas independientes. "Nuevo Impuesto" se muda del `PageHeader` a
 * la Toolbar (mismo criterio ya aplicado en Categorías).
 *
 * Impuestos no tiene el problema de "categoria padre desaparece de su
 * propio selector" que tiene `CategoriesPage.tsx` — sin jerarquia, una
 * sola consulta `useTaxes` alcanza.
 */
export function TaxesPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<TaxFiltersValue>({})

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useTaxes({ ...filters, page })
  const { mutate: updateTaxStatus } = useUpdateTaxStatus()

  const hasActiveFilters = Boolean(
    filters.search || filters.active !== undefined || filters.isDefault !== undefined,
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerTax, setDrawerTax] = useState<Tax | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleFiltersChange = (nextFilters: TaxFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  const handleClearFilters = () => handleFiltersChange({})

  // Workspace Impuestos (aprobado): las celdas "Impuestos"/"Activos"/
  // "Inactivos" de `TaxesKpiRow.tsx` aplican el filtro "Estado" — mismo
  // `handleFiltersChange` que ya usa `TaxFilters`, sin logica de
  // filtrado nueva. Mismo patron exacto que en Productos/Categorías.
  const handleKpiStatusSelect = (active: boolean | undefined) => {
    handleFiltersChange({ ...filters, active })
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  const { hasPermission } = usePermissions()
  const canCreateTax = hasPermission(PERMISSIONS.TAXES_CREATE)

  const handleCreateTax = useCallback(() => {
    navigate('/taxes/new')
  }, [navigate])

  const handleEdit = (tax: Tax) => {
    navigate(`/taxes/${tax.id}/edit`)
  }

  const handleRowClick = (tax: Tax) => {
    setDrawerTax(tax)
  }

  // Rediseño de Impuestos (aprobado): navega a Productos ya filtrado por
  // este impuesto — mismo mecanismo `location.state` ya construido para
  // Categorías (`ProductsPage.tsx` ahora también lee `taxId`).
  const handleViewProducts = (tax: Tax) => {
    navigate('/products', { state: { taxId: tax.id } })
  }

  const handleToggleStatus = (tax: Tax) => {
    updateTaxStatus(
      { id: tax.id, dto: { active: !tax.active } },
      { onError: (error) => toast.error(getTaxErrorMessage(error)) },
    )
  }

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((tax) => selectedIds.includes(tax.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Código', value: (tax) => tax.code },
        { header: 'Nombre', value: (tax) => tax.name },
        { header: 'Tasa', value: (tax) => tax.rate },
        { header: 'Por defecto', value: (tax) => (tax.isDefault ? 'Sí' : 'No') },
        { header: 'Estado', value: (tax) => (tax.active ? 'Activo' : 'Inactivo') },
      ],
      `impuestos-pagina-${page}.csv`,
    )
  }

  // Mismo patron que `ProductsPage.tsx`/`CategoriesPage.tsx`: atajos de
  // teclado sin libreria, `Esc` cierra el Drawer gratis via
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

      if (!isTextField && !drawerTax && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleCreateTax()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerTax, handleCreateTax])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Impuestos' }]}
        title="Impuestos"
        description="Administra los impuestos disponibles para el catálogo de productos."
      />

      {/* Workspace Impuestos (aprobado): KPIs, banner de impuesto por
          defecto, filtros/acciones, tabla y paginación pasan a ser
          franjas de UNA sola superficie — mismo contenedor exacto que
          `ProductsPage.tsx`/`CategoriesPage.tsx`. */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <TaxesKpiRow activeFilter={filters.active} onSelectActive={handleKpiStatusSelect} />
        </div>

        <div className="border-b border-border/70">
          <TaxDefaultHero />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <TaxFilters
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
                <Can permission={PERMISSIONS.TAXES_CREATE}>
                  <Button
                    type="button"
                    onClick={handleCreateTax}
                    className="h-10 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                  >
                    <Plus className="size-4" />
                    Nuevo Impuesto
                    <KbdHint className="border-brand-foreground/30 bg-brand-foreground/15 text-brand-foreground">
                      N
                    </KbdHint>
                  </Button>
                </Can>
              </>
            }
          />
        </div>

        {isLoading && <TaxesTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar los impuestos.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <TaxesTable
              taxes={data?.data ?? []}
              emptyMessage={
                hasActiveFilters ? (
                  <EmptyState
                    icon={Percent}
                    title="Sin resultados para estos filtros"
                    description="Probá ajustar la búsqueda o los filtros seleccionados."
                    action={{ label: 'Limpiar filtros', onClick: handleClearFilters }}
                  />
                ) : (
                  <EmptyState
                    icon={Percent}
                    title="Todavía no hay impuestos"
                    description="Creá tu primer impuesto para empezar a asignarlo a los productos."
                    action={
                      canCreateTax
                        ? { label: 'Nuevo Impuesto', onClick: handleCreateTax, variant: 'brand' }
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
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="impuestos" />
              </div>
            )}
          </div>
        )}
      </div>

      <TaxDrawer
        tax={drawerTax}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerTax(null)
          }
        }}
        onEdit={(tax) => {
          setDrawerTax(null)
          handleEdit(tax)
        }}
        onViewProducts={handleViewProducts}
      />
    </div>
  )
}
