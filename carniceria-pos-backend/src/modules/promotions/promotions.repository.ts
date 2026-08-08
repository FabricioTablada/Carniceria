/**
 * modules/promotions/promotions.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de Promociones (Bloque P.3, catalogo
 * administrativo). Es infraestructura pura: no valida datos de entrada, no
 * valida duplicados y no contiene reglas de negocio (eso vive en
 * `promotions.service.ts`). Usa unicamente la instancia singleton de Prisma
 * expuesta en `@/database`.
 *
 * `create`/`update` reemplazan por completo las lineas de `products`/
 * `categories` en cada escritura (borrar + recrear, dentro de la misma
 * transaccion) — mas simple y suficientemente eficiente para el tamaño de
 * catalogo esperado (decenas de promociones, no miles), evita el codigo
 * adicional de diffing fila por fila que un catalogo de este tamaño no
 * justifica.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { ListPromotionsFilters } from './promotions.types';

const promotionWithRelationsInclude = {
  sucursal: { select: { id: true, name: true } },
  // PROMO-03/05 (Commercial Pricing Engine): proveedor asociado, mismo
  // criterio que `sucursal` (resumen liviano, no el `Supplier` completo).
  supplier: { select: { id: true, name: true } },
  products: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  },
  categories: {
    include: {
      category: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PromotionInclude;

/** Forma de las lineas de producto/categoria aceptadas al crear/actualizar
 * (sin `id`, generado por Prisma). */
type PromotionProductWrite = { productId: string; requiredQuantity: Prisma.Decimal | number | null };
type PromotionCategoryWrite = { categoryId: string };

export function create(
  data: Omit<Prisma.PromotionUncheckedCreateInput, 'products' | 'categories'>,
  products: PromotionProductWrite[],
  categories: PromotionCategoryWrite[],
  db: DbClient = prisma,
) {
  return db.promotion.create({
    data: {
      ...data,
      products: { create: products },
      categories: { create: categories },
    },
    include: promotionWithRelationsInclude,
  });
}

export function findById(id: string) {
  return prisma.promotion.findFirst({
    where: { id },
    include: promotionWithRelationsInclude,
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListPromotionsFilters): Prisma.PromotionWhereInput {
  if (!filters) return {};

  return {
    active: filters.active,
    scopeType: filters.scopeType,
    ...(filters.search && {
      name: { contains: filters.search, mode: 'insensitive' },
    }),
  };
}

/**
 * Bloque P.5 (capa adaptadora hacia el Motor de Reglas): trae TODAS las
 * promociones activas relevantes para una sucursal — sin paginacion (a
 * diferencia de `findMany`, pensado para el listado administrativo). Una
 * promocion es relevante si aplica a TODAS las sucursales (`sucursalId:
 * null`) o especificamente a la sucursal dada. La evaluacion fina de
 * fecha/hora/dia/cantidad minima NO ocurre aca (esa logica vive en el
 * motor, `conditions.ts`) — este metodo solo acota el universo de
 * candidatas por estado y sucursal, ambos filtrables directamente en SQL.
 */
export function findActiveForEvaluation(sucursalId: string) {
  return prisma.promotion.findMany({
    where: {
      active: true,
      OR: [{ sucursalId: null }, { sucursalId }],
    },
    include: promotionWithRelationsInclude,
  });
}

export function findMany(params: { skip: number; take: number; filters?: ListPromotionsFilters }) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.promotion.findMany({
      where,
      include: promotionWithRelationsInclude,
      skip: params.skip,
      take: params.take,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.promotion.count({ where }),
  ]);
}

/**
 * Actualiza una promocion. Si `products`/`categories` se proporcionan (no
 * `undefined` — un array vacio SI reemplaza, ver `promotions.service.ts`),
 * borra las lineas existentes y crea las nuevas dentro de la MISMA
 * transaccion que el `update` del resto de campos, para que nunca quede un
 * estado intermedio (promocion actualizada con lineas de otra version, o
 * viceversa) visible para otra transaccion concurrente.
 */
export async function update(
  id: string,
  data: Omit<Prisma.PromotionUncheckedUpdateInput, 'products' | 'categories'>,
  products: PromotionProductWrite[] | undefined,
  categories: PromotionCategoryWrite[] | undefined,
  db: DbClient = prisma,
) {
  if (products !== undefined) {
    await db.promotionProduct.deleteMany({ where: { promotionId: id } });
  }

  if (categories !== undefined) {
    await db.promotionCategory.deleteMany({ where: { promotionId: id } });
  }

  return db.promotion.update({
    where: { id },
    data: {
      ...data,
      ...(products !== undefined && { products: { create: products } }),
      ...(categories !== undefined && { categories: { create: categories } }),
    },
    include: promotionWithRelationsInclude,
  });
}

export function changeStatus(id: string, active: boolean) {
  return prisma.promotion.update({
    where: { id },
    data: { active },
    include: promotionWithRelationsInclude,
  });
}

/** Busca productos por id, para validar su existencia antes de asociarlos
 * a una promocion (`scopeType: PRODUCT`/`COMBO`). Mismo criterio ya usado
 * en `sales.repository.ts` (`findProductsByIds`). */
export function findProductsByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);

  return prisma.product.findMany({ where: { id: { in: ids } } });
}

/** Busca categorias por id, para validar su existencia antes de
 * asociarlas a una promocion (`scopeType: CATEGORY`). */
export function findCategoriesByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);

  return prisma.category.findMany({ where: { id: { in: ids } } });
}

/** Busca la sucursal por su id, para validar su existencia antes de
 * asociarla a una promocion (`sucursalId`, opcional). */
export function findSucursalById(id: string) {
  return prisma.sucursal.findFirst({ where: { id } });
}

/** PROMO-05: busca el proveedor por su id, para validar su existencia
 * antes de asociarlo a una promocion (`supplierId`, opcional). */
export function findSupplierById(id: string) {
  return prisma.supplier.findFirst({ where: { id } });
}

/** Borrado logico: solo marca `deletedAt`. A partir de este momento, la
 * extension global (`softDelete.ext.ts`, con `Promotion` ya registrado en
 * `SOFT_DELETE_MODELS`) excluye automaticamente esta fila de
 * `findFirst`/`findMany`/`count`/`aggregate` -- por eso este repositorio
 * no necesita ninguna consulta especial para "ver" promociones borradas
 * (mismo patron que `categories.repository.ts::softDelete`). */
export function softDelete(id: string) {
  return prisma.promotion.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
