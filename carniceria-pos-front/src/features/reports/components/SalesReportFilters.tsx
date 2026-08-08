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
import { PAYMENT_METHOD_OPTIONS } from '@/features/sales/utils/payment'
import { countActiveFilters } from '../utils/countActiveFilters'
import type { SalesReportFilters as SalesReportFiltersValue } from '../types/report.types'

interface SelectOption {
  id: string
  name: string
}

interface SalesReportFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: Omit<SalesReportFiltersValue, 'page' | 'limit'>
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Opciones para el selector de cajero. */
  users?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: Omit<SalesReportFiltersValue, 'page' | 'limit'>) => void
}

const TRIGGER_CLASSNAME =
  'h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none'

/**
 * features/reports/components/SalesReportFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02 (correccion): mismo lenguaje visual que
 * `ProductFilters.tsx`/`CashSessionFilters.tsx` (`FilterBar` compartido,
 * mismos `Select`/`Input` con sombra en vez de borde duro). Cada campo
 * corresponde 1 a 1 con un filtro que `SalesReportFilters` (backend, via
 * `useSalesReport`) YA acepta hoy (`sucursalId`/`userId`/`paymentMethod`/
 * `dateFrom`/`dateTo`) — sin agregar ningun parametro que el backend no
 * soporte.
 *
 * "Buscar" y la segunda fila ("Filtros avanzados"/"Limpiar filtros") ya
 * NO se dibujan aca — se extrajeron a `ReportSearchField.tsx`/
 * `ReportFiltersFooter.tsx` (`components/common/`), compartidos por
 * cualquier reporte que replique este mismo patron (Compras/Inventario/
 * Utilidad): son identicos sin importar el modulo, ningun dato de Ventas
 * vivia ahi.
 *
 * "Sucursal" recibe `sucursales` opcional (por defecto vacio): el modulo
 * `features/sucursales` todavia no existe en el frontend (mismo TODO ya
 * documentado en `CashReportPage.tsx`/`SalesPage.tsx`) — el campo ya esta
 * preparado para poblarse cuando exista, sin logica que cambiar.
 */
export function SalesReportFilters({
  filters,
  sucursales = [],
  users = [],
  onFiltersChange,
}: SalesReportFiltersProps) {
  const activeCount = countActiveFilters(filters)
  const hasActiveFilters = activeCount > 0

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <ReportSearchField
          id="sales-report-filters-search"
          placeholder="Buscar por documento, referencia o cliente..."
        />

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="sales-report-filters-date-from"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha desde
          </Label>
          <Input
            id="sales-report-filters-date-from"
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
            htmlFor="sales-report-filters-date-to"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha hasta
          </Label>
          <Input
            id="sales-report-filters-date-to"
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
            htmlFor="sales-report-filters-sucursal"
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
            <SelectTrigger id="sales-report-filters-sucursal" className={TRIGGER_CLASSNAME}>
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
            htmlFor="sales-report-filters-user"
            className="text-xs font-semibold text-muted-foreground"
          >
            Cajero
          </Label>
          <Select
            value={filters.userId ?? ''}
            onValueChange={(value: unknown) => {
              const userId = value as string
              onFiltersChange({ ...filters, userId: userId || undefined })
            }}
          >
            <SelectTrigger id="sales-report-filters-user" className={TRIGGER_CLASSNAME}>
              <SelectValue>
                {(value: unknown) => {
                  const userId = value as string
                  if (!userId) return 'Todos los cajeros'
                  return users.find((user) => user.id === userId)?.name ?? userId
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los cajeros</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="sales-report-filters-payment-method"
            className="text-xs font-semibold text-muted-foreground"
          >
            Método de pago
          </Label>
          <Select
            value={filters.paymentMethod ?? ''}
            onValueChange={(value: unknown) => {
              const paymentMethod = value as string
              onFiltersChange({
                ...filters,
                paymentMethod: (paymentMethod || undefined) as SalesReportFiltersValue['paymentMethod'],
              })
            }}
          >
            <SelectTrigger id="sales-report-filters-payment-method" className={TRIGGER_CLASSNAME}>
              <SelectValue>
                {(value: unknown) => {
                  const paymentMethod = value as string
                  if (!paymentMethod) return 'Todos los métodos'
                  return (
                    PAYMENT_METHOD_OPTIONS.find((option) => option.value === paymentMethod)?.label ??
                    paymentMethod
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los métodos</SelectItem>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
