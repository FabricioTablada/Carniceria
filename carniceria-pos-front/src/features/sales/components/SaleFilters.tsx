import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { FilterBar } from '@/components/common/FilterBar'
import { ReportFiltersFooter } from '@/components/common/ReportFiltersFooter'
import { countActiveFilters } from '@/features/reports/utils/countActiveFilters'
import type { SaleFilters as SaleFiltersValue } from '../types/sale.types'

interface SelectOption {
  id: string
  name: string
}

interface SaleFiltersProps {
  /** Filtros actuales. El componente no mantiene estado propio. */
  filters: SaleFiltersValue
  /** Opciones para el selector de sucursal. */
  sucursales?: SelectOption[]
  /** Opciones para el selector de cajero (usuario). */
  users?: SelectOption[]
  /** Se dispara con el nuevo set de filtros en cada cambio. */
  onFiltersChange: (filters: SaleFiltersValue) => void
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  REFUNDED: 'Reembolsada',
}

/** Estilo de trigger compartido por los 3 selects: pastilla elevada por
 * sombra (no por borde duro), consistente con el lenguaje visual del
 * Dashboard (Card sin borde marcado, elevacion via `shadow-sm`). */
const TRIGGER_CLASSNAME =
  'h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none'

/**
 * features/sales/components/SaleFilters.tsx
 * -----------------------------------------------------------------------------
 * Centro de Operaciones (aprobado): ya no dibuja su propio contenedor
 * (`border-b pb-5` + icono "Filtrar") — vive dentro de `Toolbar bare`
 * (`components/common/Toolbar.tsx`), mismo criterio ya aplicado en
 * Reportes/Usuarios/Categorías. Suma `ReportFiltersFooter` con indicador
 * de filtros activos y "Limpiar filtros" (antes esta pantalla no tenía
 * ninguna forma de resetear los filtros) — mismo componente compartido
 * que ya usan los 9 reportes, `countActiveFilters` reutilizado tal cual
 * (utilidad pura, sin lógica de Reportes).
 *
 * Misma lógica exacta que antes: mismos 3 `Select` controlados, mismo
 * `onFiltersChange`, mismo `FilterBar` compartido. Ya NO incluye el
 * selector "Sesión de caja" (Bloque 1 de "Ventas = sesión de caja
 * activa", sin cambios en este bloque).
 */
export function SaleFilters({
  filters,
  sucursales = [],
  users = [],
  onFiltersChange,
}: SaleFiltersProps) {
  const activeCount = countActiveFilters(filters)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="sale-filters-status"
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
                    : (status as SaleFiltersValue['status']),
              })
            }}
          >
            <SelectTrigger
              id="sale-filters-status"
              className={cn(
                TRIGGER_CLASSNAME,
                'border-brand/20 bg-brand/5 font-semibold text-brand hover:bg-brand/10',
              )}
            >
              <SelectValue>
                {(value: unknown) => STATUS_LABELS[value as string] ?? 'Todos'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="COMPLETED">Completada</SelectItem>
              <SelectItem value="CANCELLED">Cancelada</SelectItem>
              <SelectItem value="REFUNDED">Reembolsada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="sale-filters-user"
            className="text-xs font-semibold text-muted-foreground"
          >
            Cajero
          </Label>
          <Select
            value={filters.userId ?? ''}
            onValueChange={(value: unknown) => {
              const userId = value as string

              onFiltersChange({
                ...filters,
                userId: userId || undefined,
              })
            }}
          >
            <SelectTrigger id="sale-filters-user" className={TRIGGER_CLASSNAME}>
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
            htmlFor="sale-filters-sucursal"
            className="text-xs font-semibold text-muted-foreground"
          >
            Sucursal
          </Label>
          <Select
            value={filters.sucursalId ?? ''}
            onValueChange={(value: unknown) => {
              const sucursalId = value as string

              onFiltersChange({
                ...filters,
                sucursalId: sucursalId || undefined,
              })
            }}
          >
            <SelectTrigger id="sale-filters-sucursal" className={TRIGGER_CLASSNAME}>
              {/*
                @base-ui/react Select.Value no deriva el label de los
                Select.Item renderizados. Se resuelve manualmente buscando
                en `sucursales`.
              */}
              <SelectValue>
                {(value: unknown) => {
                  const sucursalId = value as string
                  if (!sucursalId) return 'Todas las sucursales'
                  return (
                    sucursales.find((sucursal) => sucursal.id === sucursalId)
                      ?.name ?? sucursalId
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
