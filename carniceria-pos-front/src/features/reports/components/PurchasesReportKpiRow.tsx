import { Calculator, Coins, Receipt, Truck, Users } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/utils/formatCurrency'
import { usePurchasesReportSummary } from '../hooks/usePurchasesReportSummary'
import type { PurchasesReportFilters } from '../types/report.types'

interface PurchasesReportKpiRowProps {
  /** Mismos filtros activos que ya usa `PurchasesReportPage.tsx` para la
   * tabla/paginacion (sin `page`/`limit`) — reenviados tal cual a
   * `usePurchasesReportSummary`, para que el agregado SIEMPRE refleje el
   * mismo conjunto filtrado que ve el usuario. */
  filters: Omit<PurchasesReportFilters, 'page' | 'limit'>
}

function KpiValueSkeleton() {
  return <Skeleton className="h-[1.125rem] w-10" />
}

/**
 * features/reports/components/PurchasesReportKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-AGREGADOS: las 5 tarjetas ahora son reales — usa
 * `usePurchasesReportSummary(filters)` (`GET /reports/purchases/summary`,
 * nuevo), calculado en el BACKEND sobre el conjunto COMPLETO que cumple
 * los filtros activos.
 *
 * "Proveedores" (antes placeholder): se descarto en un analisis previo
 * porque no existia ningun endpoint que contara proveedores DISTINTOS
 * dentro del conjunto filtrado — `useSuppliers` solo daba el catalogo
 * completo (mezclaba alcance global con el reporte). El nuevo endpoint
 * SI lo resuelve correctamente (`groupBy` por `supplierId` sobre el mismo
 * `where` que el resto del agregado, ver `reports.repository.ts`
 * backend) — por eso ahora tambien es un dato real.
 *
 * Mismo criterio que `SalesReportKpiRow.tsx`: recibe `filters` (no
 * autonomo, a diferencia de `ProductsKpiRow.tsx`) y resuelve las 5
 * tarjetas con una sola consulta nueva.
 */
export function PurchasesReportKpiRow({ filters }: PurchasesReportKpiRowProps) {
  const { data, isLoading } = usePurchasesReportSummary(filters)

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        bare
        label="Compras"
        value={isLoading ? <KpiValueSkeleton /> : (data?.totalPurchases ?? '—')}
        icon={Truck}
        size="xs"
      />
      <KpiCard
        bare
        label="Proveedores"
        value={isLoading ? <KpiValueSkeleton /> : (data?.totalSuppliers ?? '—')}
        icon={Users}
        size="xs"
      />
      <KpiCard
        bare
        label="Importe total comprado"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalAmount ?? 0)}
        icon={Coins}
        size="xs"
      />
      <KpiCard
        bare
        label="Impuestos pagados"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalTax ?? 0)}
        icon={Receipt}
        size="xs"
      />
      <KpiCard
        bare
        label="Ticket promedio de compra"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.averageTicket ?? 0)}
        icon={Calculator}
        size="xs"
      />
    </div>
  )
}
