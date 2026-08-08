/**
 * shared/constants/auditActions.constants.ts
 * -----------------------------------------------------------------------------
 * Catalogo canonico de acciones auditables (requisito #9). Centralizarlas
 * evita inconsistencias al registrar eventos desde distintos modulos.
 *
 * Sprint QA 3.3 (migracion aditiva): `SALE` e `INVENTORY_MOVEMENT` quedan
 * como valores LEGACY — ningun call-site del codigo actual los emite mas,
 * pero se conservan (nunca se eliminan del enum de Postgres ni se reescriben
 * los registros historicos de `AuditLog` que ya los usan). Los eventos
 * nuevos usan las 4 acciones especificas agregadas al final, que reemplazan
 * en el codigo el uso generico de `SALE`/`INVENTORY_MOVEMENT` para
 * anulacion/correccion/devolucion de venta y merma de inventario
 * respectivamente. Debe mantenerse sincronizado a mano con `enum AuditAction`
 * de `prisma/schema.prisma`, con `modules/audit/types.ts` (union type) y con
 * `modules/audit/validation.ts` (`z.enum`).
 */
export const AuditAction = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  PRICE_CHANGE: 'PRICE_CHANGE',
  CASH_OPEN: 'CASH_OPEN',
  CASH_CLOSE: 'CASH_CLOSE',
  PURCHASE: 'PURCHASE',
  /** @deprecated LEGACY: ya no se emite desde el codigo actual (ver
   * `SALE_VOID`/`SALE_CORRECTION`/`SALE_RETURN`). Se conserva unicamente
   * porque registros historicos de `AuditLog` ya usan este valor. */
  SALE: 'SALE',
  /** @deprecated LEGACY: ya no se emite desde el codigo actual (ver
   * `INVENTORY_WASTE`). Se conserva unicamente porque registros historicos
   * de `AuditLog` ya usan este valor. */
  INVENTORY_MOVEMENT: 'INVENTORY_MOVEMENT',
  SALE_VOID: 'SALE_VOID',
  SALE_CORRECTION: 'SALE_CORRECTION',
  SALE_RETURN: 'SALE_RETURN',
  INVENTORY_WASTE: 'INVENTORY_WASTE',
  /** Hallazgo de seguridad #6 (auditoria 31/07/2026): intento de login con
   * usuario inexistente, contrasena invalida o cuenta inactiva
   * (`auth.service.ts::login`). */
  LOGIN_FAILED: 'LOGIN_FAILED',
  /** Hallazgo de seguridad #6: un `ForbiddenError` (403) llego al
   * `errorHandler` global — el usuario estaba autenticado pero no
   * autorizado para la accion (`errorHandler.middleware.ts`). */
  ACCESS_DENIED: 'ACCESS_DENIED',
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];
