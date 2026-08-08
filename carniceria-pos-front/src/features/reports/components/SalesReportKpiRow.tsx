import { Coins, Receipt, ShoppingCart, Tag, User } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/utils/formatCurrency'
import { useSalesReportSummary } from '../hooks/useSalesReportSummary'
import type { SalesReportFilters } from '../types/report.types'

interface SalesReportKpiRowProps {
  /** Mismos filtros activos que ya usa `SalesReportPage.tsx` para la
   * tabla/paginacion (sin `page`/`limit`) — este componente los reenvia
   * tal cual a `useSalesReportSummary`, para que el agregado SIEMPRE
   * refleje exactamente el mismo conjunto filtrado que ve el usuario. */
  filters: Omit<SalesReportFilters, 'page' | 'limit'>
}

function KpiValueSkeleton() {
  return <Skeleton className="h-[1.125rem] w-10" />
}

/**
 * features/reports/components/SalesReportKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-AGREGADOS: las 5 tarjetas ahora son reales — usa
 * `useSalesReportSummary(filters)` (`GET /reports/sales/summary`, nuevo),
 * que calcula los totales en el BACKEND sobre el conjunto COMPLETO que
 * cumple los filtros activos (nunca la pagina actual, nunca todas las
 * filas descargadas al frontend). Antes de este bloque, 4 de las 5
 * tarjetas mostraban un placeholder ("Pendiente de agregados") porque
 * `GET /reports/sales` (paginado) no exponia esta informacion — ver
 * commits previos para el analisis que confirmo esa limitacion.
 *
 * A diferencia de `ProductsKpiRow.tsx` (autonomo, refleja el catalogo
 * COMPLETO sin importar ningun filtro de la pagina), TODAS las tarjetas
 * de esta fila deben reflejar el resultado FILTRADO actual — por eso
 * recibe `filters` como prop (los mismos que la tabla/paginacion) en vez
 * de filtrar por su cuenta o no filtrar en absoluto.
 *
 * Una sola consulta nueva (`useSalesReportSummary`) resuelve las 5
 * tarjetas a la vez — no hay una peticion por tarjeta.
 *
 * Centro de Análisis (aprobado): de grilla de `KpiCard` con tarjeta propia
 * (`size="compact"`) a franja `bare`/`xs`/`divide-x` — mismo estándar ya
 * aplicado en Productos/Categorías/Usuarios/Compras, para vivir como
 * primera franja del Canvas Workspace único de `SalesReportPage.tsx` en
 * vez de una tarjeta flotante aparte. Mismos datos, mismo hook.
 */
export function SalesReportKpiRow({ filters }: SalesReportKpiRowProps) {
  const { data, isLoading } = useSalesReportSummary(filters)

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        bare
        label="Ventas"
        value={isLoading ? <KpiValueSkeleton /> : (data?.totalSales ?? '—')}
        icon={ShoppingCart}
        size="xs"
      />
      <KpiCard
        bare
        label="Importe total"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalAmount ?? 0)}
        icon={Coins}
        size="xs"
      />
      <KpiCard
        bare
        label="Descuentos"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalDiscount ?? 0)}
        icon={Tag}
        size="xs"
      />
      <KpiCard
        bare
        label="Impuestos"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.totalTax ?? 0)}
        icon={Receipt}
        size="xs"
      />
      <KpiCard
        bare
        label="Ticket promedio"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(data?.averageTicket ?? 0)}
        icon={User}
        size="xs"
      />
    </div>
  )
}
