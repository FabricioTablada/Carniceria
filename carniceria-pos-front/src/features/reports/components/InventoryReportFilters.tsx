import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FilterBar } from '@/components/common/FilterBar'
import { ReportSearchField } from '@/components/common/ReportSearchField'
import { ReportFiltersFooter } from '@/components/common/ReportFiltersFooter'
import { countActiveFilters } from '../utils/countActiveFilters'
import type { InventoryReportFilters as InventoryReportFiltersValue } from '../types/report.types'

interface SelectOption {
  id: string
  name: string
}

interface InventoryReportFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: Omit<InventoryReportFiltersValue, 'page' | 'limit'>
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Opciones para el selector de categoria. */
  categories?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: Omit<InventoryReportFiltersValue, 'page' | 'limit'>) => void
}

const TRIGGER_CLASSNAME =
  'h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none'

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Inactivos',
}

/**
 * features/reports/components/InventoryReportFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02: mismo patron visual que `SalesReportFilters.tsx`/
 * `PurchasesReportFilters.tsx` (misma maqueta aprobada, `FilterBar`/
 * `ReportSearchField`/`ReportFiltersFooter` compartidos). Campos propios
 * de Inventario — cada uno corresponde 1 a 1 con un filtro que
 * `InventoryReportFilters` (backend, via `useInventoryReport`) YA acepta
 * hoy (`categoryId`/`sucursalId`/`active`). Sin fechas ni proveedor/
 * cajero: ese reporte no tiene esos campos.
 *
 * "Sucursal" recibe `sucursales` opcional (por defecto vacio): el modulo
 * `features/sucursales` todavia no existe en el frontend (mismo TODO ya
 * documentado en `SalesReportFilters.tsx`/`PurchasesReportFilters.tsx`).
 */
export function InventoryReportFilters({
  filters,
  sucursales = [],
  categories = [],
  onFiltersChange,
}: InventoryReportFiltersProps) {
  const activeCount = countActiveFilters(filters)
  const hasActiveFilters = activeCount > 0

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <ReportSearchField
          id="inventory-report-filters-search"
          placeholder="Buscar por producto o SKU..."
        />

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="inventory-report-filters-category"
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
            <SelectTrigger id="inventory-report-filters-category" className={TRIGGER_CLASSNAME}>
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
            htmlFor="inventory-report-filters-sucursal"
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
            <SelectTrigger id="inventory-report-filters-sucursal" className={TRIGGER_CLASSNAME}>
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
            htmlFor="inventory-report-filters-status"
            className="text-xs font-semibold text-muted-foreground"
          >
            Estado
          </Label>
          <Select
            value={
              filters.active === undefined ? 'all' : filters.active ? 'active' : 'inactive'
            }
            onValueChange={(value: unknown) => {
              const status = value as string
              onFiltersChange({
                ...filters,
                active: status === 'all' ? undefined : status === 'active',
              })
            }}
          >
            <SelectTrigger id="inventory-report-filters-status" className={TRIGGER_CLASSNAME}>
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

      <ReportFiltersFooter
        hasActiveFilters={hasActiveFilters}
        activeCount={activeCount}
        onClear={() => onFiltersChange({})}
      />
    </div>
  )
}
