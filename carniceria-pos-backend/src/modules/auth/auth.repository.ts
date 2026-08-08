/**
 * modules/auth/auth.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de autenticacion.
 * Es infraestructura pura: no valida datos de entrada, no firma tokens,
 * no compara contrasenas y no contiene reglas de negocio (eso vive en
 * `auth.service.ts`). Usa unicamente la instancia singleton de Prisma
 * expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `User` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { prisma } from '@/database';

/** Incluye la cadena Role -> RolePermission -> Permission para el usuario. */
const userWithRoleInclude = {
  role: {
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
  },
} as const;

export function findByUsername(username: string) {
  return prisma.user.findFirst({
    where: { username },
    include: userWithRoleInclude,
  });
}

export function findByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email },
    include: userWithRoleInclude,
  });
}

export function findById(id: string) {
  return prisma.user.findFirst({
    where: { id },
    include: userWithRoleInclude,
  });
}

export function updateLastLogin(id: string) {
  return prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}
