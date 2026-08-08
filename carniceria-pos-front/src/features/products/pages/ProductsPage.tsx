import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Download, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { KbdHint } from '@/components/ui/KbdHint'
import { Pagination } from '@/components/ui/Pagination'
import { PERMISSIONS } from '@/constants/permissions'
import { usePagination } from '@/hooks/usePagination'
import { usePermissions } from '@/hooks/usePermissions'
import { useProducts } from '../hooks/useProducts'
import { useUpdateProductStatus } from '../hooks/useUpdateProductStatus'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { useTaxes } from '@/features/taxes/hooks/useTaxes'
import { ProductDrawer } from '../components/ProductDrawer'
import { ProductsBulkActionsBar } from '../components/ProductsBulkActionsBar'
import { ProductsEmptyState } from '../components/ProductsEmptyState'
import { ProductFilters } from '../components/ProductFilters'
import { ProductsKpiRow } from '../components/ProductsKpiRow'
import { ProductsTable } from '../components/ProductsTable'
import { ProductsTableSkeleton } from '../components/ProductsTableSkeleton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { exportToCsv } from '@/utils/exportToCsv'
import { getProductErrorMessage } from '../utils/productErrors'
import type {
  Product,
  ProductFilters as ProductFiltersValue,
} from '../types/product.types'

const DENSITY_STORAGE_KEY = 'products-table-density'

function getInitialDensity(): 'comfortable' | 'compact' {
  if (typeof window === 'undefined') {
    return 'comfortable'
  }

  return window.localStorage.getItem(DENSITY_STORAGE_KEY) === 'compact' ? 'compact' : 'comfortable'
}

export function ProductsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Rediseño de Categorías (workspace, aprobado): "Ver productos de esta
  // categoría" (`CategoryDrawer.tsx`) navega acá con
  // `navigate('/products', { state: { categoryId } })` — se lee una única
  // vez, al montar, como valor inicial del mismo `ProductFiltersValue` que
  // ya soporta `categoryId` (sin cambio de tipos ni de `useProducts`).
  // Rediseño de Impuestos (aprobado): mismo mecanismo, ampliado para
  // aceptar también `taxId` — "Ver productos con este impuesto"
  // (`TaxDrawer.tsx`) navega con `state: { taxId }`. Quien llega por el
  // menú normal (sin `state`) sigue arrancando con filtros vacíos,
  // exactamente igual que antes.
  const [filters, setFilters] = useState<ProductFiltersValue>(() => {
    const navigationState = location.state as { categoryId?: string; taxId?: string } | null

    if (navigationState?.categoryId) {
      return { categoryId: navigationState.categoryId }
    }

    if (navigationState?.taxId) {
      return { taxId: navigationState.taxId }
    }

    return {}
  })

  // QA-005: sin paginar, el catalogo quedaba capado a los 20 productos mas
  // recientes (default del backend, `orderBy: createdAt desc`) sin ninguna
  // forma de llegar al resto — exactamente lo que ocultaba los productos
  // de carne del seed de demo (los mas antiguos por createdAt). La API ya
  // devuelve `meta.page`/`totalPages`/`hasNext`/`hasPrev`.
  //
  // Arquitectura de listados, Bloque 2: `usePagination`/`Pagination`
  // (`hooks/usePagination.ts`, `components/ui/Pagination.tsx`, Bloque 1)
  // reemplazan el `useState(1)` + botones Anterior/Siguiente que antes
  // vivian aca a mano — mismo comportamiento exacto, sin logica propia.
  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isFetching, isError, error } = useProducts({ ...filters, page })
  const { mutate: updateProductStatus } = useUpdateProductStatus()

  // Sprint UX/UI PIPASA V1, Bloque 7 (pulido final): distingue "0
  // resultados por los filtros activos" de "el catalogo esta vacio" para
  // el estado vacio (`ProductsEmptyState.tsx`) — son situaciones
  // distintas para el usuario, con una accion distinta cada una.
  const hasActiveFilters = Boolean(
    filters.search || filters.categoryId || filters.taxId || filters.active !== undefined,
  )

  // Sprint UX/UI PIPASA V1, Bloque 4: seleccion de filas de la tabla —
  // vive aca (no en `ProductsTable.tsx`) porque `handleExport` la
  // necesita para acotar el CSV a lo seleccionado. IDs de la pagina
  // actual unicamente (`DataTable` no pagina), por eso se limpia en
  // cualquier cambio de filtro/pagina — una seleccion que sobrevive a un
  // cambio de pagina apuntaria a productos que ya no estan en pantalla.
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Rediseño de Workspace (aprobado): densidad de la tabla (miniatura +
  // padding de fila), preferencia puramente de UI persistida en
  // `localStorage` — mismo criterio "sin store nuevo" ya usado por
  // `Sidebar.tsx` (`backoffice-sidebar-collapsed`).
  const [density, setDensity] = useState<'comfortable' | 'compact'>(getInitialDensity)

  useEffect(() => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density)
  }, [density])

  // Sprint UX/UI PIPASA V1, Bloque 5: producto abierto en el Drawer de
  // vista rapida (`ProductDrawer.tsx`). Guarda el objeto `Product`
  // completo (ya cargado en `data`, no un ID a re-consultar) — mismo
  // criterio que `pendingToggle` en `ProductsTable.tsx`.
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)

  // Rediseño de workspace (aprobado): "Anterior"/"Siguiente" dentro del
  // Drawer, acotado a los productos YA CARGADOS de la página actual
  // (`data.data`, el mismo array que ya alimenta la tabla) — sin cruzar
  // de página automáticamente (ver el comentario de `onNavigate` en
  // `ProductDrawer.tsx` sobre por qué eso queda fuera de este bloque).
  const drawerProductIndex = drawerProduct
    ? (data?.data.findIndex((product) => product.id === drawerProduct.id) ?? -1)
    : -1
  const previousDrawerProduct =
    drawerProductIndex > 0 ? (data?.data[drawerProductIndex - 1] ?? null) : null
  const nextDrawerProduct =
    drawerProductIndex !== -1 && drawerProductIndex < (data?.data.length ?? 0) - 1
      ? (data?.data[drawerProductIndex + 1] ?? null)
      : null

  // Bloque Final (auditoria/pulido): ref del input de busqueda del
  // Toolbar — lo enfoca el atajo `Ctrl/Cmd+K` (ver el `useEffect` mas
  // abajo, junto a `handleCreateProduct`).
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cualquier cambio de filtro vuelve a la pagina 1 — una pagina 3 con un
  // filtro nuevo casi seguro no tiene sentido (menos resultados, pagina
  // fuera de rango).
  const handleFiltersChange = (nextFilters: ProductFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
    setSelectedIds([])
  }

  const handleClearFilters = () => handleFiltersChange({})

  // Rediseño de Workspace (aprobado): las celdas "Productos"/"Activos"/
  // "Inactivos" de `ProductsKpiRow.tsx` aplican el filtro "Estado" —
  // mismo `handleFiltersChange` que ya usan el `SegmentedControl` de
  // `ProductFilters` y los chips, sin logica de filtrado nueva.
  const handleKpiStatusSelect = (active: boolean | undefined) => {
    handleFiltersChange({ ...filters, active })
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
    setSelectedIds([])
  }

  // Categorias para poblar el selector de filtro. Independiente del
  // listado de productos (no hay riesgo de auto-reset como en
  // Categories: filtrar productos por categoria no cambia que
  // categorias existen).
  const { data: categoriesResponse } = useCategories({ active: true })
  const categories = (categoriesResponse?.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
  }))

  // Impuestos activos, vía el endpoint ya existente GET /taxes, mismo
  // criterio que categorias — independiente del listado de productos.
  const { data: taxesResponse } = useTaxes({ active: true })
  const taxes = (taxesResponse?.data ?? []).map((tax) => ({
    id: tax.id,
    name: tax.name,
  }))

  // `useCallback` (no una funcion nueva por render): el atajo "N" (mas
  // abajo) la usa como dependencia de un `useEffect` — sin memoizar,
  // ese efecto se re-suscribiria en cada render.
  const { hasPermission } = usePermissions()
  const canCreateProduct = hasPermission(PERMISSIONS.PRODUCTS_CREATE)

  const handleCreateProduct = useCallback(() => {
    navigate('/products/new')
  }, [navigate])

  // Bloque Final (auditoria/pulido): atajos de teclado, mismo patron ya
  // usado en el proyecto (`window.addEventListener('keydown', ...)`
  // dentro de un `useEffect`, sin libreria — ver `SalesPOSPage.tsx`/
  // `PosLayout.tsx`). "Esc" para cerrar el Drawer NO se implementa aca:
  // ya funciona gratis via `@base-ui/react/dialog` (`WorkspacePanel`).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTextField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      // Ctrl/Cmd+K enfoca la busqueda — funciona incluso con el foco en
      // otro campo de texto (patron estandar de "buscar" en ERPs).
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // "N" abre "Nuevo Producto" — nunca si el foco esta en un campo de
      // texto (escribir una "n" en la busqueda no debe navegar), ni con
      // el Drawer abierto (evita una navegacion inesperada mientras se
      // esta revisando un producto).
      if (!isTextField && !drawerProduct && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleCreateProduct()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerProduct, handleCreateProduct])

  const handleEdit = (product: Product) => {
    navigate(`/products/${product.id}/edit`)
  }

  // Click sobre una fila abre el Drawer — la edicion completa sigue
  // siendo una accion explicita (boton dentro del Drawer o "Editar" en
  // el menu de la fila), nunca implicita al hacer click en la fila.
  const handleRowClick = (product: Product) => {
    setDrawerProduct(product)
  }

  const handleToggleStatus = (product: Product) => {
    updateProductStatus(
      { id: product.id, dto: { active: !product.active } },
      { onError: (error) => toast.error(getProductErrorMessage(error)) },
    )
  }

  // Sprint UX/UI PIPASA V1, Bloque 3: exporta la pagina actual (los
  // productos ya cargados en pantalla) — no todo el catalogo, ver
  // justificacion en `exportToCsv.ts`. Bloque 4: si hay filas
  // seleccionadas en la tabla, exporta solo esas — primer uso real de la
  // seleccion de filas (no una capacidad decorativa).
  const handleExport = () => {
    const rowsToExport =
      selectedIds.length > 0
        ? (data?.data ?? []).filter((product) => selectedIds.includes(product.id))
        : (data?.data ?? [])

    exportToCsv(
      rowsToExport,
      [
        { header: 'Nombre', value: (product) => product.name },
        { header: 'SKU', value: (product) => product.sku ?? '' },
        { header: 'Categoría', value: (product) => product.category.name },
        { header: 'Precio de venta', value: (product) => product.salePrice },
        { header: 'Estado', value: (product) => (product.active ? 'Activo' : 'Inactivo') },
      ],
      `productos-pagina-${page}.csv`,
    )
  }

  // Rediseño de Categorías (workspace, aprobado): "mantener una navegación
  // sencilla para regresar a Categorías sin perder el contexto" — cuando
  // se llega con un `categoryId` desde el Drawer, el breadcrumb agrega un
  // paso intermedio hacia `/categories` (mismo `PageHeader`/`Breadcrumb`
  // de siempre, sin componente nuevo). Rediseño de Impuestos (aprobado):
  // mismo criterio para `taxId` -> `/taxes`.
  const navigationOrigin = location.state as { categoryId?: string; taxId?: string } | null
  const originBreadcrumb = navigationOrigin?.categoryId
    ? { label: 'Categorías', href: '/categories' }
    : navigationOrigin?.taxId
      ? { label: 'Impuestos', href: '/taxes' }
      : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={
          originBreadcrumb
            ? [{ label: 'Inicio', href: '/' }, originBreadcrumb, { label: 'Productos' }]
            : [{ label: 'Inicio', href: '/' }, { label: 'Productos' }]
        }
        title="Productos"
        description="Administra el catálogo de productos del sistema."
        action={
          <Can permission={PERMISSIONS.PRODUCTS_CREATE}>
            <Button
              type="button"
              onClick={handleCreateProduct}
              className="h-11 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
            >
              <Plus className="size-4" />
              Nuevo Producto
              <KbdHint className="border-brand-foreground/30 bg-brand-foreground/15 text-brand-foreground">
                N
              </KbdHint>
            </Button>
          </Can>
        }
      />

      {/* Rediseño de Workspace (aprobado, "nuevo estándar visual del ERP"):
          KPIs, filtros/acciones, tabla y paginación pasan a ser franjas de
          UNA sola superficie (borde/sombra propios de esta capa, ninguna
          de las piezas de adentro dibuja los suyos) en vez de 4 tarjetas
          independientes apiladas — reduce el protagonismo visual de los
          KPIs (ahora una franja compacta, `size="xs"`/`bare`, primera del
          Workspace) y deja que la tabla sea el foco principal. Sin
          `overflow-hidden` propio a proposito: `ProductsTable.tsx` activa
          `stickyHeader` (`DataTable`), que necesita que ningun ancestro
          entre el encabezado de la tabla y el verdadero contenedor con
          scroll de la pagina (`DashboardLayout.tsx`) recorte overflow —
          ninguno de los hijos de esta franja pinta un fondo que llegue
          hasta las esquinas redondeadas, asi que no hay artefacto visual
          real por no recortar. */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border/70">
          <ProductsKpiRow activeFilter={filters.active} onSelectActive={handleKpiStatusSelect} />
        </div>

        {selectedIds.length > 0 ? (
          <ProductsBulkActionsBar
            count={selectedIds.length}
            onExport={handleExport}
            onClear={() => setSelectedIds([])}
          />
        ) : (
          <div className="border-b border-border/70 px-4 py-3">
            <Toolbar
              bare
              filters={
                <ProductFilters
                  filters={filters}
                  categories={categories}
                  taxes={taxes}
                  onFiltersChange={handleFiltersChange}
                  searchInputRef={searchInputRef}
                />
              }
              actions={
                <>
                  <SegmentedControl
                    options={[
                      { value: 'comfortable', label: 'Cómoda' },
                      { value: 'compact', label: 'Compacta' },
                    ]}
                    value={density}
                    onChange={(value) => setDensity(value as 'comfortable' | 'compact')}
                  />
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
                </>
              }
            />
          </div>
        )}

        {isLoading && <ProductsTableSkeleton bare />}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar los productos.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div
            className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}
          >
            <ProductsTable
              products={data?.data ?? []}
              emptyMessage={
                <ProductsEmptyState
                  isFiltered={hasActiveFilters}
                  onClearFilters={handleClearFilters}
                  onCreateProduct={canCreateProduct ? handleCreateProduct : undefined}
                />
              }
              onRowClick={handleRowClick}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              density={density}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={handlePageChange} itemLabel="registros" />
              </div>
            )}
          </div>
        )}
      </div>

      <ProductDrawer
        product={drawerProduct}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerProduct(null)
          }
        }}
        onEdit={(product) => {
          setDrawerProduct(null)
          handleEdit(product)
        }}
        onNavigate={setDrawerProduct}
        previousProduct={previousDrawerProduct}
        nextProduct={nextDrawerProduct}
        currentPosition={drawerProductIndex !== -1 ? drawerProductIndex + 1 : undefined}
        totalCount={data?.data.length}
      />
    </div>
  )
}
