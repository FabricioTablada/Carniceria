/**
 * modules/suppliers/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de proveedores.
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `suppliers.service.ts`). Usa
 * unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Supplier` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListSuppliersFilters, LookupSuppliersFilters } from './types';

export function create(data: Prisma.SupplierUncheckedCreateInput) {
  return prisma.supplier.create({
    data,
  });
}

export function findById(id: string) {
  return prisma.supplier.findFirst({
    where: { id },
  });
}

/** Verifica si ya existe un proveedor con ese `legalId` (RUC/identificacion legal). */
export function findByLegalId(legalId: string) {
  return prisma.supplier.findFirst({
    where: { legalId },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListSuppliersFilters): Prisma.SupplierWhereInput {
  if (!filters) return {};

  return {
    active: filters.active,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { legalId: { contains: filters.search, mode: 'insensitive' } },
        { contactName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListSuppliersFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.supplier.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supplier.count({ where }),
  ]);
}

/**
 * Arquitectura de selectores, Bloque 1: busqueda acotada para el patron de
 * lookup — separada de `findMany` (tabla). Busca unicamente por `name`
 * (indice de trigramas GIN, `schema.prisma`), no por
 * `legalId`/`contactName`/`email` como si hace la tabla completa. `select`
 * minimo y sin `count()` acompanante — ver `shared/utils/lookup.ts`. Este
 * es el primer picker con busqueda real que tiene Proveedores (antes solo
 * un `<Select>` sin `search`, ver analisis aprobado).
 */
export function lookup(params: { take: number; filters?: LookupSuppliersFilters }) {
  const where: Prisma.SupplierWhereInput = {
    active: params.filters?.active,
    ...(params.filters?.search && {
      name: { contains: params.filters.search, mode: 'insensitive' },
    }),
  };

  return prisma.supplier.findMany({
    where,
    select: { id: true, name: true },
    take: params.take,
    orderBy: { name: 'asc' },
  });
}

export function update(id: string, data: Prisma.SupplierUncheckedUpdateInput) {
  return prisma.supplier.update({
    where: { id },
    data,
  });
}

export function changeStatus(id: string, active: boolean) {
  return prisma.supplier.update({
    where: { id },
    data: { active },
  });
}

/** Borrado logico: solo marca `deletedAt`. A partir de este momento, la
 * extension global (`softDelete.ext.ts`, con `Supplier` ya registrado en
 * `SOFT_DELETE_MODELS`) excluye automaticamente esta fila de
 * `findFirst`/`findMany`/`count`/`aggregate` -- por eso este repositorio
 * no necesita ninguna consulta especial para "ver" proveedores borrados. */
export function softDelete(id: string) {
  return prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}