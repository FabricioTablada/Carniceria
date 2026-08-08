import { Boxes, CircleOff, Store, Tag, TriangleAlert } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { useInventoryReportSummary } from '../hooks/useInventoryReportSummary'
import type { InventoryReportFilters } from '../types/report.types'

interface InventoryReportKpiRowProps {
  /** Mismos filtros activos que ya usa `InventoryReportPage.tsx` para la
   * tabla/paginacion (sin `page`/`limit`) — reenviados tal cual a
   * `useInventoryReportSummary`, para que el agregado SIEMPRE refleje el
   * mismo conjunto filtrado que ve el usuario. */
  filters: Omit<InventoryReportFilters, 'page' | 'limit'>
}

function KpiValueSkeleton() {
  return <Skeleton className="h-[1.125rem] w-10" />
}

/**
 * features/reports/components/InventoryReportKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-AGREGADOS: las 5 tarjetas ahora son reales — usa
 * `useInventoryReportSummary(filters)` (`GET /reports/inventory/summary`,
 * nuevo), calculado en el backend sobre el conjunto COMPLETO que cumple
 * los filtros activos (`categoryId`/`sucursalId`/`active`).
 *
 * "Cantidad total" (version anterior con placeholder) se retira en vez de
 * activarse: `Inventory.quantity` mezcla `unitOfMeasure` (`KILOGRAM`/
 * `UNIT`) segun el producto — sumarla no tiene sentido dimensional, sin
 * importar que el backend ya la traiga agregada (mismo motivo ya
 * documentado en `LowStockKpiRow.tsx`). En su lugar, "Sucursales" (conteo
 * de sucursales distintas dentro del filtro activo) es un dato real y
 * comparable sin importar la unidad de cada producto.
 *
 * "Bajo punto de reorden": se evaluo y se descarto reutilizar
 * `useLowStock` (no acepta el filtro `active` que si soporta esta
 * pantalla) — el nuevo endpoint lo resuelve correctamente sobre el MISMO
 * `buildInventoryReportWhere` que ya usa la tabla paginada.
 */
export function InventoryReportKpiRow({ filters }: InventoryReportKpiRowProps) {
  const { data, isLoading } = useInventoryReportSummary(filters)

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        bare
        label="Existencias"
        value={isLoading ? <KpiValueSkeleton /> : (data?.totalRecords ?? '—')}
        icon={Boxes}
        size="xs"
      />
      <KpiCard
        bare
        label="Bajo punto de reorden"
        value={isLoading ? <KpiValueSkeleton /> : (data?.belowReorderPoint ?? '—')}
        icon={TriangleAlert}
        size="xs"
      />
      <KpiCard
        bare
        label="Sin existencias"
        value={isLoading ? <KpiValueSkeleton /> : (data?.outOfStock ?? '—')}
        icon={CircleOff}
        size="xs"
      />
      <KpiCard
        bare
        label="Productos distintos"
        value={isLoading ? <KpiValueSkeleton /> : (data?.distinctProducts ?? '—')}
        icon={Tag}
        size="xs"
      />
      <KpiCard
        bare
        label="Sucursales"
        value={isLoading ? <KpiValueSkeleton /> : (data?.distinctSucursales ?? '—')}
        icon={Store}
        size="xs"
      />
    </div>
  )
}
