import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FilterBar } from '@/components/common/FilterBar'
import { ReportFiltersFooter } from '@/components/common/ReportFiltersFooter'
import { cn } from '@/lib/utils'
import { countActiveFilters } from '../utils/countActiveFilters'
import type { CashReportFilters } from '../types/report.types'

interface SelectOption {
  id: string
  name: string
}

interface CashSessionFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: CashReportFilters
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Opciones para el selector de caja registradora. */
  cashRegisters?: SelectOption[]
  /** Opciones para el selector de cajero (usuario que abrió la sesión). */
  users?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: CashReportFilters) => void
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todas',
  CLOSED: 'Cerradas',
  OPEN: 'Abiertas',
}

/** Mismo estilo de trigger que `SaleFilters.tsx` (pastilla elevada por
 * sombra, no por borde duro) — consistencia visual entre los filtros de
 * Ventas y los de Reportes. */
const TRIGGER_CLASSNAME =
  'h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none'

/**
 * features/reports/components/CashSessionFilters.tsx
 * -----------------------------------------------------------------------------
 * Filtros del historial de sesiones de caja (Bloque 2, "Ventas = sesion de
 * caja activa"). Mismo lenguaje visual que `SaleFilters.tsx`: `FilterBar`
 * compartido, mismos `Select` controlados — el "Estado" (Cerradas/
 * Abiertas/Todas) se destaca igual que el filtro principal de Ventas,
 * porque por defecto esta pantalla muestra el historial de sesiones
 * CERRADAS.
 *
 * Centro de Análisis (aprobado): ya no dibuja su propio contenedor con
 * borde (`border-b pb-5` + icono "Filtrar") — ahora vive dentro de
 * `Toolbar bare`, mismo criterio ya aplicado al resto de los filtros de
 * Reportes/Usuarios/Categorías. Suma `ReportFiltersFooter` (antes no
 * tenía "Limpiar filtros" en absoluto).
 */
export function CashSessionFilters({
  filters,
  sucursales = [],
  cashRegisters = [],
  users = [],
  onFiltersChange,
}: CashSessionFiltersProps) {
  const activeCount = countActiveFilters(filters)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="cash-session-filters-status"
            className="text-xs font-semibold text-muted-foreground"
          >
            Estado
          </Label>
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(value: unknown) => {
              const status = value as string

              onFiltersChange({
                ...filters,
                status:
                  status === 'all'
                    ? undefined
                    : (status as CashReportFilters['status']),
              })
            }}
          >
            <SelectTrigger
              id="cash-session-filters-status"
              className={cn(
                TRIGGER_CLASSNAME,
                'border-brand/20 bg-brand/5 font-semibold text-brand hover:bg-brand/10',
              )}
            >
              <SelectValue>
                {(value: unknown) => STATUS_LABELS[value as string] ?? 'Todas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="CLOSED">Cerradas</SelectItem>
              <SelectItem value="OPEN">Abiertas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="cash-session-filters-date-from"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha desde
          </Label>
          <Input
            id="cash-session-filters-date-from"
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
            htmlFor="cash-session-filters-date-to"
            className="text-xs font-semibold text-muted-foreground"
          >
            Fecha hasta
          </Label>
          <Input
            id="cash-session-filters-date-to"
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
            htmlFor="cash-session-filters-register"
            className="text-xs font-semibold text-muted-foreground"
          >
            Caja
          </Label>
          <Select
            value={filters.cashRegisterId ?? ''}
            onValueChange={(value: unknown) => {
              const cashRegisterId = value as string

              onFiltersChange({ ...filters, cashRegisterId: cashRegisterId || undefined })
            }}
          >
            <SelectTrigger id="cash-session-filters-register" className={TRIGGER_CLASSNAME}>
              <SelectValue>
                {(value: unknown) => {
                  const cashRegisterId = value as string
                  if (!cashRegisterId) return 'Todas las cajas'
                  return (
                    cashRegisters.find((register) => register.id === cashRegisterId)?.name ??
                    cashRegisterId
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las cajas</SelectItem>
              {cashRegisters.map((register) => (
                <SelectItem key={register.id} value={register.id}>
                  {register.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="cash-session-filters-user"
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
            <SelectTrigger id="cash-session-filters-user" className={TRIGGER_CLASSNAME}>
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
            htmlFor="cash-session-filters-sucursal"
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
            <SelectTrigger id="cash-session-filters-sucursal" className={TRIGGER_CLASSNAME}>
              <SelectValue>
                {(value: unknown) => {
                  const sucursalId = value as string
                  if (!sucursalId) return 'Todas las sucursales'
                  return (
                    sucursales.find((sucursal) => sucursal.id === sucursalId)?.name ??
                    sucursalId
                  )
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
        hasActiveFilters={activeCount > 0}
        activeCount={activeCount}
        onClear={() => onFiltersChange({})}
      />
    </div>
  )
}
