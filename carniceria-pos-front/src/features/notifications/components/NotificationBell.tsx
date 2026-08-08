import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { PERMISSIONS } from '@/constants/permissions'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationPanel } from './NotificationPanel'

/**
 * features/notifications/components/NotificationBell.tsx
 * -----------------------------------------------------------------------------
 * Unico punto que llama a `useNotifications()`: resuelve la lista completa
 * (para el contador) y se la pasa por props a `NotificationPanel.tsx`
 * (presentacion pura, sin hook propio) — mismo criterio de responsabilidad
 * ya usado en `src/pages/DashboardPage.tsx` (QA-006C: esa pantalla tambien
 * consume `NotificationPanel.tsx` directamente para su tarjeta "Alertas",
 * en vez de sus propias consultas — `LowStockAlert.tsx`/
 * `PendingPurchasesAlert.tsx` ya no existen).
 *
 * Controla unicamente el estado de apertura del panel (`open`/`onOpenChange`
 * del `Popover`); no se abre automaticamente ni al cargar ni al recibir
 * nuevas notificaciones. QA-006A: tambien se cierra a si mismo cuando el
 * usuario navega desde un grupo (`onNavigate={() => setOpen(false)}`) —
 * antes el popover quedaba abierto sobre la pantalla de destino.
 *
 * Integrado en `DashboardHeader.tsx` (layout de escritorio) y
 * `PosHeader.tsx` (POS) — siempre montado mientras hay sesion iniciada.
 *
 * Rediseño de layout (aprobado): `triggerClassName` opcional y aditivo —
 * el hover `hover:bg-white/[0.06]` por defecto asume un fondo oscuro
 * (correcto en `PosHeader.tsx`, que no lo pasa y sigue igual). El nuevo
 * `DashboardHeader.tsx` (fondo claro, `bg-card`) pasa un hover propio en
 * vez de reescribir el componente.
 */
interface NotificationBellProps {
  triggerClassName?: string
}

export function NotificationBell({ triggerClassName }: NotificationBellProps = {}) {
  const [open, setOpen] = useState(false)
  const { hasPermission } = usePermissions()
  const { data, isLoading, isError } = useNotifications()

  // QA Final 1.0 (Bloque 6): sin `reports.view`, `useNotifications()` ya
  // no dispara ninguna consulta (ver ese hook) — este componente tampoco
  // se renderiza, mismo criterio que el resto del ERP oculta funcionalidad
  // sin permiso (Sidebar/`Can`), en vez de mostrar una campana que nunca
  // va a tener datos.
  if (!hasPermission(PERMISSIONS.REPORTS_VIEW)) {
    return null
  }

  const notifications = data ?? []
  // El contador refleja el TOTAL de notificaciones activas (cualquier
  // severidad, incluida 'info') — antes solo sumaba critical+warning, asi
  // que si las unicas notificaciones activas eran 'info' el badge no
  // aparecia aunque el panel si tuviera contenido. El color del badge
  // sigue diferenciando por severidad: rojo si hay al menos una critica,
  // el tono de acento (ya usado para warning) para el resto — incluido el
  // caso "solo info", que antes ni siquiera llegaba a mostrarse.
  const criticalCount = notifications.filter(
    (notification) => notification.severity === 'critical',
  ).length
  const alertCount = notifications.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Notificaciones"
        className={cn(
          'relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
          'text-current transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
          triggerClassName ?? 'hover:bg-white/[0.06]',
        )}
      >
        <Bell className="size-4.5" />
        {alertCount > 0 && (
          <Badge
            variant={criticalCount > 0 ? 'destructive' : 'accent'}
            // Bloque 7.27: `ring-2 ring-background` (token existente, no un
            // color nuevo) separa visualmente el badge de lo que haya
            // detras — bell/header claro u oscuro segun donde se monte
            // (`PosHeader.tsx`/`DashboardHeader.tsx`) — mismo criterio que
            // un badge de notificaciones de sistema operativo. No cambia el
            // color/variant ni la condicion que decide si se muestra.
            className="absolute -top-1 -right-1 min-w-4 justify-center px-1 py-0 text-[0.625rem] leading-4 ring-2 ring-background"
          >
            {alertCount > 99 ? '99+' : alertCount}
          </Badge>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="p-0">
        <NotificationPanel
          notifications={notifications}
          isLoading={isLoading}
          isError={isError}
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
