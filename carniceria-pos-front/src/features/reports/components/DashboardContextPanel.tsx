import { DoorOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import type { CashSessionInsights } from '@/features/cashSession/utils/cashSessionInsights'
import type { CashSession } from '@/features/cashSession/types/cashSession.types'
import type { DashboardResponse } from '../types/report.types'
import { DashboardSummaryCards } from './DashboardSummaryCards'

export interface DashboardCashierSessionData {
  session: CashSession
  cashRegisterName?: string
  insights: CashSessionInsights
  cashSalesTotal: number
  lastSaleAt: string | null
}

interface DashboardContextPanelProps {
  /** Decide la variante del panel: Cajero (turno/caja) vs Administrador
   * (estado operativo) — resuelto por `DashboardPage.tsx` a partir de un
   * permiso ya existente (`USERS_MANAGE`), no de un literal de rol (ningun
   * otro archivo del frontend compara contra `'CASHIER'`/`'MANAGER'`, solo
   * contra `'ADMIN'` — ver `CashSessionAuditSection.tsx`). */
  isCashierView: boolean
  /** `null` = el usuario todavia no tiene una caja abierta. */
  cashierSession: DashboardCashierSessionData | null
  operationalData?: DashboardResponse
  isLoading: boolean
  onOpenCashSession: () => void
  onGoToCashSession: () => void
}

/** Duracion transcurrida desde la apertura, formateada como "Xh Ym" — mismo
 * calculo ya usado en `OpenCashSessionPage.tsx` (`formatElapsedSince`), no
 * se importa desde alli porque esa funcion es local a ese archivo (no
 * exportada); se repite la misma formula minima (una resta y dos
 * divisiones) en vez de exportar una funcion de un archivo de pagina. */
function formatElapsedSince(openedAt: string): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000))
  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * features/reports/components/DashboardContextPanel.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del Dashboard ("centro de control", aprobado): panel lateral de
 * contexto, con dos variantes segun el rol:
 *  - Cajero: informacion de su turno y caja — mismos hooks/utilidad ya
 *    construidos en el rediseño de Caja (`useCashReportDetail`,
 *    `useCashMovements` + `deriveCashSessionInsights`), resueltos por
 *    `DashboardPage.tsx` y pasados aca ya calculados (sin duplicar el
 *    calculo, mismo criterio que `CashSessionContextPanel.tsx`).
 *  - Administrador: estado operativo general y metricas administrativas —
 *    reutiliza `DashboardSummaryCards.tsx` tal cual (mismo componente que
 *    ya renderizaba estos datos, ahora en formato compacto de panel
 *    lateral en vez de fila de tarjetas).
 *
 * Mejora aprobada: panel compacto (filas de texto, no tarjetas) para evitar
 * scroll innecesario — mismo patron ya usado en
 * `CashSessionContextPanel.tsx` tras el fix de layout de Caja.
 */
export function DashboardContextPanel({
  isCashierView,
  cashierSession,
  operationalData,
  isLoading,
  onOpenCashSession,
  onGoToCashSession,
}: DashboardContextPanelProps) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>
  }

  if (isCashierView) {
    if (!cashierSession) {
      return (
        <EmptyState
          icon={DoorOpen}
          title="Sin caja abierta"
          description="Abrí una caja para empezar a vender y ver aquí el resumen de tu turno."
          action={{ label: 'Abrir caja', onClick: onOpenCashSession, variant: 'brand' }}
        />
      )
    }

    const { session, cashRegisterName, insights, cashSalesTotal, lastSaleAt } = cashierSession
    // Mismo calculo de "efectivo esperado" ya usado en CashArqueoPanel.tsx
    // (rediseño de Caja): apertura + ventas en efectivo + ingresos - egresos.
    const expectedCash = session.openingAmount + cashSalesTotal + insights.totalIngresos - insights.totalEgresos

    return (
      <div className="flex flex-col">
        <div className="flex flex-col divide-y divide-border">
          <ContextRow label="Caja" value={cashRegisterName ?? '—'} />
          <ContextRow label="Tiempo abierta" value={formatElapsedSince(session.openedAt)} />
          <ContextRow label="Ventas de la sesión" value={formatCurrency(cashSalesTotal)} />
          <ContextRow label="Efectivo esperado" value={formatCurrency(expectedCash)} />
          <ContextRow label="Ingresos" value={formatCurrency(insights.totalIngresos)} />
          <ContextRow label="Egresos" value={formatCurrency(insights.totalEgresos)} />
          <ContextRow label="Última venta" value={lastSaleAt ? formatDateTime(lastSaleAt) : '—'} />
        </div>

        <Button type="button" size="sm" className="mt-3 self-start" onClick={onGoToCashSession}>
          Ir a caja
        </Button>
      </div>
    )
  }

  if (!operationalData) {
    return <p className="text-sm text-muted-foreground">Sin datos.</p>
  }

  return <DashboardSummaryCards data={operationalData} />
}
