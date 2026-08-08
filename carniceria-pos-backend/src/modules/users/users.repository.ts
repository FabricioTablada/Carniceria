/**
 * modules/users/users.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de usuarios.
 * Es infraestructura pura: no valida datos de entrada, no hashea contrasenas
 * y no contiene reglas de negocio (eso vive en `users.service.ts`). Usa
 * unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `User` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListUsersFilters, LookupUsersFilters } from './users.types';

/** Incluye el resumen del Role asociado al usuario. */
const userWithRoleInclude = {
  role: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export function create(data: Prisma.UserUncheckedCreateInput) {
  return prisma.user.create({
    data,
    include: userWithRoleInclude,
  });
}

export function findById(id: string) {
  return prisma.user.findFirst({
    where: { id },
    include: userWithRoleInclude,
  });
}

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

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListUsersFilters): Prisma.UserWhereInput {
  if (!filters) return {};

  return {
    sucursalId: filters.sucursalId,
    roleId: filters.roleId,
    active: filters.active,
    ...(filters.search && {
      OR: [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListUsersFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.user.findMany({
      where,
      include: userWithRoleInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
}

/**
 * Arquitectura de selectores, Bloque 1: busqueda acotada para el patron de
 * lookup — separada de `findMany` (tabla). Busca unicamente por `fullName`
 * (indice de trigramas GIN, `schema.prisma`), no por `username`/`email`
 * como si hace la tabla completa — el `label` de un selector de
 * usuarios/cajeros es el nombre completo, no el username. `select` minimo
 * (sin `include` de `role`) y sin `count()` acompanante — ver
 * `shared/utils/lookup.ts`.
 */
export function lookup(params: { take: number; filters?: LookupUsersFilters }) {
  const where: Prisma.UserWhereInput = {
    active: params.filters?.active,
    ...(params.filters?.search && {
      fullName: { contains: params.filters.search, mode: 'insensitive' },
    }),
  };

  return prisma.user.findMany({
    where,
    select: { id: true, fullName: true },
    take: params.take,
    orderBy: { fullName: 'asc' },
  });
}

/**
 * Version 1.0.5, Bloque A (proteccion contra quedar sin ningun ADMIN
 * activo): cuenta cuantos usuarios ACTIVOS con el rol indicado existen,
 * excluyendo un id puntual (el usuario que se esta modificando en esa
 * misma operacion). Generica por nombre de rol (no hardcodea "ADMIN")
 * para no acoplar este repositorio a una regla de negocio especifica —
 * `users.service.ts` decide con que rol y en que casos la invoca.
 */
export function countOtherActiveUsersByRoleName(roleName: string, excludeUserId: string) {
  return prisma.user.count({
    where: {
      id: { not: excludeUserId },
      active: true,
      role: { name: roleName },
    },
  });
}

export function update(id: string, data: Prisma.UserUncheckedUpdateInput) {
  return prisma.user.update({
    where: { id },
    data,
    include: userWithRoleInclude,
  });
}

/**
 * `data` en vez de un `active: boolean` fijo (hallazgo de seguridad #3,
 * auditoria 31/07/2026): `users.service.ts` decide, ademas de `active`, si
 * corresponde incrementar `tokenVersion` (desactivacion) — esta funcion
 * sigue siendo infraestructura pura, la regla de negocio vive en el
 * servicio.
 */
export function changeStatus(id: string, data: Prisma.UserUncheckedUpdateInput) {
  return prisma.user.update({
    where: { id },
    data,
    include: userWithRoleInclude,
  });
}
