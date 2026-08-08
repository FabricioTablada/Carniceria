/**
 * modules/taxes/taxes.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de impuestos.
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `taxes.service.ts`). Usa
 * unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Tax` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { ListTaxesFilters, LookupTaxesFilters } from './taxes.types';

export function create(data: Prisma.TaxUncheckedCreateInput, db: DbClient = prisma) {
  return db.tax.create({
    data,
  });
}

export function findById(id: string) {
  return prisma.tax.findFirst({
    where: { id },
  });
}

export function findByCode(code: string) {
  return prisma.tax.findFirst({
    where: { code },
  });
}

export function findByName(name: string) {
  return prisma.tax.findFirst({
    where: { name },
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListTaxesFilters): Prisma.TaxWhereInput {
  if (!filters) return {};

  return {
    active: filters.active,
    isDefault: filters.isDefault,
    ...(filters.search && {
      OR: [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListTaxesFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.tax.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tax.count({ where }),
  ]);
}

/**
 * Arquitectura de selectores, Bloque 1: busqueda acotada para el patron de
 * lookup — separada de `findMany` (tabla). Busca por `name` y `code`
 * (ambos con indice de trigramas GIN, `schema.prisma`). `select` minimo y
 * sin `count()` acompanante — ver `shared/utils/lookup.ts`.
 */
export function lookup(params: { take: number; filters?: LookupTaxesFilters }) {
  const where: Prisma.TaxWhereInput = {
    active: params.filters?.active,
    ...(params.filters?.search && {
      OR: [
        { name: { contains: params.filters.search, mode: 'insensitive' } },
        { code: { contains: params.filters.search, mode: 'insensitive' } },
      ],
    }),
  };

  return prisma.tax.findMany({
    where,
    select: { id: true, name: true },
    take: params.take,
    orderBy: { name: 'asc' },
  });
}

export function update(id: string, data: Prisma.TaxUncheckedUpdateInput, db: DbClient = prisma) {
  return db.tax.update({
    where: { id },
    data,
  });
}

/** Desmarca cualquier impuesto que hoy sea el predeterminado. Debe llamarse
 * dentro de la misma transaccion que marca el nuevo, para no violar el
 * indice unico parcial `taxes_default_unique` (WHERE is_default = true). */
export function unsetDefault(db: DbClient) {
  return db.tax.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  });
}

export function changeStatus(id: string, active: boolean) {
  return prisma.tax.update({
    where: { id },
    data: { active },
  });
}

/** Cuenta los productos que referencian este impuesto — usado por el
 * servicio para bloquear el borrado de un impuesto en uso (ver
 * `taxes.service.ts::remove`, mismo criterio que
 * `categories.repository.ts::countProducts`). */
export function countProducts(taxId: string) {
  return prisma.product.count({ where: { taxId } });
}

/** Borrado logico: solo marca `deletedAt`. A partir de este momento, la
 * extension global (`softDelete.ext.ts`, con `Tax` ya registrado en
 * `SOFT_DELETE_MODELS`) excluye automaticamente esta fila de
 * `findFirst`/`findMany`/`count`/`aggregate` -- por eso este repositorio
 * no necesita ninguna consulta especial para "ver" impuestos borrados
 * (mismo patron que `categories.repository.ts::softDelete`). */
export function softDelete(id: string) {
  return prisma.tax.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
