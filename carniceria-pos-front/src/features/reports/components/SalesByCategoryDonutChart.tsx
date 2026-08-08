import { PieChart as PieChartIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/utils/formatCurrency'
import type { SalesByCategoryItem } from '../types/report.types'

/**
 * features/reports/components/SalesByCategoryDonutChart.tsx
 * -----------------------------------------------------------------------------
 * Version en dona de "Ventas por categoria", exclusiva del Dashboard
 * (`DashboardPage.tsx`). No reemplaza a `SalesByCategoryChart.tsx` (barras):
 * ese componente sigue existiendo tal cual y sigue siendo usado por
 * `SalesByCategoryPage.tsx` (el reporte dedicado, que ademas muestra la
 * tabla detallada `SalesByCategoryTable.tsx`) — un cambio ahi no fue
 * pedido y un grafico de barras sigue siendo mas apto para esa
 * comparacion detallada categoria por categoria.
 *
 * Presentacion pura: recibe `items` ya cargados por props (mismo criterio
 * que `SalesByCategoryChart.tsx`), sin llamar a `useSalesByCategory` ni a
 * ninguna API por si mismo. Toda la logica de esta pantalla (orden
 * descendente, agrupar en "Otras") es transformacion de presentacion
 * sobre datos ya obtenidos — no se duplica ningun hook ni se reimplementa
 * el calculo que ya hace el backend.
 */

const TOP_CATEGORIES = 7
const MAX_VISIBLE_WITHOUT_GROUPING = 8

// Mismos tokens de color ya definidos en index.css (`--chart-1..5`,
// `--brand`) — ninguna paleta nueva se inventa aca.
const SLICE_COLORS = [
  'var(--brand)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
  'oklch(0.7 0.12 35)',
]
const OTHER_SLICE_COLOR = 'var(--muted-foreground)'

interface SalesByCategoryDonutChartProps {
  items: SalesByCategoryItem[]
}

function buildChartData(items: SalesByCategoryItem[]): SalesByCategoryItem[] {
  const sorted = [...items].sort((a, b) => b.totalSalesAmount - a.totalSalesAmount)

  if (sorted.length <= MAX_VISIBLE_WITHOUT_GROUPING) {
    return sorted
  }

  const top = sorted.slice(0, TOP_CATEGORIES)
  const rest = sorted.slice(TOP_CATEGORIES)

  const otras: SalesByCategoryItem = {
    categoryId: null,
    categoryName: 'Otras',
    totalQuantitySold: rest.reduce((sum, item) => sum + item.totalQuantitySold, 0),
    totalSalesAmount: rest.reduce((sum, item) => sum + item.totalSalesAmount, 0),
    salesCount: rest.reduce((sum, item) => sum + item.salesCount, 0),
  }

  return [...top, otras]
}

function CategoryTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: { payload: SalesByCategoryItem }[]
  total: number
}) {
  if (!active || !payload?.length) {
    return null
  }

  const item = payload[0].payload
  const percentage = total > 0 ? (item.totalSalesAmount / total) * 100 : 0

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-semibold">{item.categoryName}</p>
      <p className="text-muted-foreground">
        {formatCurrency(item.totalSalesAmount)} · {percentage.toFixed(1)}%
      </p>
    </div>
  )
}

export function SalesByCategoryDonutChart({ items }: SalesByCategoryDonutChartProps) {
  const chartData = buildChartData(items)
  const total = chartData.reduce((sum, item) => sum + item.totalSalesAmount, 0)

  if (chartData.length === 0 || total === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-xl bg-muted/30 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PieChartIcon className="size-6" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Sin ventas registradas en el período.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative aspect-square w-full shrink-0 sm:w-[42%]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="totalSalesAmount"
              nameKey="categoryName"
              innerRadius="66%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.categoryId ?? entry.categoryName}
                  fill={
                    entry.categoryName === 'Otras'
                      ? OTHER_SLICE_COLOR
                      : SLICE_COLORS[index % SLICE_COLORS.length]
                  }
                />
              ))}
            </Pie>
            <Tooltip content={<CategoryTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-6 text-center">
          <span className="text-xl font-bold text-brand">{formatCurrency(total)}</span>
          <span className="text-[11px] text-muted-foreground">Total vendido</span>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
        {chartData.map((entry, index) => (
          <li
            key={entry.categoryId ?? entry.categoryName}
            className="flex items-center gap-2.5 text-sm"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  entry.categoryName === 'Otras'
                    ? OTHER_SLICE_COLOR
                    : SLICE_COLORS[index % SLICE_COLORS.length],
              }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {entry.categoryName}
            </span>
            <span className="shrink-0 font-medium">
              {formatCurrency(entry.totalSalesAmount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
