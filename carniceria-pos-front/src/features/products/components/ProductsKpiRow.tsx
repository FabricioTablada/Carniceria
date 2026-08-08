import { ArrowUpRight, Boxes, CheckCircle2, CircleOff, Tags } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { cn } from '@/lib/utils'
import { useProducts } from '../hooks/useProducts'
import { useCategories } from '@/features/categories/hooks/useCategories'

/**
 * features/products/components/ProductsKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Sin endpoint nuevo, sin hook nuevo: reutiliza `useProducts`/
 * `useCategories` (ya existentes, sin tocar su codigo) con `limit: 1` —
 * el listado no necesita las filas, solo `meta.total`, asi que se pide el
 * payload mas chico posible en vez de reutilizar la consulta paginada
 * del listado principal (que refleja los FILTROS activos, no el total
 * real del catalogo — un KPI de "Productos" que cambiara con cada filtro
 * seria enganoso).
 *
 * "Inactivos" se calcula en el cliente (total - activos), sin una tercera
 * peticion — el numero ya esta disponible con las otras dos.
 *
 * Autonomo a proposito: no recibe `filters`/`page` de `ProductsPage.tsx`
 * porque sus numeros deben reflejar el catalogo completo, no la vista
 * filtrada actual — SI recibe `activeFilter` (solo el eje Activo/Inactivo)
 * para saber que celda marcar como aplicada, y `onSelectActive` para
 * aplicar el filtro correspondiente via el mismo `handleFiltersChange` que
 * ya usa el resto del Workspace (`ProductFilters`, chips) — cero logica de
 * filtrado nueva, solo un segundo punto de entrada hacia la misma.
 *
 * Rediseño de Workspace (aprobado, "los KPIs no deben sentirse como un
 * dashboard aparte"): deja de ser una grilla de 4 `KpiCard` con tarjeta
 * propia cada una (bordes/sombra individuales, `size="default"`/`compact`/
 * `xs` mezclados) y pasa a ser UNA sola franja de una sola fila, celdas
 * `KpiCard` con `bare` (sin `Card` propio) separadas por `divide-x`, todas
 * en `size="xs"` — mismo componente reutilizado, mucho menor protagonismo
 * visual, vive como la primera franja del Workspace unico de
 * `ProductsPage.tsx` (separada solo por un `border-b`, no por espacio ni
 * sombra propia). "Productos"/"Activos"/"Inactivos" quedan clicables
 * (aplican el filtro "Estado" correspondiente, con estado visual
 * "presionado" cuando ya esta aplicado); "Categorías" deja de ser un
 * numero inerte y navega a `/categories` — el unico de los 4 sin eje de
 * filtro real en esta pantalla, asi que se convierte en una salida util
 * entre modulos en vez de en un dato de solo lectura.
 */
function KpiValueSkeleton() {
  return <Skeleton className="h-3.5 w-8" />
}

interface ProductsKpiRowProps {
  /** `filters.active` de `ProductsPage.tsx` — determina que celda (si
   * alguna) se muestra en estado "presionado". */
  activeFilter: boolean | undefined
  /** Aplica (o quita, si ya estaba aplicado) el filtro "Estado"
   * correspondiente — mismo `handleFiltersChange` que ya usa el resto del
   * Workspace. */
  onSelectActive: (active: boolean | undefined) => void
}

export function ProductsKpiRow({ activeFilter, onSelectActive }: ProductsKpiRowProps) {
  const navigate = useNavigate()
  const { data: totalResponse, isLoading: isTotalLoading } = useProducts({ limit: 1 })
  const { data: activeResponse, isLoading: isActiveLoading } = useProducts({
    active: true,
    limit: 1,
  })
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useCategories({
    limit: 1,
  })

  const total = totalResponse?.meta.total
  const active = activeResponse?.meta.total
  const inactive = total !== undefined && active !== undefined ? total - active : undefined
  const categoriesTotal = categoriesResponse?.meta.total

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
      <button
        type="button"
        onClick={() => onSelectActive(undefined)}
        className="text-left transition-colors duration-150 hover:bg-brand/5"
      >
        <KpiCard
          bare
          label="Productos"
          value={isTotalLoading ? <KpiValueSkeleton /> : (total ?? '—')}
          icon={Boxes}
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
      <button
        type="button"
        onClick={() => navigate('/categories')}
        className="text-left transition-colors duration-150 hover:bg-brand/5"
      >
        <KpiCard
          bare
          label={
            <span className="inline-flex items-center gap-1">
              Categorías
              <ArrowUpRight className="size-3" />
            </span>
          }
          value={isCategoriesLoading ? <KpiValueSkeleton /> : (categoriesTotal ?? '—')}
          icon={Tags}
          size="xs"
          tone="muted"
        />
      </button>
    </div>
  )
}
