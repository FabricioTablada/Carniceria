/**
 * modules/configuration/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de configuracion funcional del sistema.
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `configuration.service.ts`).
 * Usa unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Configuration` se registre en
 * `SOFT_DELETE_MODELS`.
 *
 * NOTA: `Configuration` tiene la restriccion `@@unique([sucursalId, key])`
 * en `schema.prisma`, por lo que `findBySucursalAndKey` existe para validar
 * duplicados (mismo patron que Inventory con `productId` + `sucursalId`).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListConfigurationsFilters } from './types';

/** Incluye el resumen de la sucursal asociada a la configuracion. */
const configurationWithRelationsInclude = {
  sucursal: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} as const;

export function create(data: Prisma.ConfigurationUncheckedCreateInput) {
  return prisma.configuration.create({
    data,
    include: configurationWithRelationsInclude,
  });
}

export function findById(id: string) {
  return prisma.configuration.findFirst({
    where: { id },
    include: configurationWithRelationsInclude,
  });
}

/** Busca una configuracion por su sucursal y clave, usadas en conjunto por
 * la restriccion `@@unique([sucursalId, key])`. */
export function findBySucursalAndKey(sucursalId: string, key: string) {
  return prisma.configuration.findFirst({
    where: { sucursalId, key },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListConfigurationsFilters): Prisma.ConfigurationWhereInput {
  if (!filters) return {};

  return {
    sucursalId: filters.sucursalId,
    type: filters.type,
    ...(filters.search && {
      OR: [
        { key: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

export function findMany(params: {
  skip: number;
  take: number;
  filters?: ListConfigurationsFilters;
}) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.configuration.findMany({
      where,
      include: configurationWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.configuration.count({ where }),
  ]);
}

export function update(id: string, data: Prisma.ConfigurationUncheckedUpdateInput) {
  return prisma.configuration.update({
    where: { id },
    data,
    include: configurationWithRelationsInclude,
  });
}
