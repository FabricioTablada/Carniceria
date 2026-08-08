import { TrendingUp } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/utils/formatCurrency'
import type { SalesByDateItem } from '../types/report.types'

/**
 * features/reports/components/SalesByDateLineChart.tsx
 * -----------------------------------------------------------------------------
 * Grafico de lineas "Ventas últimos 7 días", exclusivo del Dashboard
 * (`DashboardPage.tsx`), reemplazando el estado "Próximamente" que
 * quedaba mientras no existia `GET /reports/sales-by-date` (ver
 * `docs/BACKEND_REQUEST_sales-by-date.md`, ya implementado).
 *
 * Presentacion pura: recibe `items` ya cargados por props (mismo criterio
 * que `SalesByCategoryDonutChart.tsx`), sin llamar a `useSalesByDate` ni a
 * ninguna API por si mismo. `items` ya viene sin huecos (un item por cada
 * dia del rango, dias sin ventas en 0) — este componente no rellena nada,
 * solo grafica lo que el backend ya entrego continuo.
 */

interface SalesByDateLineChartProps {
  items: SalesByDateItem[]
}

const WEEKDAY_LABELS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** `dateStr` es `YYYY-MM-DD`. Se arma explicitamente en UTC (nunca
 * `new Date(dateStr)` a secas) para no correr el dia segun la zona
 * horaria del navegador — mismo criterio ya usado en
 * `purchase.utils.ts` (`formatPurchaseDate`). */
function formatAxisLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return `${WEEKDAY_LABELS[date.getUTCDay()]} ${String(day).padStart(2, '0')}`
}

function DateTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: SalesByDateItem }[]
}) {
  if (!active || !payload?.length) {
    return null
  }

  const item = payload[0].payload

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-semibold">{formatAxisLabel(item.date)}</p>
      <p className="text-muted-foreground">
        {formatCurrency(item.totalAmount)} ·{' '}
        {item.salesCount} {item.salesCount === 1 ? 'venta' : 'ventas'}
      </p>
    </div>
  )
}

export function SalesByDateLineChart({ items }: SalesByDateLineChartProps) {
  const hasSales = items.some((item) => item.salesCount > 0)

  if (items.length === 0 || !hasSales) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 rounded-xl bg-muted/30 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <TrendingUp className="size-6" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Sin ventas registradas en el período.
        </p>
      </div>
    )
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisLabel}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value: number) => formatCurrency(value)}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip content={<DateTooltip />} />
          <Line
            type="monotone"
            dataKey="totalAmount"
            stroke="var(--brand)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--brand)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
