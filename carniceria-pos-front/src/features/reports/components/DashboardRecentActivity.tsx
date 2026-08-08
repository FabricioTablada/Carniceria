import type { LucideIcon } from 'lucide-react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { formatDateTime } from '@/utils/formatDateTime'

export interface RecentActivityEntry {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  timestamp: string
}

const MAX_VISIBLE = 5

interface DashboardRecentActivityProps {
  /** Entradas YA combinadas y ordenadas (mas reciente primero) por quien
   * usa este componente — mismo criterio que `SalesByDateLineChart.tsx`:
   * presentacion pura, sin fetch ni orden propios. */
  entries: RecentActivityEntry[]
  isLoading: boolean
  onViewMore: () => void
}

/**
 * features/reports/components/DashboardRecentActivity.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del Dashboard ("centro de control", aprobado): "Actividad
 * reciente" — reutiliza `useSales`/`useCashMovements`, ya usados en el
 * resto del ERP (`SalesPage.tsx`, rediseño de Caja). `useAuditLogs` no se
 * usa aca: ese hook solo dispara con un `entityId` puntual (gateado a
 * ADMIN), no sirve para un feed global — ver hallazgo del bloque de
 * analisis. Mejora aprobada: solo los ultimos 5 registros + boton "Ver más".
 */
export function DashboardRecentActivity({ entries, isLoading, onViewMore }: DashboardRecentActivityProps) {
  const visible = entries.slice(0, MAX_VISIBLE)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sin actividad reciente"
        description="Todavía no hay ventas ni movimientos registrados."
      />
    )
  }

  return (
    <div className="flex flex-col">
      {visible.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <entry.icon className="size-4 shrink-0 text-brand" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{entry.title}</span>
              <span className="truncate text-xs text-muted-foreground">{entry.detail}</span>
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDateTime(entry.timestamp)}
          </span>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 self-start"
        onClick={onViewMore}
      >
        Ver más
      </Button>
    </div>
  )
}
