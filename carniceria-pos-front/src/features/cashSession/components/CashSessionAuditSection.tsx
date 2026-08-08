import { History, ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { formatDateTime } from '@/utils/formatDateTime'
import { useAuthStore } from '@/stores/authStore'
import { useAuditLogs } from '@/features/audit/hooks/useAuditLogs'
import type { AuditLog } from '@/features/audit/types/audit.types'

interface CashSessionAuditSectionProps {
  cashSessionId: string
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CASH_OPEN: 'Apertura de caja',
  CASH_CLOSE: 'Cierre de caja',
}

/**
 * features/cashSession/components/CashSessionAuditSection.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Caja — acción rápida "Ver auditoría" (pestaña "Movimientos"):
 * reutiliza `useAuditLogs` tal cual (mismo módulo ya construido para
 * Compras/Ventas), filtrando por `entity: 'CashSession'` — sin lógica
 * nueva. Gateado a ADMIN porque el backend de `/audit` también lo está
 * (rol, no permiso puntual), mismo criterio ya aplicado en
 * `PurchaseDetailPage.tsx`/`SaleTimeline.tsx`.
 *
 * Nota honesta: `CASH_OPEN`/`CASH_CLOSE` existen en el catálogo de
 * `AuditAction` pero el backend hoy no los emite desde
 * `modules/cash/service.ts` (verificado: sin ninguna llamada a
 * `auditService.log` en ese archivo) — esta sección mostrará "sin
 * eventos" hasta que ese módulo empiece a auditarlos, mismo caso ya
 * documentado para `PURCHASE` en Compras. No es un defecto de esta
 * pantalla ni algo que se pueda corregir sin tocar el backend.
 */
export function CashSessionAuditSection({ cashSessionId }: CashSessionAuditSectionProps) {
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN'

  const { data, isLoading } = useAuditLogs(
    isAdmin ? { entity: 'CashSession', entityId: cashSessionId, limit: 50 } : { entityId: undefined },
  )
  const logs = data?.data ?? []

  const columns: DataTableColumn<AuditLog>[] = [
    { header: 'Fecha', render: (log) => formatDateTime(log.createdAt), className: 'text-muted-foreground' },
    { header: 'Evento', render: (log) => AUDIT_ACTION_LABELS[log.action] ?? log.action, className: 'font-medium' },
    { header: 'Usuario', render: (log) => log.user?.fullName ?? '—', className: 'text-muted-foreground' },
  ]

  if (!isAdmin) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldAlert className="size-3.5" />
        Los eventos de auditoría solo son visibles para administradores.
      </p>
    )
  }

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Cargando auditoría...</p>
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sin eventos de auditoría"
        description="Todavía no hay eventos de apertura, cierre o movimientos auditados para esta sesión."
      />
    )
  }

  return (
    <DataTable
      columns={columns}
      data={logs}
      getRowKey={(log) => log.id}
      tableClassName="border-border/60 shadow-sm"
      headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
      cellClassName="px-4 py-3"
    />
  )
}
