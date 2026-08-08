import { Crown, Layers, PieChart, ReceiptText, Coins } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { Skeleton } from '@/components/common/Skeleton'
import { formatCurrency } from '@/utils/formatCurrency'
import type { SalesByCategoryItem } from '../types/report.types'

interface SalesByCategoryKpiRowProps {
  items: SalesByCategoryItem[]
  isLoading: boolean
}

function KpiValueSkeleton() {
  return <Skeleton className="h-[1.125rem] w-10" />
}

/**
 * features/reports/components/SalesByCategoryKpiRow.tsx
 * -----------------------------------------------------------------------------
 * Bloque REPORTES-02: a diferencia de los reportes paginados (Ventas/
 * Compras/Inventario/Utilidad), `GET /reports/sales-by-category` NO pagina
 * — `useSalesByCategory` ya devuelve el conjunto COMPLETO de categorias
 * que cumplen los filtros activos (`sucursalId`/`dateFrom`/`dateTo`), sin
 * `limit` ni `meta`. Por eso las 5 tarjetas de esta fila SI pueden
 * calcularse en el cliente sin violar ninguna regla: no es "la pagina
 * actual de N", es el 100% de los datos ya cargados para ese filtro — la
 * misma informacion que ya usan el grafico y la tabla de esta pantalla,
 * sin ninguna consulta nueva.
 *
 * "Líneas de venta" (no "Ventas"): `SalesByCategoryItem.salesCount` cuenta
 * lineas de detalle, no ventas distintas (documentado en `report.types.ts`)
 * — la etiqueta lo deja claro para no sugerir un conteo de ventas.
 */
export function SalesByCategoryKpiRow({ items, isLoading }: SalesByCategoryKpiRowProps) {
  const totalQuantitySold = items.reduce((sum, item) => sum + item.totalQuantitySold, 0)
  const totalSalesAmount = items.reduce((sum, item) => sum + item.totalSalesAmount, 0)
  const totalSalesCount = items.reduce((sum, item) => sum + item.salesCount, 0)

  const leader = items.reduce<SalesByCategoryItem | null>((top, item) => {
    if (!top || item.totalSalesAmount > top.totalSalesAmount) {
      return item
    }
    return top
  }, null)

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        bare
        label="Categorías"
        value={isLoading ? <KpiValueSkeleton /> : items.length}
        icon={PieChart}
        size="xs"
      />
      <KpiCard
        bare
        label="Cantidad vendida"
        value={isLoading ? <KpiValueSkeleton /> : totalQuantitySold}
        icon={Layers}
        size="xs"
      />
      <KpiCard
        bare
        label="Importe total"
        value={isLoading ? <KpiValueSkeleton /> : formatCurrency(totalSalesAmount)}
        icon={Coins}
        size="xs"
      />
      <KpiCard
        bare
        label="Líneas de venta"
        value={isLoading ? <KpiValueSkeleton /> : totalSalesCount}
        icon={ReceiptText}
        size="xs"
      />
      <KpiCard
        bare
        label="Categoría líder"
        value={isLoading ? <KpiValueSkeleton /> : (leader?.categoryName ?? '—')}
        icon={Crown}
        size="xs"
        tone="success"
        description={leader ? formatCurrency(leader.totalSalesAmount) : 'Sin datos'}
      />
    </div>
  )
}
