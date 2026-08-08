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
import { usePromotions } from '../hooks/usePromotions'
import { useUpdatePromotionStatus } from '../hooks/useUpdatePromotionStatus'
import { PromotionDrawer } from '../components/PromotionDrawer'
import { PromotionsKpiRow } from '../components/PromotionsKpiRow'
import { PromotionsTable } from '../components/PromotionsTable'
import { PromotionsTableSkeleton } from '../components/PromotionsTableSkeleton'
import { PromotionFilters } from '../components/PromotionFilters'
import { exportToCsv } from '@/utils/exportToCsv'
import { buildScopePhrase } from '../utils/promotionNarrative'
import { getPromotionErrorMessage } from '../utils/promotionErrors'
import type { Promotion, PromotionFilters as PromotionFiltersValue } from '../types/promotion.types'

const SCOPE_TYPE_LABELS: Record<Promotion['scopeType'], string> = {
  PRODUCT: 'Producto',
  CATEGORY: 'Categoría',
  COMBO: 'Combo',
  CART: 'Carrito completo',
}

const EFFECT_TYPE_LABELS: Record<Promotion['effectType'], string> = {
  PERCENTAGE: 'Porcentaje',
  FIXED_AMOUNT: 'Monto fijo',
  SPECIAL_PRICE: 'Precio especial',
  FIXED_PRICE: 'Precio fijo',
  BUY_X_PAY_Y: 'Compre N pague M',
}

/**
 * features/promotions/pages/PromotionsPage.tsx
 * -----------------------------------------------------------------------------
 * Workspace Promociones (aprobado, "mismo Design System que Productos/
 * Categorías/Impuestos"): adopta el mismo Workspace unico de
 * `ProductsPage.tsx`/`CategoriesPage.tsx`/`TaxesPage.tsx` — un solo
 * contenedor exterior (`rounded-2xl border bg-card shadow-sm`, sin
 * `overflow-hidden` propio), con KPIs/Toolbar/tabla/Paginación como
 * franjas internas separadas por `border-b`/`border-t`, en vez de
 * tarjetas independientes. "Nueva Promoción" se muda del `PageHeader` a
 * la Toolbar.
 */
export function PromotionsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<PromotionFiltersValue>({})

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = usePromotions({ ...filters, page })
  const { mutate: updatePromotionStatus } = useUpdatePromotionStatus()

  const hasActiveFilters = Boolean(
    filters.search || filters.active !== undefined || filters.scopeType !== undefined,
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerPromotion, setDrawerPromotion] = useState<Promotion | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleFiltersChange = (nextFilters: PromotionFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  const handleClearFilters = () => handleFiltersChange({})

  // Workspace Promociones (aprobado): las celdas "Promociones"/"Activas"/
  // "Inactivas" de `PromotionsKpiRow.tsx` aplican el filtro "Estado" —
  // mismo `handleFiltersChange` que ya usa `PromotionFilters`, sin logica
  // de filtrado nueva. Mismo patron exacto que Productos/Categorías/
  // Impuestos.
  const handleKpiStatusSelect = (active: boolean | undefined) => {
    handleFiltersChange({ ...filters, active })
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  const { hasPermission } = usePermissions()
  const canCreatePromotion = hasPermission(PERMISSIONS.PROMOTIONS_CREATE)

  const handleCreatePromotion = useCallback(() => {
    navigate('/promotions/new')
  }, [navigate])

  const handleEdit = (promotion: Promotion) => {
    navigate(`/promotions/${promotion.id}/edit`)
  }

  const handleRowClick = (promotion: Promotion) => {
    setDrawerPromotion(promotion)
  }

  const handleToggleStatus = (promotion: Promotion) => {
    updatePromotionStatus(
      { id: promotion.id, dto: { active: !promotion.active } },
      { onError: (error) => toast.error(getPromotionErrorMessage(error)) },
    )
  }

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((promotion) => selectedIds.includes(promotion.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Nombre', value: (promotion) => promotion.name },
        { header: 'Alcance', value: (promotion) => SCOPE_TYPE_LABELS[promotion.scopeType] },
        {
          header: 'Aplica a',
          value: (promotion) =>
            buildScopePhrase({
              scopeType: promotion.scopeType,
              selectedNames:
                promotion.scopeType === 'CATEGORY'
                  ? promotion.categories.map((item) => item.category.name)
                  : promotion.products.map((item) => item.product.name),
            }),
        },
        { header: 'Beneficio', value: (promotion) => EFFECT_TYPE_LABELS[promotion.effectType] },
        { header: 'Estado', value: (promotion) => (promotion.active ? 'Activa' : 'Inactiva') },
      ],
      `promociones-pagina-${page}.csv`,
    )
  }

  // Mismo patron que ProductsPage.tsx/CategoriesPage.tsx/TaxesPage.tsx/
  // SuppliersPage.tsx: atajos de teclado sin libreria, `Esc` cierra el
  // Drawer gratis via `@base-ui/react/dialog`.
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

      if (!isTextField && !drawerPromotion && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleCreatePromotion()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerPromotion, handleCreatePromotion])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Promociones' }]}
        title="Promociones"
        description="Administra el catálogo de promociones y descuentos del ERP."
      />

      {/* Workspace Promociones (aprobado): KPIs, filtros/acciones, tabla y
          paginación pasan a ser franjas de UNA sola superficie — mismo
          contenedor exacto que Productos/Categorías/Impuestos. */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <PromotionsKpiRow activeFilter={filters.active} onSelectActive={handleKpiStatusSelect} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <PromotionFilters
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
                <Can permission={PERMISSIONS.PROMOTIONS_CREATE}>
                  <Button
                    type="button"
                    onClick={handleCreatePromotion}
                    className="h-10 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                  >
                    <Plus className="size-4" />
                    Nueva Promoción
                    <KbdHint className="border-brand-foreground/30 bg-brand-foreground/15 text-brand-foreground">
                      N
                    </KbdHint>
                  </Button>
                </Can>
              </>
            }
          />
        </div>

        {isLoading && <PromotionsTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar las promociones.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <PromotionsTable
              promotions={data?.data ?? []}
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
                    title="Todavía no hay promociones"
                    description="Creá tu primera promoción para empezar a ofrecer descuentos."
                    action={
                      canCreatePromotion
                        ? { label: 'Nueva Promoción', onClick: handleCreatePromotion, variant: 'brand' }
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
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="promociones" />
              </div>
            )}
          </div>
        )}
      </div>

      <PromotionDrawer
        promotion={drawerPromotion}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerPromotion(null)
          }
        }}
        onEdit={(promotion) => {
          setDrawerPromotion(null)
          handleEdit(promotion)
        }}
      />
    </div>
  )
}
