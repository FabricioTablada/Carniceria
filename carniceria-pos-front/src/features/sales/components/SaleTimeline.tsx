import { ArrowLeftRight, History, PackageMinus, Receipt, ShieldAlert, Undo2 } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { useAuthStore } from '@/stores/authStore'
import { useAuditLogs } from '@/features/audit/hooks/useAuditLogs'
import { useSaleReturns } from '@/features/returns/hooks/useSaleReturns'
import type { Sale } from '../types/sale.types'

interface SaleTimelineProps {
  sale: Sale
}

interface TimelineEntry {
  date: string
  icon: typeof Receipt
  title: string
  subtitle?: string
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  SALE_VOID: 'Auditoría: venta anulada',
  SALE_CORRECTION: 'Auditoría: venta corregida',
  SALE_RETURN: 'Auditoría: devolución registrada',
}

/**
 * features/sales/components/SaleTimeline.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Ventas — pestaña "Devoluciones y auditoría": une en una sola
 * línea cronológica datos que ya existen pero vivían dispersos:
 *  - Creación de la venta (`sale.saleDate`, ya cargado con `useSale`).
 *  - Venta original/corrección (`sale.originalSale`/`sale.correctedBySale`,
 *    ya cargados) — sin fecha propia en `RelatedSaleSummary`, se usa
 *    `sale.saleDate`/`sale.updatedAt` como proxy honesto (mismo criterio ya
 *    documentado para "último movimiento" en Inventario).
 *  - Devoluciones (`useSaleReturns`, ya usado por `SaleReturnHistory.tsx`).
 *  - Auditoría (`useAuditLogs`, ya construido para Compras — mismo patrón,
 *    `entity: 'Sale'`). Gateada a `ADMIN` porque el backend de `/audit`
 *    también lo está (rol, no permiso puntual) — mismo criterio que
 *    `PurchaseDetailPage.tsx`.
 *
 * Sin ningún cálculo/consulta nuevo: solo mezcla y ordena datos que ya se
 * piden en otros lugares del propio módulo.
 */
export function SaleTimeline({ sale }: SaleTimelineProps) {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN'

  const { data: returnsResponse } = useSaleReturns(sale.id)
  const returns = returnsResponse?.data ?? []

  const { data: auditResponse, isLoading: isLoadingAudit } = useAuditLogs(
    isAdmin ? { entity: 'Sale', entityId: sale.id, limit: 50 } : { entityId: undefined },
  )
  const auditLogs = auditResponse?.data ?? []

  const entries: TimelineEntry[] = [
    {
      date: sale.saleDate,
      icon: Receipt,
      title: 'Venta creada',
      subtitle: sale.user.fullName,
    },
    ...(sale.originalSale
      ? [
          {
            date: sale.saleDate,
            icon: ArrowLeftRight,
            title: `Corrige a ${sale.originalSale.documentNumber ?? sale.originalSale.id}`,
          },
        ]
      : []),
    ...(sale.correctedBySale
      ? [
          {
            date: sale.updatedAt,
            icon: ArrowLeftRight,
            title: `Reemplazada por ${sale.correctedBySale.documentNumber ?? sale.correctedBySale.id}`,
          },
        ]
      : []),
    ...returns.map((saleReturn) => ({
      date: saleReturn.createdAt,
      icon: Undo2 as typeof Receipt,
      title: 'Devolución registrada',
      subtitle: `${formatCurrency(saleReturn.totalAmount)} · ${saleReturn.user.fullName}`,
    })),
    ...(isAdmin
      ? auditLogs.map((log) => ({
          date: log.createdAt,
          icon: (log.action === 'SALE_VOID' ? PackageMinus : ShieldAlert) as typeof Receipt,
          title: AUDIT_ACTION_LABELS[log.action] ?? `Auditoría: ${log.action}`,
          subtitle: log.user?.fullName,
        }))
      : []),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="flex flex-col gap-4">
      {!isAdmin && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5" />
          Los eventos de auditoría solo son visibles para administradores.
        </p>
      )}

      {isAdmin && isLoadingAudit && (
        <p className="text-xs text-muted-foreground">Cargando auditoría...</p>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin eventos registrados"
          description="Esta venta todavía no tiene correcciones, devoluciones ni eventos de auditoría."
        />
      ) : (
        <div className="flex flex-col">
          {entries.map((entry, index) => {
            const Icon = entry.icon
            return (
              <div key={index} className="relative flex gap-3 pb-5 pl-1 last:pb-0">
                {index < entries.length - 1 && (
                  <span className="absolute top-6 left-[11px] h-full w-px bg-border" aria-hidden="true" />
                )}
                <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Icon className="size-3.5" />
                </span>
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <span className="font-mono text-xs text-muted-foreground">{formatDateTime(entry.date)}</span>
                  <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                  {entry.subtitle && <span className="text-xs text-muted-foreground">{entry.subtitle}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
