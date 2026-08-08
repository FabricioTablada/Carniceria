import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UserFilters as UserFiltersValue } from '../types/user.types'
import { FilterBar } from '@/components/common/FilterBar'

interface RoleOption {
  id: string
  name: string
}

interface UserFiltersProps {
  filters: UserFiltersValue
  roles?: RoleOption[]
  onChange: (filters: UserFiltersValue) => void
  onReset: () => void
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Inactivos',
}

/**
 * features/users/components/UserFilters.tsx
 * -----------------------------------------------------------------------------
 * Canvas Workspace Usuarios (aprobado): ya no dibuja su propio contenedor
 * con borde (`border-b pb-5`) — ahora vive dentro de `Toolbar bare`
 * (`components/common/Toolbar.tsx`), que es quien dibuja la franja del
 * Workspace unico de `UsersPage.tsx`. Mismos 4 controles de siempre
 * (Buscar/Rol/Estado/Limpiar filtros), misma logica de filtrado — cero
 * cambio de comportamiento, solo de quien dibuja el borde exterior (mismo
 * criterio ya aplicado en `CategoryFilters.tsx`).
 */
export function UserFilters({
  filters,
  roles = [],
  onChange,
  onReset,
}: UserFiltersProps) {
  return (
    <FilterBar>
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="user-filters-search"
          className="text-xs font-semibold text-muted-foreground"
        >
          Buscar
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="user-filters-search"
            placeholder="Nombre o usuario"
            value={filters.search ?? ''}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value || undefined })
            }
            className="h-10 w-64 rounded-xl border-transparent bg-card pl-9 shadow-sm transition-shadow duration-200 hover:shadow-md"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="user-filters-role"
          className="text-xs font-semibold text-muted-foreground"
        >
          Rol
        </Label>
        <Select
          value={filters.roleId ?? ''}
          onValueChange={(value: unknown) => {
            const roleId = value as string

            onChange({ ...filters, roleId: roleId || undefined })
          }}
        >
          <SelectTrigger id="user-filters-role" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
            {/*
              @base-ui/react Select.Value no deriva el label de los
              Select.Item renderizados: sin `items` en el Root o una
              funcion hijo aca, muestra el `value` crudo (el uuid). Esta
              funcion resuelve el nombre real buscando en `roles`.
            */}
            <SelectValue>
              {(value: unknown) => {
                const roleId = value as string
                if (!roleId) return 'Todos los roles'
                return (
                  roles.find((role) => role.id === roleId)?.name ?? roleId
                )
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="user-filters-status"
          className="text-xs font-semibold text-muted-foreground"
        >
          Estado
        </Label>
        <Select
          value={
            filters.active === undefined
              ? 'all'
              : filters.active
                ? 'active'
                : 'inactive'
          }
          onValueChange={(value: unknown) => {
            const status = value as string

            onChange({
              ...filters,
              active: status === 'all' ? undefined : status === 'active',
            })
          }}
        >
          <SelectTrigger id="user-filters-status" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
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

      <Button
        type="button"
        variant="ghost"
        onClick={onReset}
        className="h-10 shrink-0 rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        Limpiar filtros
      </Button>
    </FilterBar>
  )
}
