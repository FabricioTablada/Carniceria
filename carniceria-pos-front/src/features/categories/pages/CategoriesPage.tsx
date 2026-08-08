import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, FolderTree, List, Network, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { KbdHint } from '@/components/ui/KbdHint'
import { Pagination } from '@/components/ui/Pagination'
import { PERMISSIONS } from '@/constants/permissions'
import { usePagination } from '@/hooks/usePagination'
import { usePermissions } from '@/hooks/usePermissions'
import { useCategories } from '../hooks/useCategories'
import { useUpdateCategoryStatus } from '../hooks/useUpdateCategoryStatus'
import { CategoriesKpiRow } from '../components/CategoriesKpiRow'
import { CategoriesTable } from '../components/CategoriesTable'
import { CategoriesTableSkeleton } from '../components/CategoriesTableSkeleton'
import { CategoryDrawer } from '../components/CategoryDrawer'
import { CategoryFilters } from '../components/CategoryFilters'
import { CategoryTree } from '../components/CategoryTree'
import { exportToCsv } from '@/utils/exportToCsv'
import { getCategoryErrorMessage } from '../utils/categoryErrors'
import type {
  Category,
  CategoryFilters as CategoryFiltersValue,
} from '../types/category.types'

/** Vista activa del cuerpo principal — alternancia Lista/Árbol (rediseño
 * de Categorías, workspace, aprobado). Persistida solo en memoria (estado
 * local de la página), sin ningún cambio de ruta ni de backend. */
type CategoriesView = 'list' | 'tree'

/**
 * features/categories/pages/CategoriesPage.tsx
 * -----------------------------------------------------------------------------
 * Workspace Categorías (aprobado, "exactamente el mismo lenguaje visual
 * que Productos"): adopta el mismo Workspace unico de `ProductsPage.tsx`
 * — un solo contenedor exterior (`rounded-2xl border bg-card shadow-sm`,
 * sin `overflow-hidden` propio), con KPIs/Toolbar/Lista-Árbol/Paginación
 * como franjas internas separadas por `border-b`/`border-t`, en vez de
 * tarjetas independientes. "Nueva Categoría" se muda del `PageHeader` a
 * la Toolbar — a diferencia de "Nuevo Producto" (que sigue viviendo en
 * `PageHeader.action` en el estandar de referencia), pedido explicito de
 * este bloque para Categorías. Mismo orden de piezas: KPIs → Toolbar
 * (filtros + acciones) → contenido (Lista o Árbol) → Paginación →
 * `CategoryDrawer`.
 *
 * Pulido visual (aprobado, "mismo nivel de calidad que Productos"):
 * `KbdHint` "N" en el boton "Nueva Categoría" — el atajo de teclado ya
 * existia (ver el `useEffect` mas abajo), solo le faltaba la misma pista
 * visual que ya tiene "Nuevo Producto".
 *
 * Diferencia real de este modulo, preservada tal cual: dos consultas
 * `useCategories` independientes — `data` (con filtros/pagina, para la
 * tabla) y `allCategoriesResponse` (sin filtrar, solo para las opciones
 * del selector "Categoría padre" de `CategoryFilters` y para la vista
 * Árbol) — evita el bug ya documentado (filtrar por una categoria padre
 * la hace desaparecer de su propio selector). Esto no existe en
 * Productos y no se toca. La alternancia Lista/Árbol tampoco existe en
 * Productos — ambas vistas viven ahora dentro del mismo Workspace (antes
 * la vista Árbol era una superficie aparte), pero la logica de que datos
 * usa cada una (filtrados vs. completos) no cambia.
 */
export function CategoriesPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<CategoryFiltersValue>({})

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useCategories({ ...filters, page })
  // Rediseño de Categorías (workspace, aprobado): esta consulta ya existia
  // (sin filtrar) solo para el selector "Categoría padre" de
  // `CategoryFilters` — ahora tambien alimenta la vista Árbol
  // (`CategoryTree.tsx`), que necesita el listado COMPLETO para armar la
  // jerarquía real (filtrar dejaría huérfanas a subcategorías cuyo padre
  // no cumple el filtro activo). `limit: 200` (mismo "techo real de una
  // sola página" ya usado en Purchases/Sales/Caja) reemplaza el límite por
  // defecto del backend, que hoy dejaba fuera del selector/árbol a
  // cualquier categoría más allá de la primera página.
  const { data: allCategoriesResponse } = useCategories({ limit: 200 })
  const { mutate: updateCategoryStatus, mutateAsync: updateCategoryStatusAsync } =
    useUpdateCategoryStatus()

  const hasActiveFilters = Boolean(
    filters.search || filters.parentId !== undefined || filters.active !== undefined,
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [drawerCategory, setDrawerCategory] = useState<Category | null>(null)
  const [view, setView] = useState<CategoriesView>('list')
  // Rediseño de Categorías (workspace, aprobado): acciones en lote —
  // `true`/`false` = activar/desactivar las seleccionadas, `null` = ningún
  // pedido pendiente. Reutiliza la MISMA mutación de siempre
  // (`useUpdateCategoryStatus`), un llamado por id seleccionado (mismo
  // criterio que `handleExport` ya usa sobre `selectedIds`) — sin ningún
  // endpoint de lote en el backend.
  const [pendingBulkStatus, setPendingBulkStatus] = useState<boolean | null>(null)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Rediseño de Categorías (workspace, aprobado): mapa id -> Category del
  // mismo listado sin filtrar de arriba, para que "Categoría padre" en el
  // Drawer pueda reabrir el Drawer de esa categoría padre (navegación
  // jerárquica) sin pedir nada nuevo al backend.
  const categoriesById = new Map((allCategoriesResponse?.data ?? []).map((item) => [item.id, item]))

  const handleFiltersChange = (nextFilters: CategoryFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  const handleClearFilters = () => handleFiltersChange({})

  // Workspace Categorías (aprobado): las celdas "Categorías"/"Activas"/
  // "Inactivas" de `CategoriesKpiRow.tsx` aplican el filtro "Estado" —
  // mismo `handleFiltersChange` que ya usa `CategoryFilters`, sin logica
  // de filtrado nueva. Mismo patron exacto que `handleKpiStatusSelect` en
  // `ProductsPage.tsx`.
  const handleKpiStatusSelect = (active: boolean | undefined) => {
    handleFiltersChange({ ...filters, active })
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  const { hasPermission } = usePermissions()
  const canCreateCategory = hasPermission(PERMISSIONS.CATEGORIES_CREATE)

  const handleCreateCategory = useCallback(() => {
    navigate('/categories/new')
  }, [navigate])

  const handleEdit = (category: Category) => {
    navigate(`/categories/${category.id}/edit`)
  }

  const handleRowClick = (category: Category) => {
    setDrawerCategory(category)
  }

  const handleToggleStatus = (category: Category) => {
    updateCategoryStatus(
      { id: category.id, dto: { active: !category.active } },
      { onError: (error) => toast.error(getCategoryErrorMessage(error)) },
    )
  }

  // Rediseño de Categorías (workspace, aprobado): navega a Productos ya
  // filtrado por esta categoría — reutiliza `ProductFilters.categoryId`
  // (ya soportado) via `location.state`, que `ProductsPage.tsx` ahora lee
  // al montar (único ajuste fuera de este módulo, aditivo). `navigate`
  // sin `replace`: el usuario vuelve a Categorías con el botón "atrás" del
  // navegador, sin perder el contexto de la lista/árbol en el que estaba.
  const handleViewProducts = (category: Category) => {
    navigate('/products', { state: { categoryId: category.id } })
  }

  // Rediseño de Categorías (workspace, aprobado): navegación jerárquica
  // del Drawer — "sube" al padre reabriendo el mismo Drawer con la
  // categoría ya cargada en `categoriesById` (mismo listado sin filtrar
  // de arriba), sin ninguna consulta nueva.
  const handleNavigateToParent = (parentId: string) => {
    const parent = categoriesById.get(parentId)

    if (parent) {
      setDrawerCategory(parent)
    }
  }

  const handleBulkStatusClick = (active: boolean) => setPendingBulkStatus(active)

  const handleConfirmBulkStatus = async () => {
    if (pendingBulkStatus === null) {
      return
    }

    setIsBulkUpdating(true)

    try {
      await Promise.all(
        selectedIds.map((id) => updateCategoryStatusAsync({ id, dto: { active: pendingBulkStatus } })),
      )
      toast.success(
        pendingBulkStatus
          ? `${selectedIds.length} categoría${selectedIds.length === 1 ? '' : 's'} activada${selectedIds.length === 1 ? '' : 's'}.`
          : `${selectedIds.length} categoría${selectedIds.length === 1 ? '' : 's'} desactivada${selectedIds.length === 1 ? '' : 's'}.`,
      )
      setSelectedIds([])
    } catch (error) {
      toast.error(getCategoryErrorMessage(error))
    } finally {
      setIsBulkUpdating(false)
      setPendingBulkStatus(null)
    }
  }

  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((category) => selectedIds.includes(category.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Nombre', value: (category) => category.name },
        { header: 'Descripción', value: (category) => category.description ?? '' },
        { header: 'Categoría padre', value: (category) => category.parent?.name ?? '' },
        { header: 'Estado', value: (category) => (category.active ? 'Activo' : 'Inactivo') },
      ],
      `categorias-pagina-${page}.csv`,
    )
  }

  // Mismo patron que `ProductsPage.tsx`: atajos de teclado sin libreria,
  // `Esc` cierra el Drawer gratis via `@base-ui/react/dialog`.
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

      if (!isTextField && !drawerCategory && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleCreateCategory()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerCategory, handleCreateCategory])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Categorías' }]}
        title="Categorías"
        description="Administra las categorías del catálogo de productos."
      />

      {/* Workspace Categorías (aprobado, "exactamente el mismo lenguaje
          visual que Productos"): KPIs, filtros/acciones, contenido
          (Lista o Árbol) y paginación pasan a ser franjas de UNA sola
          superficie en vez de tarjetas independientes apiladas — mismo
          contenedor exacto que `ProductsPage.tsx`
          (`rounded-2xl border bg-card shadow-sm`, sin `overflow-hidden`
          propio). */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <CategoriesKpiRow activeFilter={filters.active} onSelectActive={handleKpiStatusSelect} />
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <CategoryFilters
                filters={filters}
                categories={allCategoriesResponse?.data ?? []}
                onFiltersChange={handleFiltersChange}
                searchInputRef={searchInputRef}
              />
            }
            actions={
              <>
                {/* Rediseño de Categorías (workspace, aprobado): alternancia
                    Lista/Árbol — mismos datos en ambas vistas, solo cambia la
                    presentación (agrupada por parentId en Árbol). */}
                <div className="flex h-10 items-center rounded-xl border border-border bg-card p-1">
                  <Button
                    type="button"
                    variant={view === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setView('list')}
                    className={cn('h-8 gap-1.5 rounded-lg px-3', view === 'list' && 'bg-brand text-brand-foreground hover:bg-brand-hover')}
                  >
                    <List className="size-3.5" />
                    Lista
                  </Button>
                  <Button
                    type="button"
                    variant={view === 'tree' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setView('tree')}
                    className={cn('h-8 gap-1.5 rounded-lg px-3', view === 'tree' && 'bg-brand text-brand-foreground hover:bg-brand-hover')}
                  >
                    <Network className="size-3.5" />
                    Árbol
                  </Button>
                </div>

                {/* Rediseño de Categorías (workspace, aprobado): acciones en
                    lote — solo visibles con selección activa, reutilizando la
                    misma mutación de activar/desactivar de siempre. */}
                {selectedIds.length > 0 && (
                  <Can permission={PERMISSIONS.CATEGORIES_UPDATE}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleBulkStatusClick(true)}
                      className="h-10 gap-2 rounded-xl"
                    >
                      Activar ({selectedIds.length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleBulkStatusClick(false)}
                      className="h-10 gap-2 rounded-xl"
                    >
                      Desactivar ({selectedIds.length})
                    </Button>
                  </Can>
                )}

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
                <Can permission={PERMISSIONS.CATEGORIES_CREATE}>
                  <Button
                    type="button"
                    onClick={handleCreateCategory}
                    className="h-10 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                  >
                    <Plus className="size-4" />
                    Nueva Categoría
                    <KbdHint className="border-brand-foreground/30 bg-brand-foreground/15 text-brand-foreground">
                      N
                    </KbdHint>
                  </Button>
                </Can>
              </>
            }
          />
        </div>

        {isLoading && <CategoriesTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar las categorías.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && view === 'list' && (
          <div
            className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}
          >
            <CategoriesTable
              categories={data?.data ?? []}
              emptyMessage={
                hasActiveFilters ? (
                  <EmptyState
                    icon={FolderTree}
                    title="Sin resultados para estos filtros"
                    description="Probá ajustar la búsqueda o los filtros seleccionados."
                    action={{ label: 'Limpiar filtros', onClick: handleClearFilters }}
                  />
                ) : (
                  <EmptyState
                    icon={FolderTree}
                    title="Todavía no hay categorías"
                    description="Creá tu primera categoría para empezar a organizar el catálogo."
                    action={
                      canCreateCategory
                        ? { label: 'Nueva Categoría', onClick: handleCreateCategory, variant: 'brand' }
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
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="categorías" />
              </div>
            )}
          </div>
        )}

        {/* Rediseño de Categorías (workspace, aprobado): la vista Árbol usa
            SIEMPRE el listado completo sin filtrar (`allCategoriesResponse`,
            ver comentario de arriba) — los filtros de la Toolbar (búsqueda/
            categoría padre/estado) no se aplican acá a propósito: recortar
            el árbol por esos filtros dejaría huérfanas a subcategorías cuyo
            padre no los cumple, rompiendo la jerarquía que esta vista existe
            para mostrar. Vive dentro del mismo Workspace que la vista Lista
            (antes era una superficie flotante aparte) — alternar entre
            ambas ya no se siente como cambiar de pantalla. */}
        {!isLoading && !isError && view === 'tree' && (
          <div className="p-4">
            <CategoryTree
              categories={allCategoriesResponse?.data ?? []}
              onRowClick={handleRowClick}
              bare
              emptyMessage={
                <EmptyState
                  icon={FolderTree}
                  title="Todavía no hay categorías"
                  description="Creá tu primera categoría para empezar a organizar el catálogo."
                  action={
                    canCreateCategory
                      ? { label: 'Nueva Categoría', onClick: handleCreateCategory, variant: 'brand' }
                      : undefined
                  }
                />
              }
            />
          </div>
        )}
      </div>

      <CategoryDrawer
        category={drawerCategory}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerCategory(null)
          }
        }}
        onEdit={(category) => {
          setDrawerCategory(null)
          handleEdit(category)
        }}
        onViewProducts={handleViewProducts}
        onNavigateToParent={handleNavigateToParent}
      />

      <ConfirmDialog
        open={pendingBulkStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingBulkStatus(null)
          }
        }}
        title={pendingBulkStatus ? 'Activar categorías' : 'Desactivar categorías'}
        description={`¿Seguro que querés ${pendingBulkStatus ? 'activar' : 'desactivar'} ${selectedIds.length} categoría${selectedIds.length === 1 ? '' : 's'} seleccionada${selectedIds.length === 1 ? '' : 's'}?`}
        confirmText={pendingBulkStatus ? 'Activar' : 'Desactivar'}
        cancelText="Cancelar"
        loading={isBulkUpdating}
        onConfirm={handleConfirmBulkStatus}
      />
    </div>
  )
}
