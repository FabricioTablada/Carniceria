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
import type { SupplierFilters as SupplierFiltersValue } from '../types/supplier.types'
import { FilterBar } from '@/components/common/FilterBar'

interface SupplierFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: SupplierFiltersValue
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: SupplierFiltersValue) => void
  /** Ref opcional del input de busqueda — permite que `SuppliersPage.tsx`
   * lo enfoque con el atajo `Ctrl/Cmd+K`, mismo patron que el resto de
   * los modulos del sprint. */
  searchInputRef?: Ref<HTMLInputElement>
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Inactivos',
}

/**
 * features/suppliers/components/SupplierFilters.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar visual de Productos/Categorias/Impuestos: ya no
 * dibuja su propio contenedor con borde — ahora vive dentro de
 * `Toolbar.tsx`. Mismos 2 campos, misma logica de filtrado. `searchInputRef`
 * + `KbdHint` "Ctrl K": mismo criterio.
 */
export function SupplierFilters({
  filters,
  onFiltersChange,
  searchInputRef,
}: SupplierFiltersProps) {
  return (
    <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="supplier-filters-search"
            className="text-xs font-semibold text-muted-foreground"
          >
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="supplier-filters-search"
              ref={searchInputRef}
              placeholder="Nombre del proveedor"
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
            htmlFor="supplier-filters-status"
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
              id="supplier-filters-status"
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