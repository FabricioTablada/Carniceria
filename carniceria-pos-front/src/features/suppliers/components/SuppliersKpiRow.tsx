import { Building2, CheckCircle2, CircleOff } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { useSuppliers } from '../hooks/useSuppliers'

/**
 * features/suppliers/components/SuppliersKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Workspace Proveedores (aprobado, "mismo lenguaje visual que Productos/
 * Categorías/Impuestos/Promociones"): deja de ser una grilla de 3
 * `KpiCard` con tarjeta propia cada una (`size="compact"`) y pasa a ser
 * UNA sola franja de una fila, celdas `KpiCard` con `bare` separadas por
 * `divide-x`, todas en `size="xs"` — mismo patron exacto del resto del
 * ERP. Vive como primera franja del Workspace unico de
 * `SuppliersPage.tsx`.
 *
 * "Activos"/"Inactivos" quedan clicables — aplican (o quitan) el filtro
 * "Estado" (mismo `handleFiltersChange` que ya usa `SupplierFilters`,
 * sin logica de filtrado nueva). "Proveedores" limpia ese mismo filtro.
 *
 * Solo 3 KPIs (mismo criterio que antes de este bloque): `SupplierFilters`
 * no tiene ningun otro filtro booleano soportado por el backend que de
 * una cuarta metrica honesta.
 */
function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface SuppliersKpiRowProps {
  /** `filters.active` de `SuppliersPage.tsx` — determina que celda (si
   * alguna) se muestra en estado "presionado". */
  activeFilter: boolean | undefined
  /** Aplica (o quita) el filtro "Estado" — mismo `handleFiltersChange`
   * que ya usa el resto del Workspace. */
  onSelectActive: (active: boolean | undefined) => void
}

export function SuppliersKpiRow({ activeFilter, onSelectActive }: SuppliersKpiRowProps) {
  const { data: totalResponse, isLoading: isTotalLoading } = useSuppliers({ limit: 1 })
  const { data: activeResponse, isLoading: isActiveLoading } = useSuppliers({
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
          label="Proveedores"
          value={isTotalLoading ? <KpiValueSkeleton /> : (total ?? '—')}
          icon={Building2}
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
