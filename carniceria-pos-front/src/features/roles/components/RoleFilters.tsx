import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RoleFilters as RoleFiltersValue } from '../types/role.types'
import { FilterBar } from '@/components/common/FilterBar'
import { ReportFiltersFooter } from '@/components/common/ReportFiltersFooter'
import { countActiveFilters } from '@/features/reports/utils/countActiveFilters'

interface RoleFiltersProps {
  filters: RoleFiltersValue
  onFiltersChange: (filters: RoleFiltersValue) => void
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos',
  active: 'Activos',
  inactive: 'Inactivos',
}

const TYPE_LABELS: Record<string, string> = {
  all: 'Todos',
  system: 'Roles del sistema',
  custom: 'Roles personalizados',
}

export function RoleFilters({ filters, onFiltersChange }: RoleFiltersProps) {
  const activeCount = countActiveFilters(filters)

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="role-filters-search"
            className="text-xs font-semibold text-muted-foreground"
          >
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="role-filters-search"
              placeholder="Nombre del rol"
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
            htmlFor="role-filters-active"
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

              onFiltersChange({
                ...filters,
                active: status === 'all' ? undefined : status === 'active',
              })
            }}
          >
            <SelectTrigger id="role-filters-active" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              {/*
                @base-ui/react Select.Value no deriva el label de los
                Select.Item renderizados (ver SelectFilters de Users para
                el detalle completo). Se resuelve manualmente con un mapa.
              */}
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

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="role-filters-isSystem"
            className="text-xs font-semibold text-muted-foreground"
          >
            Tipo
          </Label>
          <Select
            value={
              filters.isSystem === undefined
                ? 'all'
                : filters.isSystem
                  ? 'system'
                  : 'custom'
            }
            onValueChange={(value: unknown) => {
              const type = value as string

              onFiltersChange({
                ...filters,
                isSystem: type === 'all' ? undefined : type === 'system',
              })
            }}
          >
            <SelectTrigger id="role-filters-isSystem" className="h-10 min-w-40 flex-1 rounded-xl border-transparent bg-card px-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-none">
              <SelectValue>
                {(value: unknown) => TYPE_LABELS[value as string] ?? 'Todos'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="system">Roles del sistema</SelectItem>
              <SelectItem value="custom">Roles personalizados</SelectItem>
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