/**
 * modules/products/products.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de productos.
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `products.service.ts`). Usa
 * unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `Product` se registre en
 * `SOFT_DELETE_MODELS`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListProductsFilters, LookupProductsFilters } from './products.types';

/** Incluye los resumenes de categoria e impuesto asociados al producto. */
const productWithRelationsInclude = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
  tax: {
    select: {
      id: true,
      code: true,
      name: true,
      rate: true,
    },
  },
} as const;

export function create(data: Prisma.ProductUncheckedCreateInput) {
  return prisma.product.create({
    data,
    include: productWithRelationsInclude,
  });
}

export function findById(id: string) {
  return prisma.product.findFirst({
    where: { id },
    include: productWithRelationsInclude,
  });
}

export function findBySku(sku: string) {
  return prisma.product.findFirst({
    where: { sku },
    include: productWithRelationsInclude,
  });
}

export function findByBarcode(barcode: string) {
  return prisma.product.findFirst({
    where: { barcode },
    include: productWithRelationsInclude,
  });
}

export function findByName(name: string) {
  return prisma.product.findFirst({
    where: { name },
    include: productWithRelationsInclude,
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListProductsFilters): Prisma.ProductWhereInput {
  if (!filters) return {};

  return {
    categoryId: filters.categoryId,
    taxId: filters.taxId,
    active: filters.active,
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };
}

/**
 * Fase 18 (Bloque 18.1): cuando `filters.sucursalId` se provee, incluye el
 * stock de esa sucursal para cada producto en la MISMA consulta
 * (`inventories`, filtrado por `sucursalId`, a lo sumo una fila por
 * producto gracias a `@@unique([productId, sucursalId])` en
 * `schema.prisma`) — elimina el patron N+1 de `GET /inventory` por
 * producto que hacia `ProductCatalogCard.tsx`.
 *
 * Deliberadamente DOS ramas separadas (en vez de un `include` condicional
 * armado con un spread) para que, sin `sucursalId`, la consulta sea
 * EXACTAMENTE la misma que antes de este bloque — ni una columna ni un
 * JOIN de mas — en vez de una union de tipos dificil de tipar con
 * precision y de verificar que no cambia el plan de consulta.
 */
export function findMany(params: { skip: number; take: number; filters?: ListProductsFilters }) {
  const where = buildWhere(params.filters);
  const sucursalId = params.filters?.sucursalId;

  if (!sucursalId) {
    return prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productWithRelationsInclude,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);
  }

  return prisma.$transaction([
    prisma.product.findMany({
      where,
      include: {
        ...productWithRelationsInclude,
        inventories: {
          where: { sucursalId },
          take: 1,
          select: { sucursalId: true, quantity: true, reorderPoint: true },
        },
      },
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);
}

/**
 * Arquitectura de selectores, Bloque 1: busqueda acotada para el patron de
 * lookup (selectores/typeahead) — separada de `findMany` (tabla). Busca
 * unicamente por `name`/`sku` (ambos con indice de trigramas GIN,
 * `schema.prisma`), NO por `description`/`barcode` como si hace la tabla
 * completa (`buildWhere` arriba): un selector busca por lo que el usuario
 * ve/teclea, no necesita el mismo alcance de busqueda que la tabla
 * administrativa. Sin `count()` acompanante — ver justificacion completa
 * en `shared/utils/lookup.ts`.
 *
 * Bloque 2 (frontend): el `select` se amplio de `{id,name}` a los campos
 * puntuales que `ProductSearchDialog.tsx` necesita para su fila de
 * resultado (miniatura, SKU, categoria, impuesto, precio) — sigue sin ser
 * un `include` de relaciones completas: `category`/`tax` solo traen el
 * campo de texto que se muestra (`name`, y `rate` en el caso de `tax`),
 * nunca el registro completo. Esto es deliberadamente MAS liviano que
 * `productWithRelationsInclude` (usado por la tabla), que si trae `id` de
 * categoria/impuesto — el picker no necesita esos ids, solo el texto.
 */
export function lookup(params: { take: number; filters?: LookupProductsFilters }) {
  const where: Prisma.ProductWhereInput = {
    active: params.filters?.active,
    ...(params.filters?.search && {
      OR: [
        { name: { contains: params.filters.search, mode: 'insensitive' } },
        { sku: { contains: params.filters.search, mode: 'insensitive' } },
      ],
    }),
  };

  return prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      imageUrl: true,
      // Bloque 10: necesario para el cache-busting (`?v=<updatedAt>`) de
      // `thumbnail` en `products.service.ts` — mismo criterio que
      // `toProductResponse` ya usa para `ProductResponse.imageUrl`.
      updatedAt: true,
      cost: true,
      // Bloque COST-06.1: necesario para que Compras precargue "Merma
      // esperada (%)" de cada linea con el valor por defecto del
      // producto (`Product.expectedWastePercent`) — solo lectura, este
      // endpoint nunca escribe el dato maestro.
      expectedWastePercent: true,
      // Bloque LOTES-09: necesario para que Compras sepa, por linea, si
      // debe mostrar los campos de trazabilidad de lote (codigo de lote
      // del proveedor, fecha de produccion, fecha de vencimiento) — solo
      // lectura, este endpoint nunca escribe el dato maestro.
      requiresBatch: true,
      unitOfMeasure: true,
      taxId: true,
      category: { select: { name: true } },
      tax: { select: { name: true, rate: true } },
    },
    take: params.take,
    orderBy: { name: 'asc' },
  });
}

export function update(id: string, data: Prisma.ProductUncheckedUpdateInput) {
  return prisma.product.update({
    where: { id },
    data,
    include: productWithRelationsInclude,
  });
}

export function changeStatus(id: string, active: boolean) {
  return prisma.product.update({
    where: { id },
    data: { active },
    include: productWithRelationsInclude,
  });
}

/** Cuenta las lineas de venta que referencian este producto — usado por
 * el servicio para bloquear el borrado de un producto con historial de
 * ventas (ver `products.service.ts::remove`, mismo criterio que
 * `categories.repository.ts::countProducts`). */
export function countSaleItems(productId: string) {
  return prisma.saleItem.count({ where: { productId } });
}

/** Cuenta las lineas de compra que referencian este producto — mismo
 * motivo que `countSaleItems`. */
export function countPurchaseItems(productId: string) {
  return prisma.purchaseItem.count({ where: { productId } });
}

/** Validacion CABYS <-> Impuesto: busca el `taxIndicator` oficial (BCCR)
 * del codigo CABYS elegido — mismo criterio que `countSaleItems`/
 * `countPurchaseItems` arriba (consulta directa a otro modelo desde el
 * repositorio del modulo que la necesita, sin repositorio cruzado).
 * `null` cuando el codigo no existe en el catalogo importado (ver
 * `prisma/import-cabys.ts`) — la ausencia de dato se trata igual que un
 * `taxIndicator` vacio en `cabysTaxCoherence.ts`: no bloquea. */
export function findCabysTaxIndicator(cabysCode: string) {
  return prisma.cabysCode.findUnique({
    where: { code: cabysCode },
    select: { taxIndicator: true },
  });
}

/** Validacion CABYS <-> Impuesto: tasa real del impuesto elegido —
 * necesaria ademas de `dto.taxId` porque el DTO solo trae el id, no el
 * porcentaje. `null` si el id no corresponde a ningun impuesto (deja que
 * el flujo de guardado existente reporte ese error como ya lo hacia antes
 * de este bloque; esta funcion no agrega ningun caso de error nuevo). */
export function findTaxRate(taxId: string) {
  return prisma.tax.findFirst({
    where: { id: taxId },
    select: { rate: true, name: true },
  });
}

/** Borrado logico: solo marca `deletedAt`. A partir de este momento, la
 * extension global (`softDelete.ext.ts`, con `Product` ya registrado en
 * `SOFT_DELETE_MODELS`) excluye automaticamente esta fila de
 * `findFirst`/`findMany`/`count`/`aggregate` -- por eso este repositorio
 * no necesita ninguna consulta especial para "ver" productos borrados
 * (mismo patron que `categories.repository.ts::softDelete`). */
export function softDelete(id: string) {
  return prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
