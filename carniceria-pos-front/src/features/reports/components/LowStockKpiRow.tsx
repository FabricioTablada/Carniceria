import { CircleOff, Layers, Store, Tag, TriangleAlert } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { summarizeLowStock } from '../utils/lowStockSummary'
import type { LowStockItem } from '../types/report.types'

interface LowStockKpiRowProps {
  items: LowStockItem[]
  isLoading: boolean
}

function KpiValueSkeleton() {
  return <Skeleton className="h-[1.125rem] w-10" />
}

/**
 * features/reports/components/LowStockKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02 (bloque final): `GET /reports/low-stock` NO pagina
 * (mismo caso que `SalesByCategoryKpiRow.tsx`/`TopProductsKpiRow.tsx`) —
 * `useLowStock` ya devuelve el conjunto COMPLETO de productos en o por
 * debajo de su punto de reorden para el filtro activo
 * (`sucursalId`/`categoryId`/`threshold`). Por eso las 5 tarjetas se
 * calculan sobre `items` directo, 100% reales, sin fetch adicional —
 * mismos datos que ya usa la tabla, sin ninguna consulta nueva.
 *
 * Se descarto sumar `quantity` entre filas ("cantidad total en bajo
 * stock"): `LowStockItem.unitOfMeasure` mezcla `KILOGRAM`/`UNIT` — sumar
 * kilogramos y unidades en un solo numero no tiene sentido dimensional,
 * seria un dato tecnicamente "real" pero sin significado de negocio. En
 * su lugar, los 5 KPIs son conteos (categorias/sucursales/productos
 * afectados, con/sin existencia), todos comparables sin importar la
 * unidad de cada producto.
 */
export function LowStockKpiRow({ items, isLoading }: LowStockKpiRowProps) {
  const { outOfStockCount, lowStockCount, categoriesAffected, sucursalesAffected } =
    summarizeLowStock(items)

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        bare
        label="Productos"
        value={isLoading ? <KpiValueSkeleton /> : items.length}
        icon={TriangleAlert}
        size="xs"
      />
      <KpiCard
        bare
        label="Sin existencias"
        value={isLoading ? <KpiValueSkeleton /> : outOfStockCount}
        icon={CircleOff}
        size="xs"
        tone={outOfStockCount > 0 ? 'muted' : 'success'}
      />
      <KpiCard
        bare
        label="Con existencia baja"
        value={isLoading ? <KpiValueSkeleton /> : lowStockCount}
        icon={Layers}
        size="xs"
      />
      <KpiCard
        bare
        label="Categorías afectadas"
        value={isLoading ? <KpiValueSkeleton /> : categoriesAffected}
        icon={Tag}
        size="xs"
      />
      <KpiCard
        bare
        label="Sucursales afectadas"
        value={isLoading ? <KpiValueSkeleton /> : sucursalesAffected}
        icon={Store}
        size="xs"
      />
    </div>
  )
}
