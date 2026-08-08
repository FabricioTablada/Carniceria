import {
  ShoppingCart,
  Wallet,
  Truck,
  Receipt,
  Package,
  Tags,
  Building2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'
import type { DashboardResponse } from '../types/report.types'

interface DashboardSummaryCardsProps {
  /** Metricas a mostrar. El componente no obtiene datos por si mismo. */
  data: DashboardResponse
}

interface MetricRow {
  label: string
  /** Numero crudo para los conteos; string ya formateado para los montos
   * monetarios (`formatCurrency`). Ninguna otra logica de negocio se
   * agrego junto con el formato. */
  value: number | string
  /** Mismos iconos ya usados en `navigation.ts` para el modulo
   * correspondiente (Ventas/Productos/Categorias/Proveedores/Usuarios/
   * Caja) — ninguno nuevo se inventa aca, solo se reutilizan. */
  icon: LucideIcon
}

/**
 * Rediseño del Dashboard ("centro de control", aprobado): este componente
 * ya NO es la franja hero + grilla de tarjetas de siempre — se repurpone
 * como el CONTENIDO del panel lateral de contexto para el rol
 * Administrador (`DashboardContextPanel.tsx`), en formato compacto de
 * filas de texto (mismo patron que `CashSessionContextPanel.tsx` del
 * rediseño de Caja) en vez de tarjetas, para mantenerlo compacto y evitar
 * scroll innecesario (mejora aprobada).
 *
 * NINGUN dato se elimina, solo se redistribuye: `totalProfitToday`/
 * `averageMarginToday` (antes aca, Bloque COST-04.1) ahora viven en la
 * nueva franja de KPIs del dia (`DashboardTodayKpis.tsx`) — mostrarlos
 * tambien aca seria duplicar el mismo numero dos veces en la misma
 * pantalla, no "preservar informacion". Los 9 valores restantes
 * (3 historicos + 6 de catalogo/administracion) se conservan todos,
 * ahora como filas de una sola lista compacta.
 */
export function DashboardSummaryCards({ data }: DashboardSummaryCardsProps) {
  const rows: MetricRow[] = [
    { label: 'Importe vendido (histórico)', value: formatCurrency(data.totalSalesAmount), icon: Wallet },
    { label: 'Ventas realizadas (histórico)', value: data.totalSales, icon: ShoppingCart },
    { label: 'Cajas abiertas', value: data.openCashSessions, icon: Wallet },
    { label: 'Productos', value: data.totalProducts, icon: Package },
    { label: 'Categorías', value: data.totalCategories, icon: Tags },
    { label: 'Proveedores', value: data.totalSuppliers, icon: Building2 },
    { label: 'Usuarios', value: data.totalUsers, icon: Users },
    { label: 'Compras', value: data.totalPurchases, icon: Truck },
    { label: 'Importe comprado', value: formatCurrency(data.totalPurchaseAmount), icon: Receipt },
  ]

  return (
    <div className="flex flex-col divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <row.icon className="size-3.5 shrink-0" />
            <span className="truncate">{row.label}</span>
          </span>
          <span className="shrink-0 truncate text-right font-semibold text-foreground">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}