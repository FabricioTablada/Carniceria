/**
 * modules/permissions/permissions.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de permisos.
 * Es infraestructura pura: no valida datos de entrada y no contiene reglas
 * de negocio (eso vive en `permissions.service.ts`). Usa unicamente la
 * instancia singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Permission` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListPermissionsFilters } from './permissions.types';

export function create(data: Prisma.PermissionUncheckedCreateInput) {
  return prisma.permission.create({
    data,
  });
}

export function findById(id: string) {
  return prisma.permission.findFirst({
    where: { id },
  });
}

export function findByCode(code: string) {
  return prisma.permission.findFirst({
    where: { code },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListPermissionsFilters): Prisma.PermissionWhereInput {
  if (!filters) return {};

  return {
    ...(filters.search && {
      OR: [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListPermissionsFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.permission.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.permission.count({ where }),
  ]);
}

export function update(id: string, data: Prisma.PermissionUncheckedUpdateInput) {
  return prisma.permission.update({
    where: { id },
    data,
  });
}
