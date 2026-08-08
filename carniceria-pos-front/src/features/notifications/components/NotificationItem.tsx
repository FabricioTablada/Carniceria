import { useNavigate } from 'react-router-dom'
import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/formatDateTime'
import type {
  NotificationGroup,
  NotificationSeverity,
  NotificationType,
} from '../types/notification.types'

/**
 * features/notifications/components/NotificationItem.tsx
 * -----------------------------------------------------------------------------
 * Componente de presentacion pura: recibe un `NotificationGroup` ya
 * resuelto por props (agrupado por `NotificationPanel.tsx`), sin llamar a
 * `useNotifications` ni a ninguna API por si mismo — mismo criterio ya
 * usado en `SalesByCategoryDonutChart.tsx`/`DashboardSummaryCards.tsx`.
 *
 * QA-006A: antes recibia una `NotificationItem` individual (una fila por
 * elemento); ahora recibe el grupo ya resumido — la iconografia por
 * severidad (`SEVERITY_ICON`/`SEVERITY_ICON_CLASSNAME`, sin cambios) y la
 * navegacion (`link`, sin cambios: sigue siendo el que ya resuelve el
 * backend) se conservan identicas, solo cambia que el texto es el resumen
 * del grupo en vez del detalle de un unico elemento.
 *
 * El boton "Ver" ahora tambien llama a `onNavigate` (ademas de navegar) —
 * le permite a `NotificationBell.tsx` cerrar el popover al navegar, que
 * antes se quedaba abierto sobre la pantalla de destino.
 *
 * QA-006B: agrega una accion rapida contextual junto a "Ver", cuando tiene
 * sentido para el `type` del grupo — reutiliza rutas ya existentes, no
 * crea ninguna pantalla nueva:
 * - LOW_STOCK/NEGATIVE_STOCK -> "Reabastecer" (`/purchases/new`, el mismo
 *   flujo de creacion de compra ya construido, con `ProductSearchDialog`
 *   para elegir los productos). Tiene sentido sin importar cuantos
 *   productos tenga el grupo — no es una accion sobre una entidad puntual.
 * - PENDING_PURCHASE -> "Abrir compra" (`/purchases/:id`, el detalle ya
 *   existente) — solo cuando el grupo tiene un unico elemento; con mas de
 *   una compra en borrador, "la compra correspondiente" es ambigua y "Ver"
 *   (la lista) ya cubre ese caso.
 * - CASH_SESSION_OPEN_TOO_LONG -> "Gestionar caja" (`/cash-session/:id/close`,
 *   la pantalla de cierre ya existente) — mismo criterio de unicidad que
 *   PENDING_PURCHASE.
 * Ambos botones cierran el popover al navegar (`onNavigate`), igual que
 * "Ver".
 */

const SEVERITY_ICON: Record<NotificationSeverity, typeof CircleAlert> = {
  critical: CircleAlert,
  warning: TriangleAlert,
  info: Info,
}

// Bloque 7.27: `warning`/`info` pasan a los tokens de color reales del
// proyecto (`--color-warning`/`--color-info`, ya definidos en `index.css`
// desde la Etapa 5.4 pero sin ningun consumidor todavia) en vez de los
// `amber-500`/`sky-600` literales de Tailwind que tenia este archivo —
// mismo color visual, ahora resuelto desde tokens. `critical` no cambia.
const SEVERITY_ICON_CLASSNAME: Record<NotificationSeverity, string> = {
  critical: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
}

// Bloque 7.27: agrupar por categoria de negocio real, pedido explicito del
// bloque — sin inventar ninguna categoria: es un mapeo 1:1 de los 4
// `NotificationType` que el backend ya emite hoy (`notifications.service.ts`
// del backend) a una etiqueta legible. Ventas/Facturacion/Usuarios NO
// aparecen aca a proposito: hoy no existe ningun `NotificationType` de esos
// dominios — agregarlos requeriria que el backend empiece a emitirlos (ver
// ROADMAP.md, Bloque 7.27, "Hallazgos").
const NOTIFICATION_CATEGORY: Record<NotificationType, string> = {
  NEGATIVE_STOCK: 'Inventario',
  LOW_STOCK: 'Inventario',
  PENDING_PURCHASE: 'Compras',
  CASH_SESSION_OPEN_TOO_LONG: 'Caja',
}

interface QuickAction {
  label: string
  to: string
}

/** Resuelve la accion rapida contextual de un grupo, o `null` si ninguna
 * aplica (ver comentario de arriba para el criterio de cada `type`). */
function getQuickAction(group: NotificationGroup): QuickAction | null {
  const singleEntityId = group.entityIds.length === 1 ? group.entityIds[0] : null

  const byType: Record<NotificationType, QuickAction | null> = {
    NEGATIVE_STOCK: { label: 'Reabastecer', to: '/purchases/new' },
    LOW_STOCK: { label: 'Reabastecer', to: '/purchases/new' },
    PENDING_PURCHASE: singleEntityId
      ? { label: 'Abrir compra', to: `/purchases/${singleEntityId}` }
      : null,
    CASH_SESSION_OPEN_TOO_LONG: singleEntityId
      ? { label: 'Gestionar caja', to: `/cash-session/${singleEntityId}/close` }
      : null,
  }

  return byType[group.type]
}

interface NotificationItemProps {
  group: NotificationGroup
  /** Se dispara al pulsar "Ver" o la accion rapida, ademas de navegar —
   * para que quien use este componente (`NotificationBell.tsx`) pueda
   * cerrar el popover. Opcional: el Dashboard (QA-006C, sin popover que
   * cerrar) no necesita pasarlo. */
  onNavigate?: () => void
}

export function NotificationItem({ group, onNavigate }: NotificationItemProps) {
  const navigate = useNavigate()
  const Icon = SEVERITY_ICON[group.severity]
  const quickAction = getQuickAction(group)

  const handleNavigate = (to: string) => {
    navigate(to)
    onNavigate?.()
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            SEVERITY_ICON_CLASSNAME[group.severity],
          )}
        >
          <Icon className="size-4.5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
              {NOTIFICATION_CATEGORY[group.type]}
            </span>
            <span className="text-[0.6875rem] text-muted-foreground/60">·</span>
            <span className="text-[0.6875rem] text-muted-foreground/60">
              {formatDateTime(group.latestCreatedAt)}
            </span>
          </div>
          <p className="text-sm font-semibold leading-snug">{group.title}</p>
          <p className="text-sm leading-snug text-muted-foreground">{group.message}</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleNavigate(group.link)}
        >
          Ver
        </Button>
        {quickAction && (
          <Button
            type="button"
            size="sm"
            onClick={() => handleNavigate(quickAction.to)}
          >
            {quickAction.label}
          </Button>
        )}
      </div>
    </div>
  )
}
