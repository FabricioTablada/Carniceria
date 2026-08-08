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
import type { CustomerFilters as CustomerFiltersValue } from '../types/customer.types'
import { FilterBar } from '@/components/common/FilterBar'

interface CustomerFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: CustomerFiltersValue
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: CustomerFiltersValue) => void
  /** Ref opcional del input de busqueda — permite que `CustomersPage.tsx`
   * lo enfoque con el atajo `Ctrl/Cmd+K`, mismo patron que el resto de
   * los modulos. */
  searchInputRef?: Ref<HTMLInputElement>
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Inactivos',
}

/**
 * features/customers/components/CustomerFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque 8.2 — mismo patron exacto que `SupplierFilters.tsx`: 2 campos
 * (búsqueda + estado), vive dentro de `Toolbar.tsx`.
 */
export function CustomerFilters({ filters, onFiltersChange, searchInputRef }: CustomerFiltersProps) {
  return (
    <FilterBar>
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="customer-filters-search"
          className="text-xs font-semibold text-muted-foreground"
        >
          Buscar
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="customer-filters-search"
            ref={searchInputRef}
            placeholder="Nombre o identificación"
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
          htmlFor="customer-filters-status"
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
            id="customer-filters-status"
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          >
            <SelectValue>{(value: unknown) => STATUS_LABELS[value as string] ?? 'Todos'}</SelectValue>
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
