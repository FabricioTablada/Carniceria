import { CheckCircle2, CircleOff, FolderTree, Layers } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { useCategories } from '../hooks/useCategories'

/**
 * features/categories/components/CategoriesKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Workspace Categorías (aprobado, "adoptar exactamente el mismo patron
 * visual de Productos"): deja de ser una grilla de 4 `KpiCard` con
 * tarjeta propia cada una (`size="compact"`, borde/sombra individuales) y
 * pasa a ser UNA sola franja de una fila, celdas `KpiCard` con `bare`
 * (sin `Card` propio) separadas por `divide-x`, todas en `size="xs"` —
 * mismo componente reutilizado, mismo criterio exacto que
 * `ProductsKpiRow.tsx` (mismas clases, mismo `KpiValueSkeleton`, mismo
 * patron de `<button>` envolviendo cada `KpiCard`). Vive como primera
 * franja del Workspace unico de `CategoriesPage.tsx`.
 *
 * "Activas"/"Inactivas" quedan clicables — aplican (o quitan, si ya
 * estaba aplicado) el filtro "Estado" correspondiente via
 * `onSelectActive` (mismo `handleFiltersChange` que ya usa
 * `CategoryFilters`, sin logica de filtrado nueva), con el mismo estado
 * visual "presionado" que Productos. "Categorías" (el total) limpia ese
 * mismo filtro al hacer click, igual que la celda "Productos" del
 * estandar de referencia. "Raíz" (metrica propia de este modulo, sin
 * equivalente en Productos) se mantiene como valor de solo lectura — no
 * forma parte del alcance de este bloque.
 *
 * Consultas propias con `limit: 1` (solo se necesita `meta.total`),
 * independientes de los filtros activos en la tabla — mismo criterio que
 * ya tenia esta franja antes del rediseño de Workspace, sin cambios.
 */
function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface CategoriesKpiRowProps {
  /** `filters.active` de `CategoriesPage.tsx` — determina que celda (si
   * alguna) se muestra en estado "presionado". */
  activeFilter: boolean | undefined
  /** Aplica (o quita) el filtro "Estado" correspondiente — mismo
   * `handleFiltersChange` que ya usa el resto del Workspace. */
  onSelectActive: (active: boolean | undefined) => void
}

export function CategoriesKpiRow({ activeFilter, onSelectActive }: CategoriesKpiRowProps) {
  const { data: totalResponse, isLoading: isTotalLoading } = useCategories({ limit: 1 })
  const { data: activeResponse, isLoading: isActiveLoading } = useCategories({
    active: true,
    limit: 1,
  })
  const { data: rootResponse, isLoading: isRootLoading } = useCategories({
    parentId: null,
    limit: 1,
  })

  const total = totalResponse?.meta.total
  const active = activeResponse?.meta.total
  const inactive = total !== undefined && active !== undefined ? total - active : undefined
  const rootTotal = rootResponse?.meta.total

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
      <button
        type="button"
        onClick={() => onSelectActive(undefined)}
        className="text-left transition-colors duration-150 hover:bg-brand/5"
      >
        <KpiCard
          bare
          label="Categorías"
          value={isTotalLoading ? <KpiValueSkeleton /> : (total ?? '—')}
          icon={FolderTree}
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
      <KpiCard
        bare
        label="Raíz"
        value={isRootLoading ? <KpiValueSkeleton /> : (rootTotal ?? '—')}
        icon={Layers}
        size="xs"
      />
    </div>
  )
}
