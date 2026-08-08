import type { Ref } from 'react'
import { Search } from 'lucide-react'
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
import { FilterBar } from '@/components/common/FilterBar'
import type { PromotionFilters as PromotionFiltersValue } from '../types/promotion.types'

interface PromotionFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: PromotionFiltersValue
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: PromotionFiltersValue) => void
  /** Ref opcional del input de busqueda — permite que `PromotionsPage.tsx`
   * lo enfoque con el atajo `Ctrl/Cmd+K`, mismo patron que el resto de
   * los modulos del sprint. */
  searchInputRef?: Ref<HTMLInputElement>
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Activas',
  inactive: 'Inactivas',
}

const SCOPE_LABELS: Record<string, string> = {
  all: 'Todos',
  PRODUCT: 'Producto',
  CATEGORY: 'Categoría',
  COMBO: 'Combo',
  CART: 'Carrito completo',
}

/**
 * features/promotions/components/PromotionFilters.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos/Categorias/Impuestos/
 * Proveedores — ya no dibuja su propio contenedor con borde, vive dentro
 * de `Toolbar.tsx`. `searchInputRef` + `KbdHint` "Ctrl K": mismo criterio.
 */
export function PromotionFilters({
  filters,
  onFiltersChange,
  searchInputRef,
}: PromotionFiltersProps) {
  return (
    <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="promotion-filters-search"
            className="text-xs font-semibold text-muted-foreground"
          >
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="promotion-filters-search"
              ref={searchInputRef}
              placeholder="Nombre de la promoción"
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
            htmlFor="promotion-filters-status"
            className="text-xs font-semibold text-muted-foreground"
          >
            Estado
          </Label>
          <Select
            value={filters.active === undefined ? 'all' : filters.active ? 'active' : 'inactive'}
            onValueChange={(value: unknown) => {
              const status = value as string

              onFiltersChange({
                ...filters,
                active: status === 'all' ? undefined : status === 'active',
              })
            }}
          >
            <SelectTrigger
              id="promotion-filters-status"
              className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
            >
              <SelectValue>{(value: unknown) => STATUS_LABELS[value as string] ?? 'Todos'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="inactive">Inactivas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="promotion-filters-scope"
            className="text-xs font-semibold text-muted-foreground"
          >
            Alcance
          </Label>
          <Select
            value={filters.scopeType ?? 'all'}
            onValueChange={(value: unknown) => {
              const scope = value as string

              onFiltersChange({
                ...filters,
                scopeType:
                  scope === 'all' ? undefined : (scope as PromotionFiltersValue['scopeType']),
              })
            }}
          >
            <SelectTrigger
              id="promotion-filters-scope"
              className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
            >
              <SelectValue>{(value: unknown) => SCOPE_LABELS[value as string] ?? 'Todos'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PRODUCT">Producto</SelectItem>
              <SelectItem value="CATEGORY">Categoría</SelectItem>
              <SelectItem value="COMBO">Combo</SelectItem>
              <SelectItem value="CART">Carrito completo</SelectItem>
            </SelectContent>
          </Select>
        </div>
    </FilterBar>
  )
}
