/**
 * shared/services/permissionCache.service.ts
 * -----------------------------------------------------------------------------
 * Hallazgo de rendimiento #3 (auditoria 31/07/2026): cache en memoria del
 * propio proceso para `roles.service.ts::hasPermission()` -- evaluada en
 * practicamente cada request autenticado (`authorizePermission`,
 * `middlewares/authorize.middleware.ts`), esa funcion consultaba la base de
 * datos completa (rol + todos sus permisos) en cada llamada, pese a que
 * roles/permisos cambian con muy poca frecuencia (administracion, no
 * operacion diaria).
 *
 * Sin Redis ni infraestructura externa (explicitamente fuera de alcance de
 * este bloque): un `Map` simple con TTL corto, invalidado explicitamente
 * ante cualquier mutacion de `Role`/`RolePermission`/`Permission`
 * (`roles.service.ts::create/update/changeStatus/assignPermissions`,
 * `permissions.service.ts::create/update`) -- nunca sirve una respuesta
 * obsoleta por mas del TTL, y nunca la sirve en absoluto despues de una
 * mutacion conocida.
 *
 * Vive en `shared/services/` (no dentro de `roles/` ni `permissions/`)
 * precisamente para que ambos modulos puedan invalidarla sin que ninguno
 * dependa del otro -- mismo criterio ya usado por `audit.service.ts`
 * (servicio transversal, sin dueño de dominio unico).
 *
 * Cache POR PROCESO, no compartida entre instancias -- no hay mas de una
 * instancia del backend hoy (mismo criterio ya aceptado en este proyecto
 * para el store en memoria de `express-rate-limit`,
 * `middlewares/rateLimit.middleware.ts`). Si en el futuro se agrega mas de
 * una instancia, invalidar este cache entre procesos requeriria un
 * mecanismo compartido -- fuera de alcance de este bloque.
 */
interface CacheEntry {
  permissionCodes: string[];
  expiresAt: number;
}

const TTL_MS = 60_000;

const cache = new Map<string, CacheEntry>();

/** `undefined` si no hay entrada vigente (nunca se cacheo, o vencio el TTL) --
 * en ese caso, quien llama debe resolverlo desde la base de datos y luego
 * guardarlo con `setCachedPermissionCodes`. */
export function getCachedPermissionCodes(roleName: string): string[] | undefined {
  const entry = cache.get(roleName);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(roleName);
    return undefined;
  }

  return entry.permissionCodes;
}

export function setCachedPermissionCodes(roleName: string, permissionCodes: string[]): void {
  cache.set(roleName, { permissionCodes, expiresAt: Date.now() + TTL_MS });
}

/**
 * Invalida TODO el cache -- se usa ante cualquier mutacion de Role,
 * RolePermission o Permission. Vaciar todo en vez de una sola entrada es
 * deliberado: es una cache pequeña (una entrada por nombre de rol,
 * tipicamente unos pocos roles), las mutaciones son poco frecuentes, y
 * evita tener que rastrear que roles se ven afectados por un cambio de
 * `Permission.code` (podria afectar a varios roles a la vez, via
 * `RolePermission`).
 */
export function invalidatePermissionCache(): void {
  cache.clear();
}
