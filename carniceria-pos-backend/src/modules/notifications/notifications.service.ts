/**
 * modules/notifications/notifications.service.ts
 * -----------------------------------------------------------------------------
 * Agrega, en una unica respuesta, las alertas operativas que ya son
 * derivables del estado actual del sistema. No introduce ninguna tabla ni
 * logica de negocio nueva: unicamente invoca los servicios de dominio ya
 * aprobados de Reports, Cash y Purchases (expuestos explicitamente para
 * consumo cross-modulo via el `index.ts` de cada uno, mismo criterio ya
 * usado por `modules/products/index.ts`) y traduce sus resultados a la
 * forma comun `NotificationItem`. Este servicio no consulta Prisma
 * directamente ni decide reglas de negocio de esos modulos (ej. que
 * cuenta como "bajo stock" sigue siendo responsabilidad exclusiva de
 * `reports.service.ts`); solo interpreta esos resultados para priorizar
 * y presentar alertas.
 *
 * Sin persistencia, sin "marcar como leida", sin polling/WebSockets: cada
 * llamada recalcula el estado actual en tiempo real (ver analisis previo,
 * seccion 3 — las condiciones de origen son fotos del estado, no eventos
 * que deban recordarse).
 */
import { getLowStock, type LowStockItem } from '@/modules/reports';
import { findSessions, type CashSessionResponse } from '@/modules/cash';
import { findMany as findPurchases, type PurchaseResponse } from '@/modules/purchases';
import type { NotificationItem } from './types';

/** Cantidad de sesiones/compras a traer por consulta: en la practica el
 * numero de sesiones abiertas o compras en borrador de una operacion es
 * bajo; 100 alcanza para no truncar en un uso real sin necesitar
 * paginacion completa en este agregador. */
const MAX_ITEMS_PER_SOURCE = 100;

/** Horas de sesion de caja abierta a partir de las cuales se considera
 * "tiempo prolongado". Un turno normal no deberia superar este umbral. */
const OPEN_SESSION_ALERT_THRESHOLD_HOURS = 12;

/** Inventario con `quantity < 0`: el peor caso posible, independientemente
 * de si el producto tiene `reorderPoint` configurado. */
function buildNegativeStockNotifications(rows: LowStockItem[]): NotificationItem[] {
  return rows
    .filter((row) => row.quantity < 0)
    .map((row) => ({
      id: `negative-stock:${row.inventoryId}`,
      type: 'NEGATIVE_STOCK',
      severity: 'critical',
      title: 'Inventario negativo',
      message: `"${row.productName}" tiene ${row.quantity} unidades en ${row.sucursalName}.`,
      createdAt: new Date().toISOString(),
      link: '/reports/low-stock',
      entityId: row.inventoryId,
    }));
}

/** Inventario con `quantity >= 0` pero por debajo de su propio
 * `reorderPoint`. Se excluye lo que ya cubre `NEGATIVE_STOCK` para no
 * duplicar una notificacion por la misma fila de inventario. */
function buildLowStockNotifications(rows: LowStockItem[]): NotificationItem[] {
  return rows
    .filter(
      (row) => row.quantity >= 0 && row.reorderPoint !== null && row.quantity <= row.reorderPoint,
    )
    .map((row) => ({
      id: `low-stock:${row.inventoryId}`,
      type: 'LOW_STOCK',
      severity: 'warning',
      title: 'Bajo punto de reorden',
      message: `"${row.productName}" tiene ${row.quantity} unidades (punto de reorden: ${row.reorderPoint}) en ${row.sucursalName}.`,
      createdAt: new Date().toISOString(),
      link: '/reports/low-stock',
      entityId: row.inventoryId,
    }));
}

function buildPendingPurchaseNotifications(purchases: PurchaseResponse[]): NotificationItem[] {
  return purchases.map((purchase) => ({
    id: `pending-purchase:${purchase.id}`,
    type: 'PENDING_PURCHASE',
    severity: 'info',
    title: 'Compra en borrador',
    message: `La compra ${purchase.documentNumber ?? purchase.id} de "${purchase.supplier.name}" sigue en borrador.`,
    createdAt: purchase.createdAt.toISOString(),
    link: '/purchases',
    entityId: purchase.id,
  }));
}

function buildOpenSessionNotifications(sessions: CashSessionResponse[]): NotificationItem[] {
  const now = Date.now();

  return sessions
    .filter((session) => {
      const hoursOpen = (now - session.openedAt.getTime()) / (1000 * 60 * 60);
      return hoursOpen >= OPEN_SESSION_ALERT_THRESHOLD_HOURS;
    })
    .map((session) => ({
      id: `cash-session-open:${session.id}`,
      type: 'CASH_SESSION_OPEN_TOO_LONG',
      severity: 'warning',
      title: 'Caja abierta por tiempo prolongado',
      message: `La caja de "${session.sucursal.name}" sigue abierta desde ${session.openedAt.toLocaleString('es-CR')}.`,
      createdAt: session.openedAt.toISOString(),
      link: '/cash-session/open',
      entityId: session.id,
    }));
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const [lowStockRows, openSessionsResult, draftPurchasesResult] = await Promise.all([
    getLowStock(),
    findSessions({
      page: 1,
      limit: MAX_ITEMS_PER_SOURCE,
      skip: 0,
      filters: { status: 'OPEN' },
    }),
    findPurchases({
      page: 1,
      limit: MAX_ITEMS_PER_SOURCE,
      skip: 0,
      filters: { status: 'DRAFT' },
    }),
  ]);

  return [
    ...buildNegativeStockNotifications(lowStockRows),
    ...buildLowStockNotifications(lowStockRows),
    ...buildOpenSessionNotifications(openSessionsResult.items),
    ...buildPendingPurchaseNotifications(draftPurchasesResult.items),
  ];
}
