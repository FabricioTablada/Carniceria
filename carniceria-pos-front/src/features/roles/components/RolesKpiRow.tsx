import { CheckCircle2, Shield, ShieldCheck, User } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { useRoles } from '../hooks/useRoles'
import type { RoleFilters as RoleFiltersValue } from '../types/role.types'

/**
 * features/roles/components/RolesKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Roles (aprobado, "exactamente el mismo KPI Strip que ya
 * utiliza el resto del ERP"): copia literal del patrón de
 * `ProductsKpiRow.tsx` — franja de una sola fila, celdas `KpiCard` `bare`
 * `size="xs"` separadas por `divide-x`, cada una un `<button>` clicable
 * que aplica el filtro correspondiente (mismo `handleFiltersChange` que ya
 * usa `RoleFilters`, ninguna lógica de filtrado nueva). Mismo truco de
 * `{ limit: 1 }` sobre `useRoles` (ya usado antes de este bloque) para leer
 * solo `meta.total`, sin traer filas.
 *
 * Autónomo a propósito: no recibe la lista ya cargada de `RolesPage.tsx`
 * porque sus números deben reflejar el catálogo completo, no la página
 * filtrada actual — SÍ recibe `filters`/`onFiltersChange` para saber qué
 * celda marcar como "presionada" y para aplicar el filtro al hacer click.
 */
function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface RolesKpiRowProps {
  filters: RoleFiltersValue
  onFiltersChange: (filters: RoleFiltersValue) => void
}

export function RolesKpiRow({ filters, onFiltersChange }: RolesKpiRowProps) {
  const { data: totalResponse, isLoading: isTotalLoading } = useRoles({ limit: 1 })
  const { data: activeResponse, isLoading: isActiveLoading } = useRoles({ active: true, limit: 1 })
  const { data: systemResponse, isLoading: isSystemLoading } = useRoles({ isSystem: true, limit: 1 })
  const { data: customResponse, isLoading: isCustomLoading } = useRoles({ isSystem: false, limit: 1 })

  const selectActive = (active: boolean | undefined) => {
    onFiltersChange({ ...filters, active })
  }

  const selectIsSystem = (isSystem: boolean | undefined) => {
    onFiltersChange({ ...filters, isSystem })
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
      <button
        type="button"
        onClick={() => onFiltersChange({ ...filters, active: undefined, isSystem: undefined })}
        className="text-left transition-colors duration-150 hover:bg-brand/5"
      >
        <KpiCard
          bare
          label="Roles"
          value={isTotalLoading ? <KpiValueSkeleton /> : (totalResponse?.meta.total ?? '—')}
          icon={Shield}
          size="xs"
        />
      </button>
      <button
        type="button"
        onClick={() => selectActive(filters.active === true ? undefined : true)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          filters.active === true && 'bg-success/5 shadow-[inset_0_-2px_0_var(--success)]',
        )}
      >
        <KpiCard
          bare
          label="Activos"
          value={isActiveLoading ? <KpiValueSkeleton /> : (activeResponse?.meta.total ?? '—')}
          icon={CheckCircle2}
          size="xs"
          tone="success"
        />
      </button>
      <button
        type="button"
        onClick={() => selectIsSystem(filters.isSystem === true ? undefined : true)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          filters.isSystem === true && 'bg-brand/5 shadow-[inset_0_-2px_0_var(--brand)]',
        )}
      >
        <KpiCard
          bare
          label="Del sistema"
          value={isSystemLoading ? <KpiValueSkeleton /> : (systemResponse?.meta.total ?? '—')}
          icon={ShieldCheck}
          size="xs"
        />
      </button>
      <button
        type="button"
        onClick={() => selectIsSystem(filters.isSystem === false ? undefined : false)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          filters.isSystem === false && 'bg-muted shadow-[inset_0_-2px_0_var(--muted-foreground)]',
        )}
      >
        <KpiCard
          bare
          label="Personalizados"
          value={isCustomLoading ? <KpiValueSkeleton /> : (customResponse?.meta.total ?? '—')}
          icon={User}
          size="xs"
          tone="muted"
        />
      </button>
    </div>
  )
}
