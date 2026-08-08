export type NotificationType =
  | 'NEGATIVE_STOCK'
  | 'LOW_STOCK'
  | 'PENDING_PURCHASE'
  | 'CASH_SESSION_OPEN_TOO_LONG'

export type NotificationSeverity = 'critical' | 'warning' | 'info'

export interface NotificationItem {
  id: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  createdAt: string
  link: string
  entityId: string
}

/**
 * Forma derivada, solo de frontend — el backend nunca devuelve esto (ver
 * `GET /notifications`, que sigue respondiendo `NotificationItem[]` sin
 * cambios). Un grupo resume todas las `NotificationItem` de un mismo
 * `type` en una sola fila ("15 productos con stock bajo" en vez de 15
 * filas) — `NotificationPanel.tsx` construye esta forma a partir de la
 * respuesta cruda; no existe ningun endpoint ni hook que la produzca
 * directamente.
 */
export interface NotificationGroup {
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  link: string
  count: number
  /** `createdAt` mas reciente entre los elementos del grupo. */
  latestCreatedAt: string
  /** `entityId` de cada elemento del grupo, en el mismo orden en que
   * llegaron — QA-006B: permite que la accion rapida de
   * `NotificationItem.tsx` navegue a una entidad especifica (ej. "abrir
   * esta compra") cuando el grupo tiene un unico elemento y esa accion no
   * es ambigua. */
  entityIds: string[]
}
