import { Crown, Layers, ReceiptText, Trophy, Coins } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatQuantity } from '@/utils/formatQuantity'
import type { TopProductItem } from '../types/report.types'

interface TopProductsKpiRowProps {
  items: TopProductItem[]
  isLoading: boolean
  /** Tamaño del ranking (`DEFAULT_LIMIT` en `TopProductsPage.tsx`) — se
   * interpola en el TITULO de cada tarjeta ("... (Top {limit})"), no solo
   * en la descripcion, para que el alcance quede explicito con solo leer
   * la etiqueta principal. */
  limit: number
}

function KpiValueSkeleton() {
  return <Skeleton className="h-[1.125rem] w-10" />
}

/**
 * features/reports/components/TopProductsKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02 (correccion aprobada): `GET /reports/top-products` no
 * pagina — devuelve un ranking ya acotado (`limit`), no el catalogo
 * completo de productos vendidos, y la respuesta no trae ningun `meta`/
 * `total` que lo indique. Por eso el alcance "Top {limit}" se agrega al
 * TITULO de cada tarjeta (no solo a la descripcion, que por jerarquia
 * visual de `KpiCard` es texto chico/muted, facil de pasar por alto) —
 * ninguna de las 5 tarjetas puede leerse como una metrica global de la
 * tienda. Calculadas sobre `items` (los mismos datos que ya usan el
 * grafico y la tabla), sin ninguna consulta nueva.
 *
 * Criterio de orden UNICO de este reporte (verificado en el backend,
 * `reports.repository.ts::getTopProducts`, `orderBy: { _sum: { quantity:
 * 'desc' } }`): "Productos mas vendidos" rankea por CANTIDAD vendida, no
 * por importe — el backend ya entrega `items` en ese orden, y ni
 * `TopProductsTable.tsx` ni `TopProductsChart.tsx` lo reordenan. Por eso
 * "Producto líder" reutiliza `items[0]` tal cual (el mismo elemento que
 * la tabla muestra primero y el gráfico dibuja primero) — NO se calcula
 * un maximo por otro campo (`totalSalesAmount`), que fue el error de la
 * correccion anterior: introducia un segundo criterio de orden distinto
 * al que realmente define este ranking. Su descripcion tambien muestra la
 * cantidad vendida (`formatQuantity`, no `formatCurrency`) — mismo motivo,
 * consistencia total con el criterio del reporte. "Importe vendido (Top
 * {limit})" sigue siendo una tarjeta aparte (un agregado real mas, no el
 * criterio de orden) — no se elimina, solo no se usa para "quien es el
 * líder".
 */
export function TopProductsKpiRow({ items, isLoading, limit }: TopProductsKpiRowProps) {
  const totalQuantitySold = items.reduce((sum, item) => sum + item.totalQuantitySold, 0)
  const totalSalesAmount = items.reduce((sum, item) => sum + item.totalSalesAmount, 0)
  const totalSalesCount = items.reduce((sum, item) => sum + item.salesCount, 0)
  const leader = items[0]

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        bare
        label={`Productos (Top ${limit})`}
        value={isLoading ? <KpiValueSkeleton /> : items.length}
        icon={Trophy}
        size="xs"
      />
      <KpiCard
        bare
        label={`Unidades vendidas (Top ${limit})`}
        value={isLoading ? <KpiValueSkeleton /> : totalQuantitySold}
        icon={Layers}
        size="xs"
      />
      <KpiCard
        bare
        label={`Importe vendido (Top ${limit})`}
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(totalSalesAmount)}
        icon={Coins}
        size="xs"
      />
      <KpiCard
        bare
        label={`Líneas de venta (Top ${limit})`}
        value={isLoading ? <KpiValueSkeleton /> : totalSalesCount}
        icon={ReceiptText}
        size="xs"
      />
      <KpiCard
        bare
        label={`Producto líder (Top ${limit})`}
        value={isLoading ? <KpiValueSkeleton /> : (leader?.name ?? '—')}
        icon={Crown}
        size="xs"
        tone="success"
        description={
          leader ? formatQuantity(leader.totalQuantitySold, leader.unitOfMeasure) : 'Sin datos'
        }
      />
    </div>
  )
}
