/**
 * modules/roles/roles.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de roles.
 * Es infraestructura pura: no valida datos de entrada y no contiene reglas
 * de negocio (eso vive en `roles.service.ts`). Usa unicamente la instancia
 * singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Role` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListRolesFilters } from './roles.types';

/** Incluye los permisos asignados al rol a traves de la tabla puente. */
const roleWithPermissionsInclude = {
  rolePermissions: {
    include: {
      permission: {
        select: {
          id: true,
          code: true,
          description: true,
        },
      },
    },
  },
} as const;

/**
 * Hallazgo de seguridad #5 (auditoria 31/07/2026): resuelve los `code` de un
 * conjunto de `permissionIds` — usado por `roles.service.ts` para verificar,
 * ANTES de reemplazar los permisos de un rol de sistema, que el conjunto
 * entrante siga incluyendo `roles.manage` (evita que el propio rol ADMIN
 * quede sin forma de administrar roles/permisos).
 */
export function permissionCodesForIds(permissionIds: string[]): Promise<{ code: string }[]> {
  return prisma.permission.findMany({
    where: { id: { in: permissionIds } },
    select: { code: true },
  });
}

export function create(data: Prisma.RoleUncheckedCreateInput, permissionIds?: string[]) {
  return prisma.role.create({
    data: {
      ...data,
      ...(permissionIds &&
        permissionIds.length > 0 && {
          rolePermissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        }),
    },
    include: roleWithPermissionsInclude,
  });
}

export function findById(id: string) {
  return prisma.role.findFirst({
    where: { id },
    include: roleWithPermissionsInclude,
  });
}

export function findByName(name: string) {
  return prisma.role.findFirst({
    where: { name },
    include: roleWithPermissionsInclude,
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListRolesFilters): Prisma.RoleWhereInput {
  if (!filters) return {};

  return {
    active: filters.active,
    isSystem: filters.isSystem,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListRolesFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.role.findMany({
      where,
      include: roleWithPermissionsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.role.count({ where }),
  ]);
}

export function update(id: string, data: Prisma.RoleUncheckedUpdateInput) {
  return prisma.role.update({
    where: { id },
    data,
    include: roleWithPermissionsInclude,
  });
}

export function changeStatus(id: string, active: boolean) {
  return prisma.role.update({
    where: { id },
    data: { active },
    include: roleWithPermissionsInclude,
  });
}

/** Reemplaza el conjunto completo de permisos asignados al rol. */
export function assignPermissions(id: string, permissionIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });

    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
    }

    return tx.role.findFirst({
      where: { id },
      include: roleWithPermissionsInclude,
    });
  });
}
