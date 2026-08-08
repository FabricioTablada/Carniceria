import { CheckCircle2, CircleOff, Percent } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { usePromotions } from '../hooks/usePromotions'

/**
 * features/promotions/components/PromotionsKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Workspace Promociones (aprobado, "mismo lenguaje visual que
 * Productos/Categorías/Impuestos"): deja de ser una grilla de 3 `KpiCard`
 * con tarjeta propia cada una (`size="compact"`) y pasa a ser UNA sola
 * franja de una fila, celdas `KpiCard` con `bare` separadas por
 * `divide-x`, todas en `size="xs"` — mismo patron exacto que
 * `ProductsKpiRow.tsx`/`CategoriesKpiRow.tsx`/`TaxesKpiRow.tsx`. Vive
 * como primera franja del Workspace unico de `PromotionsPage.tsx`.
 *
 * "Activas"/"Inactivas" quedan clicables — aplican (o quitan) el filtro
 * "Estado" (mismo `handleFiltersChange` que ya usa `PromotionFilters`,
 * sin logica de filtrado nueva). "Promociones" limpia ese mismo filtro.
 *
 * Solo 3 KPIs (mismo criterio que antes de este bloque): "Vigentes
 * ahora" requeriria traer TODAS las promociones y evaluar fecha/hora/dia
 * en el cliente, no un `meta.total` barato — se deja fuera para no
 * inventar una metrica mas costosa que el patron ya establecido.
 */
function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface PromotionsKpiRowProps {
  /** `filters.active` de `PromotionsPage.tsx` — determina que celda (si
   * alguna) se muestra en estado "presionado". */
  activeFilter: boolean | undefined
  /** Aplica (o quita) el filtro "Estado" — mismo `handleFiltersChange`
   * que ya usa el resto del Workspace. */
  onSelectActive: (active: boolean | undefined) => void
}

export function PromotionsKpiRow({ activeFilter, onSelectActive }: PromotionsKpiRowProps) {
  const { data: totalResponse, isLoading: isTotalLoading } = usePromotions({ limit: 1 })
  const { data: activeResponse, isLoading: isActiveLoading } = usePromotions({
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
          label="Promociones"
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
          label="Activas"
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
          label="Inactivas"
          value={isTotalLoading || isActiveLoading ? <KpiValueSkeleton /> : (inactive ?? '—')}
          icon={CircleOff}
          size="xs"
          tone="muted"
        />
      </button>
    </div>
  )
}
