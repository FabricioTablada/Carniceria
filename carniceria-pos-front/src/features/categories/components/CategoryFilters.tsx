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
import type { CategoryFilters as CategoryFiltersValue } from '../types/category.types'
import { FilterBar } from '@/components/common/FilterBar'

interface SelectOption {
  id: string
  name: string
}

interface CategoryFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: CategoryFiltersValue
  /** Opciones para el selector de categoria padre. */
  categories?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: CategoryFiltersValue) => void
  /** Ref opcional del input de busqueda — permite que `CategoriesPage.tsx`
   * lo enfoque con el atajo `Ctrl/Cmd+K`, mismo patron que
   * `ProductFilters.tsx`. */
  searchInputRef?: Ref<HTMLInputElement>
}

/** Valor reservado para filtrar por categorias raiz (parentId: null). */
const ROOT_OPTION_VALUE = '__root__'

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Inactivos',
}

/**
 * features/categories/components/CategoryFilters.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos (`ProductFilters.tsx`): ya
 * no dibuja su propio contenedor con borde — ahora vive dentro de
 * `Toolbar.tsx` (`components/common/`), que es quien dibuja el borde/
 * tarjeta de la barra completa. Mismos 3 campos, misma logica de
 * filtrado — cero cambio de comportamiento, solo de quien dibuja el
 * borde exterior. `searchInputRef` + `KbdHint` "Ctrl K": mismo criterio
 * que `ProductFilters.tsx`.
 *
 * Pulido visual (aprobado): la opción raíz del selector "Categoría padre"
 * pasa de "Sin categoría padre (raíz)" a "Sin categoría padre" — se lee
 * como un placeholder natural en vez de un valor técnico. Mismo
 * `ROOT_OPTION_VALUE` centinela, mismo comportamiento de filtrado.
 */
export function CategoryFilters({
  filters,
  categories = [],
  onFiltersChange,
  searchInputRef,
}: CategoryFiltersProps) {
  return (
    <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="category-filters-search"
            className="text-xs font-semibold text-muted-foreground"
          >
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="category-filters-search"
              ref={searchInputRef}
              placeholder="Nombre de la categoría"
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
            htmlFor="category-filters-parent"
            className="text-xs font-semibold text-muted-foreground"
          >
            Categoría padre
          </Label>
          <Select
            value={
              filters.parentId === null
                ? ROOT_OPTION_VALUE
                : (filters.parentId ?? '')
            }
            onValueChange={(value: unknown) => {
              const parent = value as string

              onFiltersChange({
                ...filters,
                parentId:
                  parent === ''
                    ? undefined
                    : parent === ROOT_OPTION_VALUE
                      ? null
                      : parent,
              })
            }}
          >
            <SelectTrigger
              id="category-filters-parent"
              className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
            >
              {/*
                @base-ui/react Select.Value no deriva el label de los
                Select.Item renderizados. Se resuelve manualmente, incluyendo
                el valor centinela ROOT_OPTION_VALUE.
              */}
              <SelectValue>
                {(value: unknown) => {
                  const parent = value as string
                  if (parent === '') return 'Todas las categorías'
                  if (parent === ROOT_OPTION_VALUE)
                    return 'Sin categoría padre'
                  return (
                    categories.find((category) => category.id === parent)
                      ?.name ?? parent
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las categorías</SelectItem>
              <SelectItem value={ROOT_OPTION_VALUE}>
                Sin categoría padre
              </SelectItem>
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
            htmlFor="category-filters-status"
            className="text-xs font-semibold text-muted-foreground"
          >
            Estado
          </Label>
          <Select
            value={
              filters.active === undefined
                ? 'all'
                : filters.active
                  ? 'active'
                  : 'inactive'
            }
            onValueChange={(value: unknown) => {
              const status = value as string

              onFiltersChange({
                ...filters,
                active: status === 'all' ? undefined : status === 'active',
              })
            }}
          >
            <SelectTrigger
              id="category-filters-status"
              className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
            >
              <SelectValue>
                {(value: unknown) => STATUS_LABELS[value as string] ?? 'Todos'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
    </FilterBar>
  )
}