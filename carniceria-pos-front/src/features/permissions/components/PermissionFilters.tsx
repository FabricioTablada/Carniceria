import { Label } from '@/components/ui/label'
import { SearchInput } from '@/components/ui/SearchInput'
import { KbdHint } from '@/components/ui/KbdHint'
import { FilterBar } from '@/components/common/FilterBar'
import type { PermissionFilters as PermissionFiltersValue } from '../types/permission.types'

interface PermissionFiltersProps {
  filters: PermissionFiltersValue
  onFiltersChange: (filters: PermissionFiltersValue) => void
}

/**
 * features/permissions/components/PermissionFilters.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.29B.1 (paridad visual con Productos): deja de dibujar su
 * propio contenedor (`border-b border-border/60 pb-5`) — ahora vive
 * dentro de `<Toolbar bare>` en `PermissionsPage.tsx`, mismo criterio que
 * `ProductFilters.tsx`/`InventoryFilters.tsx`. Búsqueda por código,
 * descripción o módulo sin cambios (`matchesPermissionSearch`, sin
 * tocar). El campo pasa de un `Input` + ícono manual a `SearchInput`
 * (genérico, ya usado en el resto del proyecto), con un hint "Ctrl K"
 * puramente visual (`KbdHint`, decorativo — no registra ningún atajo
 * real, según lo aprobado).
 */
export function PermissionFilters({
  filters,
  onFiltersChange,
}: PermissionFiltersProps) {
  return (
    <FilterBar>
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="permission-filters-search"
          className="text-xs font-semibold text-muted-foreground"
        >
          Buscar
        </Label>
        <div className="relative">
          <SearchInput
            id="permission-filters-search"
            label="Buscar por código, descripción o módulo"
            placeholder="Código, descripción o módulo"
            value={filters.search ?? ''}
            onChange={(value) =>
              onFiltersChange({
                ...filters,
                search: value || undefined,
              })
            }
            className="h-10 w-64 rounded-xl border-transparent bg-card pr-14 shadow-sm transition-shadow duration-200 hover:shadow-md"
          />
          <KbdHint className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2">
            Ctrl K
          </KbdHint>
        </div>
      </div>
    </FilterBar>
  )
}
