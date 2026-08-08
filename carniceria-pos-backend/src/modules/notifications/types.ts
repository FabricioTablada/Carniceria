/**
 * modules/notifications/types.ts
 * -----------------------------------------------------------------------------
 * Formas publicas del Centro de Notificaciones. Este primer bloque cubre
 * unicamente las notificaciones derivadas en tiempo real (sin persistencia,
 * sin estado de "leida"): inventario negativo, bajo punto de reorden,
 * compras en borrador y cajas abiertas por tiempo prolongado.
 */

export type NotificationType =
  | 'NEGATIVE_STOCK'
  | 'LOW_STOCK'
  | 'PENDING_PURCHASE'
  | 'CASH_SESSION_OPEN_TOO_LONG';

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface NotificationItem {
  /** Clave estable derivada del origen (ej. `negative-stock:<inventoryId>`),
   * no un id de una tabla propia: no existe persistencia en este bloque. */
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  /** Momento en que la condicion empezo a ser verdad (ej. `openedAt` de la
   * sesion de caja), no un timestamp de insercion. */
  createdAt: string;
  /** Ruta interna del frontend a la que deberia navegar "Ver detalles". */
  link: string;
  /** Id de la entidad de origen (inventoryId, purchaseId, cashSessionId). */
  entityId: string;
}
