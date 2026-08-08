import { CheckCircle2 } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'
import type {
  NotificationGroup,
  NotificationItem as NotificationItemType,
  NotificationType,
} from '../types/notification.types'
import { NotificationItem } from './NotificationItem'

/**
 * features/notifications/components/NotificationPanel.tsx
 * -----------------------------------------------------------------------------
 * Componente de presentacion pura: recibe la lista ya cargada por props
 * (resuelta por `NotificationBell.tsx`/`src/pages/DashboardPage.tsx`, ambos
 * via `useNotifications()`), sin llamar a ningun hook ni API por si mismo.
 *
 * QA-006A: agrupa las notificaciones por `type` ANTES de renderizar — una
 * fila resumen por grupo ("15 productos con stock bajo") en vez de una
 * fila por cada `NotificationItem` individual (antes, con muchos productos
 * bajo su punto de reorden, el panel quedaba con una fila por producto,
 * enterrando cualquier alerta realmente urgente entre las demas). Es
 * agrupacion puramente de presentacion: `useNotifications.ts`, el backend
 * y el polling no cambian — esta funcion solo transforma el array ya
 * recibido, en cada render.
 *
 * La severidad de cada grupo es la misma para todos sus elementos, porque
 * el backend ya asigna una severidad fija por `type`
 * (`notifications.service.ts`: `NEGATIVE_STOCK` siempre `critical`,
 * `LOW_STOCK`/`CASH_SESSION_OPEN_TOO_LONG` siempre `warning`,
 * `PENDING_PURCHASE` siempre `info`) — agrupar por `type` nunca mezcla
 * severidades distintas en un mismo grupo.
 *
 * QA-006C: `className`/`showHeader` (ambos opcionales, `w-80 max-h-96` y
 * header "Notificaciones" por defecto — el `Popover` de
 * `NotificationBell.tsx` sigue exactamente igual) permiten reutilizar este
 * mismo componente embebido en la tarjeta "Alertas" del Dashboard
 * (`src/pages/DashboardPage.tsx`), que necesita ancho completo, sin tope
 * de alto y sin repetir el titulo "Notificaciones" (la tarjeta ya tiene su
 * propio titulo "Alertas"). Es la unica fuente de verdad de "como se ve
 * una lista de notificaciones agrupadas" — el Dashboard ya no arma su
 * propia presentacion aparte.
 */

const SEVERITY_ORDER: Record<NotificationItemType['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

/** Texto del resumen por grupo, con singular/plural correcto — los 4
 * ejemplos pedidos ("3 productos con inventario negativo", "15 productos
 * con stock bajo", "2 compras en borrador", "1 caja abierta por más de 12
 * horas") vienen literalmente de aca. */
const GROUP_MESSAGE_BUILDERS: Record<NotificationType, (count: number) => string> = {
  NEGATIVE_STOCK: (count) =>
    `${count} ${count === 1 ? 'producto' : 'productos'} con inventario negativo.`,
  LOW_STOCK: (count) =>
    `${count} ${count === 1 ? 'producto' : 'productos'} con stock bajo.`,
  PENDING_PURCHASE: (count) =>
    `${count} ${count === 1 ? 'compra' : 'compras'} en borrador.`,
  CASH_SESSION_OPEN_TOO_LONG: (count) =>
    `${count} ${count === 1 ? 'caja' : 'cajas'} abierta${count === 1 ? '' : 's'} por más de 12 horas.`,
}

/** Agrupa por `type`: `title`/`severity`/`link` se toman del primer
 * elemento del grupo (el backend ya los fija identicos para todo el mismo
 * `type`, ver comentario de arriba); `message` se reconstruye como el
 * resumen agrupado; `latestCreatedAt` es el `createdAt` mas reciente entre
 * los elementos, para no perder la nocion de "que tan reciente" es el
 * grupo. */
function groupNotifications(notifications: NotificationItemType[]): NotificationGroup[] {
  const itemsByType = new Map<NotificationType, NotificationItemType[]>()

  for (const notification of notifications) {
    const existing = itemsByType.get(notification.type)

    if (existing) {
      existing.push(notification)
    } else {
      itemsByType.set(notification.type, [notification])
    }
  }

  return Array.from(itemsByType.values()).map((items) => {
    const [first] = items
    const latestCreatedAt = items.reduce(
      (latest, item) => (item.createdAt > latest ? item.createdAt : latest),
      first.createdAt,
    )

    return {
      type: first.type,
      severity: first.severity,
      title: first.title,
      message: GROUP_MESSAGE_BUILDERS[first.type](items.length),
      link: first.link,
      count: items.length,
      latestCreatedAt,
      entityIds: items.map((item) => item.entityId),
    }
  })
}

interface NotificationPanelProps {
  notifications: NotificationItemType[]
  isLoading?: boolean
  isError?: boolean
  /** Se dispara al navegar desde un grupo (boton "Ver"/accion rapida) —
   * le permite a `NotificationBell.tsx` cerrar el popover, sin que este
   * componente ni `NotificationItem.tsx` sepan nada de ese estado.
   * Opcional: el Dashboard (sin popover que cerrar) no necesita pasarlo. */
  onNavigate?: () => void
  /** Clases adicionales para el contenedor raiz — se combinan con
   * `w-80 max-h-96` (no las reemplazan salvo que definan la misma
   * propiedad, via `cn`/tailwind-merge). */
  className?: string
  /** Oculta el encabezado "Notificaciones" — util cuando quien lo usa ya
   * tiene su propio titulo (la tarjeta "Alertas" del Dashboard). `true`
   * por defecto, igual que el comportamiento previo. */
  showHeader?: boolean
}

export function NotificationPanel({
  notifications,
  isLoading = false,
  isError = false,
  onNavigate,
  className,
  showHeader = true,
}: NotificationPanelProps) {
  const groups = groupNotifications(notifications).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )

  // Bloque 7.27: total de elementos activos (no de grupos) — misma
  // `notifications` que ya recibe el componente por props, sin ninguna
  // consulta nueva. Se muestra junto al titulo para dar contexto real
  // ("cuantas alertas hay"), sin inventar ningun dato ("leidas" no existe).
  const totalCount = notifications.length

  return (
    <div className={cn('flex max-h-96 w-80 flex-col', className)}>
      {showHeader && (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5">
          <p className="text-sm font-semibold">Notificaciones</p>
          {totalCount > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {totalCount} activa{totalCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Cargando...</p>
        )}

        {isError && (
          <p className="p-4 text-sm text-destructive">
            Ocurrió un error al cargar las notificaciones.
          </p>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="flex items-center justify-center px-4 py-10">
            <EmptyState
              icon={CheckCircle2}
              title="Todo está en orden"
              description="No hay notificaciones pendientes."
            />
          </div>
        )}

        {!isLoading && !isError && groups.length > 0 && (
          <ul className="flex flex-col divide-y divide-border/70">
            {groups.map((group) => (
              <li key={group.type}>
                <NotificationItem group={group} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
