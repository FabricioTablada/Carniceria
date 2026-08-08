import { CheckCircle2, CircleOff, Percent, Star } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { useTaxes } from '../hooks/useTaxes'

/**
 * features/taxes/components/TaxesKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Workspace Impuestos (aprobado, "misma familia visual que Productos/
 * Categorías"): deja de ser una grilla de 4 `KpiCard` con tarjeta propia
 * cada una (`size="compact"`) y pasa a ser UNA sola franja de una fila,
 * celdas `KpiCard` con `bare` separadas por `divide-x`, todas en
 * `size="xs"` — mismo patrón exacto de `ProductsKpiRow.tsx`/
 * `CategoriesKpiRow.tsx`. Vive como primera franja del Workspace único de
 * `TaxesPage.tsx`.
 *
 * "Activos"/"Inactivos" quedan clicables — aplican (o quitan) el filtro
 * "Estado" (mismo `handleFiltersChange` que ya usa `TaxFilters`, sin
 * lógica de filtrado nueva). "Impuestos" limpia ese mismo filtro. "Por
 * defecto" (métrica propia de este módulo, sin eje de filtro clicable en
 * este bloque — ya existe un filtro dedicado en la Toolbar) se mantiene
 * de solo lectura, mismo criterio que "Raíz" en `CategoriesKpiRow.tsx`.
 */
function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface TaxesKpiRowProps {
  /** `filters.active` de `TaxesPage.tsx` — determina que celda (si
   * alguna) se muestra en estado "presionado". */
  activeFilter: boolean | undefined
  /** Aplica (o quita) el filtro "Estado" — mismo `handleFiltersChange`
   * que ya usa el resto del Workspace. */
  onSelectActive: (active: boolean | undefined) => void
}

export function TaxesKpiRow({ activeFilter, onSelectActive }: TaxesKpiRowProps) {
  const { data: totalResponse, isLoading: isTotalLoading } = useTaxes({ limit: 1 })
  const { data: activeResponse, isLoading: isActiveLoading } = useTaxes({
    active: true,
    limit: 1,
  })
  // QA.8: `active: true` agregado — ver doc en `TaxDefaultHero.tsx`. Sin
  // el filtro, un impuesto por defecto desactivado seguia contando como
  // "1" aca, aunque ya no sea un default utilizable en ningun selector.
  const { data: defaultResponse, isLoading: isDefaultLoading } = useTaxes({
    isDefault: true,
    active: true,
    limit: 1,
  })

  const total = totalResponse?.meta.total
  const active = activeResponse?.meta.total
  const inactive = total !== undefined && active !== undefined ? total - active : undefined
  const defaultTotal = defaultResponse?.meta.total

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
      <button
        type="button"
        onClick={() => onSelectActive(undefined)}
        className="text-left transition-colors duration-150 hover:bg-brand/5"
      >
        <KpiCard
          bare
          label="Impuestos"
          value={isTotalLoading ? <KpiValueSkeleton /> : (total ?? '—')}
          icon={Percent}
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
      <KpiCard
        bare
        label="Por defecto"
        value={isDefaultLoading ? <KpiValueSkeleton /> : (defaultTotal ?? '—')}
        icon={Star}
        size="xs"
      />
    </div>
  )
}
