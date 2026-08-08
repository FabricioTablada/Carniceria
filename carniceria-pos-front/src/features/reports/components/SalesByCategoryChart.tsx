import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/utils/formatCurrency'
import type { SalesByCategoryItem } from '../types/report.types'

// Mismos tokens de color ya definidos en index.css (`--brand`,
// `--chart-1..5`) — ninguna paleta nueva se inventa aca. Se ciclan por
// barra para distinguir cada categoria, mismo criterio ya usado en
// SalesByCategoryDonutChart.tsx/TopProductsChart.tsx.
const BAR_COLORS = [
  'var(--brand)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
]

/**
 * features/reports/components/SalesByCategoryChart.tsx
 * -----------------------------------------------------------------------------
 * Componente de presentacion pura: recibe `items` ya cargados por props, sin
 * llamar a `useSalesByCategory` ni a ninguna API por si mismo — mismo
 * criterio ya usado en `DashboardSummaryCards.tsx` (recibe `data`, no lo
 * obtiene). Vive en `reports/components/`, junto a `SalesByCategoryTable.tsx`
 * (misma fuente de datos, presentacion distinta) y `DashboardSummaryCards.tsx`
 * (el otro componente visual del Dashboard).
 *
 * `categoryName` como etiqueta del eje X, `totalSalesAmount` como valor de
 * la barra — los dos campos pedidos, sin agregar ninguna serie adicional
 * que no se pidio (`totalQuantitySold`/`salesCount` quedan sin usar aqui).
 *
 * Usa `--chart-1`, el token de color ya definido en `index.css` desde el
 * inicio del proyecto pero sin ningun consumidor real hasta ahora.
 */

interface SalesByCategoryChartProps {
  items: SalesByCategoryItem[]
}

export function SalesByCategoryChart({ items }: SalesByCategoryChartProps) {
  return (
    <div className="h-80 w-full rounded-xl bg-muted/30 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="categoryName"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tickFormatter={(value: number) => formatCurrency(value)}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            cursor={{ fill: 'var(--muted)' }}
            contentStyle={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08))',
            }}
          />
          <Bar dataKey="totalSalesAmount" name="Importe vendido" radius={[6, 6, 0, 0]}>
            {items.map((item, index) => (
              <Cell
                key={item.categoryId ?? item.categoryName}
                fill={BAR_COLORS[index % BAR_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}