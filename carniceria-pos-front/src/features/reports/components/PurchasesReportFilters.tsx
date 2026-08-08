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
import type { PurchasesReportFilters as PurchasesReportFiltersValue } from '../types/report.types'

interface SelectOption {
  id: string
  name: string
}

interface PurchasesReportFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: Omit<PurchasesReportFiltersValue, 'page' | 'limit'>
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Opciones para el selector de proveedor. */
  suppliers?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: Omit<PurchasesReportFiltersValue, 'page' | 'limit'>) => void
}

const TRIGGER_CLASSNAME =
  'h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none'

/**
 * features/reports/components/PurchasesReportFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02: mismo patron visual que `SalesReportFilters.tsx`
 * (misma maqueta aprobada, `FilterBar`/`ReportSearchField`/
 * `ReportFiltersFooter` compartidos). Campos propios de Compras — cada
 * uno corresponde 1 a 1 con un filtro que `PurchasesReportFilters`
 * (backend, via `usePurchasesReport`) YA acepta hoy (`sucursalId`/
 * `supplierId`/`dateFrom`/`dateTo`). Sin "Cajero"/"Método de pago" (esos
 * son de Ventas): el backend de Compras no expone ningun filtro de
 * usuario/metodo de pago, y esta pantalla no filtra por algo que el
 * backend no soporta.
 *
 * "Sucursal" recibe `sucursales` opcional (por defecto vacio): el modulo
 * `features/sucursales` todavia no existe en el frontend (mismo TODO ya
 * documentado en `CashReportPage.tsx`/`SalesReportFilters.tsx`).
 */
export function PurchasesReportFilters({
  filters,
  sucursales = [],
  suppliers = [],
  onFiltersChange,
}: PurchasesReportFiltersProps) {
  const activeCount = countActiveFilters(filters)
  const hasActiveFilters = activeCount > 0

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <ReportSearchField
          id="purchases-report-filters-search"
          placeholder="Buscar por documento o proveedor..."
        />

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="purchases-report-filters-date-from"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha desde
          </Label>
          <Input
            id="purchases-report-filters-date-from"
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
            htmlFor="purchases-report-filters-date-to"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha hasta
          </Label>
          <Input
            id="purchases-report-filters-date-to"
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
            htmlFor="purchases-report-filters-sucursal"
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
            <SelectTrigger id="purchases-report-filters-sucursal" className={TRIGGER_CLASSNAME}>
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
            htmlFor="purchases-report-filters-supplier"
            className="text-xs font-semibold text-muted-foreground"
          >
            Proveedor
          </Label>
          <Select
            value={filters.supplierId ?? ''}
            onValueChange={(value: unknown) => {
              const supplierId = value as string
              onFiltersChange({ ...filters, supplierId: supplierId || undefined })
            }}
          >
            <SelectTrigger id="purchases-report-filters-supplier" className={TRIGGER_CLASSNAME}>
              <SelectValue>
                {(value: unknown) => {
                  const supplierId = value as string
                  if (!supplierId) return 'Todos los proveedores'
                  return suppliers.find((supplier) => supplier.id === supplierId)?.name ?? supplierId
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los proveedores</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
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
