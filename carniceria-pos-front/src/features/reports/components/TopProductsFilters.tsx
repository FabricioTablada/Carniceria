import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FilterBar } from '@/components/common/FilterBar'
import { ReportSearchField } from '@/components/common/ReportSearchField'
import { ReportFiltersFooter } from '@/components/common/ReportFiltersFooter'
import { countActiveFilters } from '../utils/countActiveFilters'
import type { TopProductsFilters as TopProductsFiltersValue } from '../types/report.types'

interface SelectOption {
  id: string
  name: string
}

interface TopProductsFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: TopProductsFiltersValue
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Opciones para el selector de categoria. */
  categories?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: TopProductsFiltersValue) => void
}

const TRIGGER_CLASSNAME =
  'h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none'

/**
 * features/reports/components/TopProductsFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02: mismo patron visual que el resto de los filtros de
 * Reportes. Campos propios — Fecha desde/Fecha hasta/Sucursal/Categoría,
 * los que `TopProductsFilters` (backend, via `useTopProducts`) ya acepta
 * hoy. `limit` (el tamaño del ranking) no es un filtro de usuario en esta
 * pantalla — sigue siendo `DEFAULT_LIMIT` fijo en `TopProductsPage.tsx`,
 * sin cambios de comportamiento.
 */
export function TopProductsFilters({
  filters,
  sucursales = [],
  categories = [],
  onFiltersChange,
}: TopProductsFiltersProps) {
  const activeCount = countActiveFilters(filters)
  const hasActiveFilters = activeCount > 0

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <ReportSearchField
          id="top-products-filters-search"
          placeholder="Buscar por producto o SKU..."
        />

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="top-products-filters-date-from"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha desde
          </Label>
          <Input
            id="top-products-filters-date-from"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(event) =>
              onFiltersChange({ ...filters, dateFrom: event.target.value || undefined })
            }
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="top-products-filters-date-to"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha hasta
          </Label>
          <Input
            id="top-products-filters-date-to"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(event) =>
              onFiltersChange({ ...filters, dateTo: event.target.value || undefined })
            }
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="top-products-filters-sucursal"
            className="text-xs font-semibold text-muted-foreground"
          >
            Sucursal
          </Label>
          <Select
            value={filters.sucursalId ?? ''}
            onValueChange={(value: unknown) => {
              const sucursalId = value as string
              onFiltersChange({ ...filters, sucursalId: sucursalId || undefined })
            }}
          >
            <SelectTrigger id="top-products-filters-sucursal" className={TRIGGER_CLASSNAME}>
              <SelectValue>
                {(value: unknown) => {
                  const sucursalId = value as string
                  if (!sucursalId) return 'Todas las sucursales'
                  return sucursales.find((sucursal) => sucursal.id === sucursalId)?.name ?? sucursalId
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las sucursales</SelectItem>
              {sucursales.map((sucursal) => (
                <SelectItem key={sucursal.id} value={sucursal.id}>
                  {sucursal.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="top-products-filters-category"
            className="text-xs font-semibold text-muted-foreground"
          >
            Categoría
          </Label>
          <Select
            value={filters.categoryId ?? ''}
            onValueChange={(value: unknown) => {
              const categoryId = value as string
              onFiltersChange({ ...filters, categoryId: categoryId || undefined })
            }}
          >
            <SelectTrigger id="top-products-filters-category" className={TRIGGER_CLASSNAME}>
              <SelectValue>
                {(value: unknown) => {
                  const categoryId = value as string
                  if (!categoryId) return 'Todas las categorías'
                  return categories.find((category) => category.id === categoryId)?.name ?? categoryId
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
      </FilterBar>

      <ReportFiltersFooter
        hasActiveFilters={hasActiveFilters}
        activeCount={activeCount}
        onClear={() => onFiltersChange({})}
      />
    </div>
  )
}
