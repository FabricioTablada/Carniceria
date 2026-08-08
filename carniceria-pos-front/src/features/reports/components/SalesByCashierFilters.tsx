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
import type { SalesByCashierFilters as SalesByCashierFiltersValue } from '../types/report.types'

interface SelectOption {
  id: string
  name: string
}

interface SalesByCashierFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: SalesByCashierFiltersValue
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: SalesByCashierFiltersValue) => void
}

/**
 * features/reports/components/SalesByCashierFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-AGREGADOS (Ventas por Cajero): mismo patron visual que
 * `SalesByCategoryFilters.tsx`. Campos propios — Fecha desde/Fecha hasta/
 * Sucursal, los que `SalesByCashierFilters` (backend, via
 * `useSalesByCashier`) ya acepta hoy. Sin "Cajero": no tiene sentido
 * filtrar por cajero un reporte que agrupa *por* cajero (mismo motivo
 * documentado en `report.types.ts`).
 */
export function SalesByCashierFilters({
  filters,
  sucursales = [],
  onFiltersChange,
}: SalesByCashierFiltersProps) {
  const activeCount = countActiveFilters(filters)
  const hasActiveFilters = activeCount > 0

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <ReportSearchField
          id="sales-by-cashier-filters-search"
          placeholder="Buscar por cajero..."
        />

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="sales-by-cashier-filters-date-from"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha desde
          </Label>
          <Input
            id="sales-by-cashier-filters-date-from"
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
            htmlFor="sales-by-cashier-filters-date-to"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha hasta
          </Label>
          <Input
            id="sales-by-cashier-filters-date-to"
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
            htmlFor="sales-by-cashier-filters-sucursal"
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
            <SelectTrigger
              id="sales-by-cashier-filters-sucursal"
              className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none"
            >
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
      </FilterBar>

      <ReportFiltersFooter
        hasActiveFilters={hasActiveFilters}
        activeCount={activeCount}
        onClear={() => onFiltersChange({})}
      />
    </div>
  )
}
