/**
 * features/permissions/constants/permission.constants.ts
 * -----------------------------------------------------------------------------
 * `PERMISSIONS_CATALOG_LIMIT`: techo explícito para pedir el catálogo de
 * permisos COMPLETO en una sola página, en vez del default de 20 por
 * página del backend. El catálogo real hoy tiene ~34 permisos — este valor
 * deja margen amplio para que el catálogo crezca sin superar el límite.
 *
 * Usado por `PermissionsPage.tsx` (listado agrupado por módulo, necesita
 * el catálogo entero para agrupar/ordenar correctamente) y por
 * `EditRolePage.tsx` (`RolePermissionSelector` no pagina: si faltara un
 * permiso por quedar fuera de la primera página, no podría verse ni
 * desmarcarse aunque siguiera asignado al rol — causa raíz ya confirmada
 * de un bug real con `users.manage`).
 */
export const PERMISSIONS_CATALOG_LIMIT = 200
