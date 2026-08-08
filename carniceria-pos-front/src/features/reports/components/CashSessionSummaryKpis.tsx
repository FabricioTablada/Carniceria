import { Banknote, CreditCard, Layers, Scale, ShoppingCart, Smartphone, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/common/KpiCard'
import { formatCurrency } from '@/utils/formatCurrency'
import type { CashReportDetail } from '../types/report.types'

interface CashSessionSummaryKpisProps {
  session: CashReportDetail
  /**
   * `'compact'` (default): exactamente el mismo conjunto y tamaño de
   * tarjetas que ya mostraba `CashSessionDetailPage.tsx` antes de esta
   * extraccion (Ventas, Total vendido, Efectivo, Tarjeta, SINPE,
   * Diferencia si aplica — `size="compact"`, sin descripcion) — CERO
   * cambio visual para el modulo administrativo, que sigue llamando este
   * componente sin pasar `variant`.
   *
   * `'full'`: variante mas espaciosa (`size="default"`, con descripcion
   * corta bajo cada valor) que ademas agrega "Otros métodos" (TRANSFER +
   * MIXED, solo si hubo alguna) y "Total recibido" — pensada para el
   * panel "Resumen de mi sesión" del POS (Bloque POS-07), sin tocar el
   * comportamiento del modulo administrativo.
   */
  variant?: 'compact' | 'full'
  /** Ventas (aprobado, "copiar literalmente la franja de KPIs de
   * Productos"): cuando es `true`, cada `KpiCard` se renderiza `bare`
   * (sin Card propia) en `size="xs"` — la MISMA variante que
   * `ProductsKpiRow.tsx`/`UsersKpiRow.tsx`/el resto de las franjas de
   * KPI del ERP, para vivir como primera franja plana de un Canvas
   * Workspace (`SalesPage.tsx`) en vez de una grilla de tarjetas con
   * borde propio. Opcional, `false` por defecto: `CashSessionDetailPage.tsx`
   * (Reportes) y `CashSessionSummaryPanel.tsx` (POS) no lo pasan, sin
   * ningún cambio visual para esos dos consumidores. */
  bare?: boolean
}

/**
 * features/reports/components/CashSessionSummaryKpis.tsx
 * -----------------------------------------------------------------------------
 * Bloque POS-07: extraccion PURA (sin cambio de comportamiento) del bloque
 * de tarjetas de ventas/metodos de pago que antes vivia inline en
 * `CashSessionDetailPage.tsx` — mismo `KpiCard` compartido, mismos datos
 * (`CashReportDetail`, ya resuelto por `useCashReportDetail`), ningun
 * calculo de agregacion nuevo (todo lo que no es una simple suma de
 * campos ya presentes en `paymentBreakdown` sigue siendo responsabilidad
 * exclusiva del backend). Se usa tal cual (sin `variant`) desde
 * `CashSessionDetailPage.tsx` Y desde el nuevo panel del POS
 * (`CashSessionSummaryPanel.tsx`), evitando duplicar esta lista de
 * tarjetas en dos archivos.
 *
 * Devuelve un Fragment de `KpiCard`s (no un grid propio): quien lo usa
 * decide el contenedor/grilla, para poder intercalarlas con otras
 * tarjetas (`CashSessionDetailPage.tsx` sigue teniendo, inline y sin
 * cambios, las tarjetas de metadata — Fecha/Cajero/Caja/Sucursal/Horas —
 * en el MISMO grid).
 */
export function CashSessionSummaryKpis({
  session,
  variant = 'compact',
  bare = false,
}: CashSessionSummaryKpisProps) {
  const cash = session.paymentBreakdown.CASH
  const card = session.paymentBreakdown.CARD
  const sinpe = session.paymentBreakdown.SINPE_MOVIL
  const transfer = session.paymentBreakdown.TRANSFER
  const mixed = session.paymentBreakdown.MIXED

  const otherTotal = transfer.total + mixed.total
  const otherCount = transfer.count + mixed.count
  const receivedTotal = cash.total + card.total + sinpe.total + otherTotal

  const isFull = variant === 'full'
  // `bare` fuerza `size="xs"` (misma variante que el resto de las
  // franjas de KPI del ERP) y nunca muestra `description` (la franja
  // plana no tiene espacio para una segunda línea, mismo criterio que
  // `ProductsKpiRow.tsx`).
  const size = bare ? 'xs' : isFull ? 'default' : 'compact'

  return (
    <>
      <KpiCard
        bare={bare}
        label={isFull ? 'Ventas' : 'Cantidad de ventas'}
        value={session.salesCount}
        icon={ShoppingCart}
        size={size}
        description={!bare && isFull ? 'Cantidad de ventas' : undefined}
      />
      <KpiCard
        bare={bare}
        label="Total vendido"
        value={formatCurrency(session.salesTotal)}
        icon={Scale}
        size={size}
        description={!bare && isFull ? 'Monto total' : undefined}
      />
      <KpiCard
        bare={bare}
        label={isFull ? 'Efectivo' : 'Total en efectivo'}
        value={formatCurrency(cash.total)}
        icon={Banknote}
        size={size}
        description={!bare && isFull ? 'Recibido en efectivo' : undefined}
      />
      <KpiCard
        bare={bare}
        label={isFull ? 'Tarjeta' : 'Total en tarjeta'}
        value={formatCurrency(card.total)}
        icon={CreditCard}
        size={size}
        description={!bare && isFull ? 'Recibido con tarjeta' : undefined}
      />
      <KpiCard
        bare={bare}
        label={isFull ? 'SINPE' : 'Total SINPE'}
        value={formatCurrency(sinpe.total)}
        icon={Smartphone}
        size={size}
        description={!bare && isFull ? 'Recibido por SINPE' : undefined}
      />

      {isFull && otherCount > 0 && (
        <KpiCard
          bare={bare}
          label="Otros"
          value={formatCurrency(otherTotal)}
          icon={Layers}
          size={size}
          description={!bare ? 'Otros métodos' : undefined}
        />
      )}

      {isFull && (
        <KpiCard
          bare={bare}
          label="Total recibido"
          value={formatCurrency(receivedTotal)}
          icon={Wallet}
          size={size}
          tone="success"
          description={!bare ? 'Suma total recibida' : undefined}
        />
      )}

      {session.difference !== null && (
        <KpiCard
          bare={bare}
          label={isFull ? 'Diferencia' : 'Diferencia de caja'}
          value={formatCurrency(session.difference)}
          icon={Banknote}
          size={size}
          description={!bare && isFull ? 'Esperado vs recibido' : undefined}
          className={!bare && session.difference < 0 ? 'border-destructive/30' : undefined}
        />
      )}
    </>
  )
}
