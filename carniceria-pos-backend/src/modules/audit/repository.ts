/**
 * modules/audit/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de auditoria.
 * Es infraestructura pura: no valida datos de entrada y no contiene reglas
 * de negocio (eso vive en `audit.service.ts`). Usa unicamente la instancia
 * singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: solo expone lectura (`findById`, `findMany`). `AuditLog` es un
 * registro inmutable y de solo agregado (ver DATABASE.md): los registros
 * los crea automaticamente la aplicacion a traves de
 * `shared/services/audit.service.ts`, no este modulo. No existen
 * `create`, `update` ni `delete` aqui.
 *
 * NOTA: se usa `findUnique` (no `findFirst`, a diferencia del resto de
 * repositorios del proyecto) porque `AuditLog` no tiene columna
 * `deletedAt`. La extension de borrado logico (`softDelete.ext.ts`) solo
 * intercepta `findFirst` / `findMany` / `count` / `aggregate`, y `AuditLog`
 * nunca se registrara en `SOFT_DELETE_MODELS` al no soportar borrado
 * logico; `id` ya es una restriccion unica real, por lo que `findUnique`
 * es la consulta correcta y mas eficiente en este caso.
 *
 * NOTA: `AuditLog` no tiene ninguna restriccion `@@unique` ademas de la
 * llave primaria, por lo que este repositorio no expone un finder de
 * duplicados.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListAuditLogsFilters } from './types';

/** Incluye los resumenes de sucursal y usuario asociados al registro de
 * auditoria. */
const auditLogWithRelationsInclude = {
  sucursal: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  user: {
    select: {
      id: true,
      fullName: true,
    },
  },
} as const;

export function findById(id: string) {
  return prisma.auditLog.findUnique({
    where: { id },
    include: auditLogWithRelationsInclude,
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListAuditLogsFilters): Prisma.AuditLogWhereInput {
  if (!filters) return {};

  return {
    sucursalId: filters.sucursalId,
    userId: filters.userId,
    action: filters.action,
    entity: filters.entity,
    entityId: filters.entityId,
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListAuditLogsFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: auditLogWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);
}
