/**
 * modules/customers/repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de clientes.
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `customers.service.ts`). Usa
 * unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. `Customer` ya esta registrado en
 * `SOFT_DELETE_MODELS` (Bloque 8.2).
 */
import { Prisma } from '@prisma/client';
import type { CustomerIdentificationType } from '@prisma/client';
import { prisma } from '@/database';
import type { ListCustomersFilters, LookupCustomersFilters } from './types';

export function create(data: Prisma.CustomerUncheckedCreateInput) {
  return prisma.customer.create({
    data,
  });
}

export function findById(id: string) {
  return prisma.customer.findFirst({
    where: { id },
  });
}

/** Verifica si ya existe un cliente con esa combinacion (tipo, numero) de
 * identificacion — la unicidad real (`@@unique`, `schema.prisma`), ajuste
 * aprobado del Bloque 8.2: dos tipos distintos podrian, en teoria,
 * compartir el mismo numero sin ser el mismo cliente. */
export function findByIdentification(
  identificationType: CustomerIdentificationType,
  identificationNumber: string,
) {
  return prisma.customer.findFirst({
    where: { identificationType, identificationNumber },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListCustomersFilters): Prisma.CustomerWhereInput {
  if (!filters) return {};

  return {
    active: filters.active,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { identificationNumber: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListCustomersFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.customer.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);
}

/**
 * Arquitectura de selectores, Bloque 1: busqueda acotada para el patron de
 * lookup — separada de `findMany` (tabla). Busca unicamente por `name`
 * (indice de trigramas GIN, `schema.prisma`), mismo criterio que
 * `suppliers.repository.ts::lookup`. `select` minimo y sin `count()`
 * acompanante — ver `shared/utils/lookup.ts`.
 */
export function lookup(params: { take: number; filters?: LookupCustomersFilters }) {
  const where: Prisma.CustomerWhereInput = {
    active: params.filters?.active,
    ...(params.filters?.search && {
      name: { contains: params.filters.search, mode: 'insensitive' },
    }),
  };

  return prisma.customer.findMany({
    where,
    select: { id: true, name: true },
    take: params.take,
    orderBy: { name: 'asc' },
  });
}

export function update(id: string, data: Prisma.CustomerUncheckedUpdateInput) {
  return prisma.customer.update({
    where: { id },
    data,
  });
}

export function changeStatus(id: string, active: boolean) {
  return prisma.customer.update({
    where: { id },
    data: { active },
  });
}

/** Borrado logico: solo marca `deletedAt`. A partir de este momento, la
 * extension global (`softDelete.ext.ts`, con `Customer` ya registrado en
 * `SOFT_DELETE_MODELS`) excluye automaticamente esta fila de
 * `findFirst`/`findMany`/`count`/`aggregate` -- por eso este repositorio
 * no necesita ninguna consulta especial para "ver" clientes borrados. */
export function softDelete(id: string) {
  return prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
