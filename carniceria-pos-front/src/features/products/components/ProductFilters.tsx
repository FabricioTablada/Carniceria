import type { ReactNode, Ref } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { KbdHint } from '@/components/ui/KbdHint'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { ProductFilters as ProductFiltersValue } from '../types/product.types'
import { Badge } from '@/components/common/Badge'
import { FilterBar } from '@/components/common/FilterBar'

interface SelectOption {
  id: string
  name: string
}

interface ProductFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: ProductFiltersValue
  /** Opciones para el selector de categoria. */
  categories?: SelectOption[]
  /** Opciones para el selector de impuesto. */
  taxes?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: ProductFiltersValue) => void
  /** Bloque Final: ref opcional del input de busqueda — permite que
   * `ProductsPage.tsx` lo enfoque con el atajo `Ctrl/Cmd+K`, mismo
   * patron ya usado en `SalesPOSPage.tsx` (`searchInputRef`). */
  searchInputRef?: Ref<HTMLInputElement>
}

function FilterChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <Badge variant="muted" className="gap-1.5 py-1 pr-1.5 font-medium">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar filtro"
        className="flex size-3.5 items-center justify-center rounded-full hover:bg-foreground/10"
      >
        <X className="size-2.5" />
      </button>
    </Badge>
  )
}

/**
 * features/products/components/ProductFilters.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 3: ya no dibuja su propio contenedor con
 * borde (`border-b`) — ahora vive dentro de `Toolbar.tsx`
 * (`components/common/`), que es quien dibuja el borde/tarjeta de la
 * barra completa. Mismos 4 campos, mismos nombres, misma logica de
 * filtrado — cero cambio de comportamiento, solo de quien dibuja el
 * borde exterior.
 *
 * Bloque Final: `searchInputRef` (opcional) + `KbdHint` "Ctrl K" dentro
 * del propio input de busqueda — hace visible el atajo de teclado
 * cableado en `ProductsPage.tsx`. Puramente decorativo (`KbdHint` no
 * registra ningun listener), el atajo real vive donde ya vive toda la
 * logica de la pagina.
 *
 * Rediseño de workspace (aprobado): "Estado" pasa de `Select` a
 * `SegmentedControl` (`components/ui/`, ya existente — usado hoy en
 * `CartDiscount.tsx` — genérico, sin tokens exclusivos del POS) para la
 * decisión mas frecuente del toolbar en un solo click. Se agrega una fila
 * de chips de filtros activos (reutiliza `Badge`) + "Limpiar todo",
 * visible siempre que haya al menos un filtro aplicado — antes esa accion
 * solo existia dentro del estado vacio (`ProductsEmptyState.tsx`, sin
 * cambios). Cada chip llama a `onFiltersChange` con ese campo en
 * `undefined` — mismo callback que ya dispara `handleFiltersChange` en
 * `ProductsPage.tsx` (resetea la pagina), sin logica nueva.
 */
export function ProductFilters({
  filters,
  categories = [],
  taxes = [],
  onFiltersChange,
  searchInputRef,
}: ProductFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.search || filters.categoryId || filters.taxId || filters.active !== undefined,
  )

  return (
    <>
      <FilterBar>
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="product-filters-search"
          className="text-xs font-semibold text-muted-foreground"
        >
          Buscar
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="product-filters-search"
            ref={searchInputRef}
            placeholder="Nombre del producto"
            value={filters.search ?? ''}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                search: event.target.value || undefined,
              })
            }
            className="h-10 w-64 rounded-xl border-transparent bg-card pr-14 pl-9 shadow-sm transition-shadow duration-200 hover:shadow-md"
          />
          <KbdHint className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
            Ctrl K
          </KbdHint>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="product-filters-category"
          className="text-xs font-semibold text-muted-foreground"
        >
          Categoría
        </Label>
        <Select
          value={filters.categoryId ?? ''}
          onValueChange={(value: unknown) => {
            const categoryId = value as string

            onFiltersChange({
              ...filters,
              categoryId: categoryId || undefined,
            })
          }}
        >
          <SelectTrigger
            id="product-filters-category"
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          >
            {/*
              @base-ui/react Select.Value no deriva el label de los
              Select.Item renderizados. Se resuelve manualmente buscando
              en `categories`.
            */}
            <SelectValue>
              {(value: unknown) => {
                const categoryId = value as string
                if (!categoryId) return 'Todas las categorías'
                return (
                  categories.find((category) => category.id === categoryId)
                    ?.name ?? categoryId
                )
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las categorías</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="product-filters-tax"
          className="text-xs font-semibold text-muted-foreground"
        >
          Impuesto
        </Label>
        <Select
          value={filters.taxId ?? ''}
          onValueChange={(value: unknown) => {
            const taxId = value as string

            onFiltersChange({
              ...filters,
              taxId: taxId || undefined,
            })
          }}
        >
          <SelectTrigger
            id="product-filters-tax"
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          >
            <SelectValue>
              {(value: unknown) => {
                const taxId = value as string
                if (!taxId) return 'Todos los impuestos'
                return taxes.find((tax) => tax.id === taxId)?.name ?? taxId
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los impuestos</SelectItem>
            {taxes.map((tax) => (
              <SelectItem key={tax.id} value={tax.id}>
                {tax.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Estado</Label>
        <SegmentedControl
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
          ]}
          value={
            filters.active === undefined
              ? 'all'
              : filters.active
                ? 'active'
                : 'inactive'
          }
          onChange={(status) => {
            onFiltersChange({
              ...filters,
              active: status === 'all' ? undefined : status === 'active',
            })
          }}
        />
      </div>
      </FilterBar>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-3">
        <span className="text-xs font-semibold text-muted-foreground">Filtrando por:</span>

        {filters.search && (
          <FilterChip onRemove={() => onFiltersChange({ ...filters, search: undefined })}>
            Búsqueda: "{filters.search}"
          </FilterChip>
        )}
        {filters.categoryId && (
          <FilterChip onRemove={() => onFiltersChange({ ...filters, categoryId: undefined })}>
            Categoría: {categories.find((category) => category.id === filters.categoryId)?.name ?? filters.categoryId}
          </FilterChip>
        )}
        {filters.taxId && (
          <FilterChip onRemove={() => onFiltersChange({ ...filters, taxId: undefined })}>
            Impuesto: {taxes.find((tax) => tax.id === filters.taxId)?.name ?? filters.taxId}
          </FilterChip>
        )}
        {filters.active !== undefined && (
          <FilterChip onRemove={() => onFiltersChange({ ...filters, active: undefined })}>
            Estado: {filters.active ? 'Activos' : 'Inactivos'}
          </FilterChip>
        )}

        <button
          type="button"
          onClick={() => onFiltersChange({})}
          className="text-xs font-semibold text-brand underline underline-offset-2 hover:no-underline"
        >
          Limpiar todo
        </button>
      </div>
    )}
    </>
  )
}
