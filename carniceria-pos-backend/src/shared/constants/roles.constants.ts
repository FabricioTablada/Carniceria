/**
 * shared/constants/roles.constants.ts
 * -----------------------------------------------------------------------------
 * Roles base del sistema. Sirven de referencia para el RBAC y la siembra
 * inicial. Los roles concretos y sus permisos se administran luego desde el
 * modulo `roles`, pero estos nombres canonicos evitan cadenas magicas dispersas.
 */
export const SystemRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
} as const;

export type SystemRoleName = (typeof SystemRole)[keyof typeof SystemRole];
