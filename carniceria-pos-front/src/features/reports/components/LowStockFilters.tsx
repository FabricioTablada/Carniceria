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
import type { LowStockFilters as LowStockFiltersValue } from '../types/report.types'

interface SelectOption {
  id: string
  name: string
}

interface LowStockFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: LowStockFiltersValue
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Opciones para el selector de categoria. */
  categories?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: LowStockFiltersValue) => void
}

const TRIGGER_CLASSNAME =
  'h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none'

/**
 * features/reports/components/LowStockFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02 (bloque final): mismo patron visual que el resto de
 * los filtros de Reportes. Campos propios — Sucursal/Categoría/Punto de
 * corte, los que `LowStockFilters` (backend, via `useLowStock`) ya acepta
 * hoy. "Punto de corte" (`threshold`) reemplaza el `reorderPoint` propio
 * de cada producto cuando se especifica — campo numerico simple, sin
 * inventar ninguna regla nueva (el backend decide que hacer con el valor).
 */
export function LowStockFilters({
  filters,
  sucursales = [],
  categories = [],
  onFiltersChange,
}: LowStockFiltersProps) {
  const activeCount = countActiveFilters(filters)
  const hasActiveFilters = activeCount > 0

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <ReportSearchField
          id="low-stock-filters-search"
          placeholder="Buscar por producto o SKU..."
        />

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="low-stock-filters-category"
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
            <SelectTrigger id="low-stock-filters-category" className={TRIGGER_CLASSNAME}>
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

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="low-stock-filters-sucursal"
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
            <SelectTrigger id="low-stock-filters-sucursal" className={TRIGGER_CLASSNAME}>
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
            htmlFor="low-stock-filters-threshold"
            className="text-xs font-semibold text-muted-foreground"
          >
            Punto de corte
          </Label>
          <Input
            id="low-stock-filters-threshold"
            type="number"
            min={0}
            placeholder="Punto de reorden del producto"
            value={filters.threshold ?? ''}
            onChange={(event) => {
              const value = event.target.value
              onFiltersChange({
                ...filters,
                threshold: value === '' ? undefined : Number(value),
              })
            }}
            className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
          />
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
