import { Search } from 'lucide-react'
import { FilterBar } from '@/components/common/FilterBar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VALUE_TYPE_LABELS } from '../constants/configuration.constants'
import type { ConfigurationFilters as ConfigurationFiltersValue } from '../types/configuration.types'

interface ConfigurationFiltersProps {
  filters: ConfigurationFiltersValue
  onFiltersChange: (filters: ConfigurationFiltersValue) => void
}

/**
 * features/settings/components/ConfigurationFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque Configuración (rediseño, aprobado): no existía ningún filtro en
 * este módulo — mismo patrón visual que `RoleFilters.tsx`/
 * `PermissionFilters.tsx` (`FilterBar` + `Input` con ícono + `Select`).
 *
 * Sin selector de Sucursal: no existe ningún módulo `features/sucursales`
 * en el frontend (verificado: sin `useSucursales`/`useBranches`, sin API) —
 * mismo motivo ya documentado en `PurchaseFilters.tsx` para omitir ese
 * mismo control. `ConfigurationFilters` (el tipo) sigue soportando
 * `sucursalId`, solo falta ese módulo para poblar las opciones; no se
 * inventa un listado falso de sucursales para llenar el hueco.
 *
 * Bloque 7.29D.1 (paridad visual con Productos/Permisos/Inventario): deja
 * de dibujar su propio contenedor (`border-b border-border/60 pb-5`) —
 * ahora vive dentro de `<Toolbar bare>` en `SettingsPage.tsx`.
 */
export function ConfigurationFilters({ filters, onFiltersChange }: ConfigurationFiltersProps) {
  return (
    <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="configuration-filters-search"
            className="text-xs font-semibold text-muted-foreground"
          >
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="configuration-filters-search"
              placeholder="Clave de la configuración"
              value={filters.search ?? ''}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  search: event.target.value || undefined,
                })
              }
              className="h-10 w-64 rounded-xl border-transparent bg-card pl-9 shadow-sm transition-shadow duration-200 hover:shadow-md"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="configuration-filters-type"
            className="text-xs font-semibold text-muted-foreground"
          >
            Tipo
          </Label>
          <Select
            value={filters.type ?? 'all'}
            onValueChange={(value: unknown) => {
              const type = value as string

              onFiltersChange({
                ...filters,
                type: type === 'all' ? undefined : (type as ConfigurationFiltersValue['type']),
              })
            }}
          >
            <SelectTrigger id="configuration-filters-type" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              {/*
                @base-ui/react Select.Value no deriva el label de los
                Select.Item renderizados. Se resuelve manualmente con
                `VALUE_TYPE_LABELS` (mismo mapa que ya usa `ConfigurationForm.tsx`).
              */}
              <SelectValue>
                {(value: unknown) => {
                  const type = value as string
                  if (type === 'all') return 'Todos'
                  return VALUE_TYPE_LABELS[type as keyof typeof VALUE_TYPE_LABELS] ?? type
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(VALUE_TYPE_LABELS).map(([type, label]) => (
                <SelectItem key={type} value={type}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
    </FilterBar>
  )
}
