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
import type { TaxFilters as TaxFiltersValue } from '../types/tax.types'
import { FilterBar } from '@/components/common/FilterBar'

interface TaxFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: TaxFiltersValue
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: TaxFiltersValue) => void
  /** Ref opcional del input de busqueda — permite que `TaxesPage.tsx` lo
   * enfoque con el atajo `Ctrl/Cmd+K`, mismo patron que
   * `ProductFilters.tsx`/`CategoryFilters.tsx`. */
  searchInputRef?: Ref<HTMLInputElement>
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Inactivos',
}

const DEFAULT_LABELS: Record<string, string> = {
  all: 'Todos',
  default: 'Por defecto',
  'non-default': 'No por defecto',
}

/**
 * features/taxes/components/TaxFilters.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos/Categorias: ya no dibuja su
 * propio contenedor con borde — ahora vive dentro de `Toolbar.tsx`.
 * Mismos 3 campos, misma logica de filtrado — cero cambio de
 * comportamiento. `searchInputRef` + `KbdHint` "Ctrl K": mismo criterio.
 */
export function TaxFilters({ filters, onFiltersChange, searchInputRef }: TaxFiltersProps) {
  return (
    <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="tax-filters-search"
            className="text-xs font-semibold text-muted-foreground"
          >
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tax-filters-search"
              ref={searchInputRef}
              placeholder="Nombre o código del impuesto"
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
            htmlFor="tax-filters-status"
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
            <SelectTrigger id="tax-filters-status" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
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

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="tax-filters-default"
            className="text-xs font-semibold text-muted-foreground"
          >
            Por defecto
          </Label>
          <Select
            value={
              filters.isDefault === undefined
                ? 'all'
                : filters.isDefault
                  ? 'default'
                  : 'non-default'
            }
            onValueChange={(value: unknown) => {
              const isDefault = value as string

              onFiltersChange({
                ...filters,
                isDefault:
                  isDefault === 'all' ? undefined : isDefault === 'default',
              })
            }}
          >
            <SelectTrigger id="tax-filters-default" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              <SelectValue>
                {(value: unknown) => DEFAULT_LABELS[value as string] ?? 'Todos'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="default">Por defecto</SelectItem>
              <SelectItem value="non-default">No por defecto</SelectItem>
            </SelectContent>
          </Select>
        </div>
    </FilterBar>
  )
}