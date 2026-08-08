/**
 * features/audit/types/audit.types.ts
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — pestaña "Auditoría" del detalle de compra: primer
 * consumidor frontend de `GET /audit` (`modules/audit`, backend). El
 * endpoint ya existía y no se modifica; este módulo solo lo consume por
 * primera vez. Contrato idéntico al backend (`modules/audit/types.ts`),
 * mismo criterio que el resto de módulos del ERP: mismos nombres de
 * propiedad, misma opcionalidad y nulabilidad. `createdAt` se tipa como
 * `string` (igual que en el resto del frontend) porque así viaja por HTTP.
 *
 * Restringido a `ADMIN` en el backend (`audit/routes.ts`) — no `ADMIN,
 * MANAGER` como el resto de módulos — dada la naturaleza sensible del
 * historial. El frontend no usa `Can`/`usePermissions` para ocultar esta
 * pestaña (esas rutas están gateadas por PERMISO, no por rol): se comprueba
 * `user.role === 'ADMIN'` directamente (`useAuthStore`), reflejando el
 * mismo criterio de acceso que ya aplica el backend.
 */
export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'PRICE_CHANGE'
  | 'CASH_OPEN'
  | 'CASH_CLOSE'
  | 'PURCHASE'
  | 'SALE'
  | 'INVENTORY_MOVEMENT'
  | 'SALE_VOID'
  | 'SALE_CORRECTION'
  | 'SALE_RETURN'
  | 'INVENTORY_WASTE'
  | 'LOGIN_FAILED'
  | 'ACCESS_DENIED'

export interface AuditLog {
  id: string
  sucursalId: string
  userId: string | null
  action: AuditAction
  entity: string
  entityId: string | null
  ip: string | null
  before: unknown
  after: unknown
  metadata: unknown
  sucursal: {
    id: string
    code: string
    name: string
  }
  user: {
    id: string
    fullName: string
  } | null
  createdAt: string
}

export interface AuditLogFilters {
  sucursalId?: string
  userId?: string
  action?: AuditAction
  entity?: string
  entityId?: string
  page?: number
  limit?: number
}

/** Respuesta real de GET /audit — mismo sobre (`ApiSuccess<T>` +
 * `PaginationMeta`) que `PaginatedPurchasesResponse`. */
export interface PaginatedAuditLogsResponse {
  success: true
  data: AuditLog[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
