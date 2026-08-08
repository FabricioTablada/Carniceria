import { CheckCircle2, CircleOff, UserRound } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { useCustomers } from '../hooks/useCustomers'

/**
 * features/customers/components/CustomersKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque 8.2 — mismo patron exacto que `SuppliersKpiRow.tsx`: una sola
 * franja de una fila, celdas `KpiCard` `bare`/`size="xs"` separadas por
 * `divide-x`. "Activos"/"Inactivos" aplican (o quitan) el filtro "Estado";
 * "Clientes" lo limpia.
 */
function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface CustomersKpiRowProps {
  /** `filters.active` de `CustomersPage.tsx` — determina que celda (si
   * alguna) se muestra en estado "presionado". */
  activeFilter: boolean | undefined
  /** Aplica (o quita) el filtro "Estado" — mismo `handleFiltersChange`
   * que ya usa el resto del Workspace. */
  onSelectActive: (active: boolean | undefined) => void
}

export function CustomersKpiRow({ activeFilter, onSelectActive }: CustomersKpiRowProps) {
  const { data: totalResponse, isLoading: isTotalLoading } = useCustomers({ limit: 1 })
  const { data: activeResponse, isLoading: isActiveLoading } = useCustomers({
    active: true,
    limit: 1,
  })

  const total = totalResponse?.meta.total
  const active = activeResponse?.meta.total
  const inactive = total !== undefined && active !== undefined ? total - active : undefined

  return (
    <div className="grid grid-cols-1 divide-x divide-border sm:grid-cols-3">
      <button
        type="button"
        onClick={() => onSelectActive(undefined)}
        className="text-left transition-colors duration-150 hover:bg-brand/5"
      >
        <KpiCard
          bare
          label="Clientes"
          value={isTotalLoading ? <KpiValueSkeleton /> : (total ?? '—')}
          icon={UserRound}
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
    </div>
  )
}
