import { Scale } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'

interface CashArqueoPanelProps {
  openingAmount: number
  cashSalesTotal: number
  totalIngresos: number
  totalEgresos: number
  /** `null` mientras el usuario todavía no escribió nada en "Monto
   * contado" — la diferencia no tiene sentido mostrarla hasta ese punto. */
  countedAmount: number | null
}

/**
 * features/cashSession/components/CashArqueoPanel.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Caja — pestaña "Cerrar caja": arqueo asistido. "Monto
 * esperado" = apertura + ventas en efectivo + ingresos − egresos, los
 * mismos 4 números ya usados en el panel superior persistente
 * (`deriveCashSessionInsights`/`CashSessionSummaryKpis`) — ningún cálculo
 * nuevo, solo se suman/restan acá. La diferencia se recalcula en cada
 * render porque `countedAmount` llega ya actualizado en vivo desde
 * `CloseCashSessionForm` (`onClosingAmountChange`), sin estado propio.
 */
export function CashArqueoPanel({
  openingAmount,
  cashSalesTotal,
  totalIngresos,
  totalEgresos,
  countedAmount,
}: CashArqueoPanelProps) {
  const expectedAmount = openingAmount + cashSalesTotal + totalIngresos - totalEgresos
  const difference = countedAmount !== null ? countedAmount - expectedAmount : null

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-brand/30 bg-brand/5 p-4">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand uppercase">
        <Scale className="size-3.5" />
        Arqueo
      </h3>

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Apertura</span>
          <span className="tabular-nums">{formatCurrency(openingAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">+ Ventas en efectivo</span>
          <span className="tabular-nums">{formatCurrency(cashSalesTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">+ Ingresos</span>
          <span className="tabular-nums">{formatCurrency(totalIngresos)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">− Egresos</span>
          <span className="tabular-nums">-{formatCurrency(totalEgresos)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-brand/30 pt-2">
          <span className="font-semibold text-brand">Esperado</span>
          <span className="text-lg font-extrabold tabular-nums text-brand">
            {formatCurrency(expectedAmount)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-brand/30 pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Contado</span>
          <span className="tabular-nums">{countedAmount !== null ? formatCurrency(countedAmount) : '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Diferencia</span>
          {difference === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                'font-bold tabular-nums',
                difference === 0 ? 'text-success' : difference > 0 ? 'text-info' : 'text-destructive',
              )}
            >
              {difference > 0 ? '+' : ''}
              {formatCurrency(difference)}
            </span>
          )}
        </div>
        {difference !== null && (
          <Badge
            variant={difference === 0 ? 'secondary' : 'destructive'}
            className="mt-1 w-fit"
          >
            {difference === 0 ? 'Cuadra' : difference > 0 ? 'Sobrante' : 'Faltante'}
          </Badge>
        )}
      </div>
    </div>
  )
}
