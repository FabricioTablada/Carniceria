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
import { formatQuantity } from '@/utils/formatQuantity'
import type { TopProductItem } from '../types/report.types'

// Mismos tokens de color ya definidos en index.css (`--brand`,
// `--chart-1..5`) — ninguna paleta nueva se inventa aca. Se ciclan por
// barra para distinguir cada producto del ranking, mismo criterio ya
// usado en SalesByCategoryDonutChart.tsx.
const BAR_COLORS = [
  'var(--brand)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
]

/**
 * features/reports/components/TopProductsChart.tsx
 * -----------------------------------------------------------------------------
 * Componente de presentacion pura: recibe `items` ya cargados por props, sin
 * llamar a `useTopProducts` ni a ninguna API por si mismo — mismo criterio ya
 * usado en `SalesByCategoryChart.tsx`. Vive en `reports/components/`, junto a
 * `TopProductsTable.tsx` (misma fuente de datos, presentacion distinta).
 *
 * Bloque REPORTES-02 (correccion aprobada, "criterio unico de negocio"):
 * la barra representa `totalQuantitySold` (cantidad vendida) — antes
 * mostraba `totalSalesAmount` (importe), mientras el orden de `items`
 * viene del backend ordenado por CANTIDAD (`reports.repository.ts::
 * getTopProducts`, `orderBy: { _sum: { quantity: 'desc' } }`). Con el
 * criterio anterior, el grafico dibujaba un valor distinto al que
 * realmente define el ranking — las barras no bajaban de mayor a menor.
 * Ahora barra/orden usan el mismo campo, sin reordenar `items`.
 *
 * El eje Y usa numeros simples (sin sufijo de unidad): los productos del
 * ranking pueden mezclar `unitOfMeasure` distintos (kg/u.) en el mismo
 * grafico, asi que un unico eje no puede etiquetarse con una unidad fija.
 * El tooltip si conoce el item puntual de cada barra (via `payload`), por
 * eso ahi se usa `formatQuantity(value, unitOfMeasure)` — mismo formateo
 * ya usado en `TopProductsTable.tsx`.
 */

interface TopProductsChartProps {
  items: TopProductItem[]
}

export function TopProductsChart({ items }: TopProductsChartProps) {
  return (
    <div className="h-80 w-full rounded-xl bg-muted/30 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value, _name, props) =>
              formatQuantity(Number(value), (props.payload as TopProductItem).unitOfMeasure)
            }
            cursor={{ fill: 'var(--muted)' }}
            contentStyle={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08))',
            }}
          />
          <Bar dataKey="totalQuantitySold" name="Cantidad vendida" radius={[6, 6, 0, 0]}>
            {items.map((item, index) => (
              <Cell key={item.productId} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
