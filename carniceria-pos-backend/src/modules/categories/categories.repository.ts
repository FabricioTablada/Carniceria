/**
 * modules/categories/categories.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de categorias.
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `categories.service.ts`). Usa
 * unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Category` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListCategoriesFilters, LookupCategoriesFilters } from './categories.types';

/** Incluye el resumen de la categoria padre asociada a la categoria. */
const categoryWithParentInclude = {
  parent: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
} as const;

export function create(data: Prisma.CategoryUncheckedCreateInput) {
  return prisma.category.create({
    data,
    include: categoryWithParentInclude,
  });
}

export function findById(id: string) {
  return prisma.category.findFirst({
    where: { id },
    include: categoryWithParentInclude,
  });
}

export function findByName(name: string) {
  return prisma.category.findFirst({
    where: { name },
    include: categoryWithParentInclude,
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListCategoriesFilters): Prisma.CategoryWhereInput {
  if (!filters) return {};

  return {
    parentId: filters.parentId,
    active: filters.active,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

export function findMany(params: { skip: number; take: number; filters?: ListCategoriesFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.category.findMany({
      where,
      include: categoryWithParentInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.category.count({ where }),
  ]);
}

/**
 * Arquitectura de selectores, Bloque 1: busqueda acotada para el patron de
 * lookup — separada de `findMany` (tabla). Busca unicamente por `name`
 * (indice de trigramas GIN, `schema.prisma`), no por `description` como
 * si hace la tabla completa. Sin `count()` acompanante — ver
 * `shared/utils/lookup.ts`.
 *
 * Bloque 2 (frontend): el `select` se amplio de `{id,name}` a los campos
 * puntuales que `CategorySearchDialog.tsx` necesita para su fila de
 * resultado (categoria padre, descripcion) — sigue sin ser un `include`
 * de relaciones completas: `parent` solo trae su `name`, nunca el
 * registro completo (ni siquiera su `id`, que el picker no necesita).
 */
export function lookup(params: { take: number; filters?: LookupCategoriesFilters }) {
  const where: Prisma.CategoryWhereInput = {
    active: params.filters?.active,
    ...(params.filters?.search && {
      name: { contains: params.filters.search, mode: 'insensitive' },
    }),
  };

  return prisma.category.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      parent: { select: { name: true } },
    },
    take: params.take,
    orderBy: { name: 'asc' },
  });
}

export function update(id: string, data: Prisma.CategoryUncheckedUpdateInput) {
  return prisma.category.update({
    where: { id },
    data,
    include: categoryWithParentInclude,
  });
}

export function changeStatus(id: string, active: boolean) {
  return prisma.category.update({
    where: { id },
    data: { active },
    include: categoryWithParentInclude,
  });
}

/** Cuenta los productos que referencian esta categoria — usado por el
 * servicio para bloquear el borrado de una categoria en uso (ver
 * `categories.service.ts::remove`). */
export function countProducts(categoryId: string) {
  return prisma.product.count({ where: { categoryId } });
}

/** Cuenta las subcategorias hijas de esta categoria (relacion
 * `CategoryHierarchy`) — mismo motivo que `countProducts`. */
export function countChildren(categoryId: string) {
  return prisma.category.count({ where: { parentId: categoryId } });
}

/** Borrado logico: solo marca `deletedAt`. A partir de este momento, la
 * extension global (`softDelete.ext.ts`, con `Category` ya registrado en
 * `SOFT_DELETE_MODELS`) excluye automaticamente esta fila de
 * `findFirst`/`findMany`/`count`/`aggregate` -- por eso este repositorio
 * no necesita ninguna consulta especial para "ver" categorias borradas
 * (mismo patron que `suppliers/repository.ts::softDelete`). */
export function softDelete(id: string) {
  return prisma.category.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
