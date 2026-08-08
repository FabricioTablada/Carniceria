import { CheckCircle2, CircleOff, ShieldCheck, Users as UsersIcon } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { useUsers } from '../hooks/useUsers'
import { useRoles } from '@/features/roles/hooks/useRoles'

/**
 * features/users/components/UsersKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Canvas Workspace Usuarios (aprobado): mismo patron `bare`/`xs`/`divide-x`
 * que `CategoriesKpiRow.tsx`/`ProductsKpiRow.tsx` (el estandar de
 * referencia) — deja de ser una grilla de `KpiCard` con tarjeta propia
 * (`size="compact"`) y pasa a ser UNA sola franja del Workspace unico de
 * `UsersPage.tsx`. Mismos 4 KPIs de siempre, mismas consultas (`useUsers`/
 * `useRoles` con `limit: 1`, solo `meta.total`) — sin metrica nueva.
 *
 * "Activos"/"Inactivos" quedan clicables — aplican (o quitan) el filtro
 * "Estado" via `onSelectActive`, mismo criterio exacto que
 * `CategoriesKpiRow.tsx`. "Usuarios" (el total) limpia ese mismo filtro.
 * "Roles activos" no filtra nada (no existe un filtro de "cantidad de
 * roles" en `UserFilters`) pero SI lleva un tooltip nativo (`title`,
 * mismo mecanismo ya usado en el boton deshabilitado de
 * `UsersTable.tsx` — no existe ningun componente `Tooltip` en el Design
 * System, asi que no se inventa uno para un solo texto) aclarando que
 * cuenta.
 *
 * QA.10: esta celda se llamaba "Roles en uso", pero `useRoles({ active:
 * true, limit: 1 })` solo cuenta filas activas del catalogo de roles
 * (`GET /roles`, sin ningun join contra `User.roleId`) — no cuantos de
 * esos roles tienen al menos un usuario realmente asignado. Un rol
 * activo recien creado, sin ningun usuario todavia, ya sumaba a ese
 * conteo pese a no estar "en uso" en ningun sentido real. Calcular el
 * conteo real requeriria una consulta nueva (fuera de alcance de este
 * bloque) — se corrige la etiqueta/tooltip para describir con precision
 * el dato que YA se muestra, sin cambiar la consulta ni el numero.
 */
function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface UsersKpiRowProps {
  /** `filters.active` de `UsersPage.tsx` — determina que celda (si
   * alguna) se muestra en estado "presionado". */
  activeFilter: boolean | undefined
  /** Aplica (o quita) el filtro "Estado" — mismo `handleFiltersChange`
   * que ya usa `UserFilters`. */
  onSelectActive: (active: boolean | undefined) => void
}

export function UsersKpiRow({ activeFilter, onSelectActive }: UsersKpiRowProps) {
  const { data: totalResponse, isLoading: isTotalLoading } = useUsers({ limit: 1 })
  const { data: activeResponse, isLoading: isActiveLoading } = useUsers({
    active: true,
    limit: 1,
  })
  const { data: rolesResponse, isLoading: isRolesLoading } = useRoles({ active: true, limit: 1 })

  const total = totalResponse?.meta.total
  const active = activeResponse?.meta.total
  const inactive = total !== undefined && active !== undefined ? total - active : undefined
  const rolesTotal = rolesResponse?.meta.total

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
      <button
        type="button"
        onClick={() => onSelectActive(undefined)}
        className="text-left transition-colors duration-150 hover:bg-brand/5"
      >
        <KpiCard
          bare
          label="Usuarios"
          value={isTotalLoading ? <KpiValueSkeleton /> : (total ?? '—')}
          icon={UsersIcon}
          size="xs"
        />
      </button>
      <button
        type="button"
        onClick={() => onSelectActive(activeFilter === true ? undefined : true)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeFilter === true && 'bg-success/5 shadow-[inset_0_-2px_0_var(--success)]',
        )}
      >
        <KpiCard
          bare
          label="Activos"
          value={isActiveLoading ? <KpiValueSkeleton /> : (active ?? '—')}
          icon={CheckCircle2}
          size="xs"
          tone="success"
        />
      </button>
      <button
        type="button"
        onClick={() => onSelectActive(activeFilter === false ? undefined : false)}
        className={cn(
          'text-left transition-colors duration-150 hover:bg-brand/5',
          activeFilter === false && 'bg-muted shadow-[inset_0_-2px_0_var(--muted-foreground)]',
        )}
      >
        <KpiCard
          bare
          label="Inactivos"
          value={isTotalLoading || isActiveLoading ? <KpiValueSkeleton /> : (inactive ?? '—')}
          icon={CircleOff}
          size="xs"
          tone="muted"
        />
      </button>
      <div title="Cantidad de roles activos definidos en el sistema.">
        <KpiCard
          bare
          label="Roles activos"
          value={isRolesLoading ? <KpiValueSkeleton /> : (rolesTotal ?? '—')}
          icon={ShieldCheck}
          size="xs"
        />
      </div>
    </div>
  )
}
