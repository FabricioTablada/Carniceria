/**
 * modules/products/products.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de productos.
 *
 * Responsabilidades:
 *  - Validar existencia del producto antes de leer/actualizar/cambiar su
 *    estado.
 *  - Validar que `name` no este duplicado al crear o actualizar.
 *  - Validar que `sku` no este duplicado al crear o actualizar (cuando se
 *    proporcione).
 *  - Validar que `barcode` no este duplicado al crear o actualizar (cuando
 *    se proporcione).
 *  - Traducir los registros de Prisma a la forma publica `ProductResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `products.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { Prisma } from '@prisma/client';
import { withImageCacheBusting } from '@/config';
import { ConflictError, NotFoundError } from '@/shared/errors';
import { assertCabysTaxCoherence } from './cabysTaxCoherence';
import * as productsRepository from './products.repository';
import { deleteProductImage, saveProductImage } from './productImageStorage';
import type {
  ChangeProductStatusDto,
  CreateProductDto,
  ListProductsQuery,
  ListProductsResult,
  LookupProductsQuery,
  ProductLookupItem,
  ProductResponse,
  ProductStockSummary,
  UnitOfMeasure,
  UpdateProductDto,
} from './products.types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type ProductRecord = {
  id: string;
  categoryId: string;
  taxId: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  unitOfMeasure: string;
  salePrice: Prisma.Decimal;
  cost: Prisma.Decimal;
  // Bloque 7.12: ver `ProductResponse.cabysCode`.
  cabysCode: string | null;
  // Bloque 14.4 (Mermas esperadas): ver `ProductResponse.expectedWastePercent`.
  expectedWastePercent: Prisma.Decimal;
  // Bloque COST-01.1: ver `ProductResponse.applyExpectedWasteToCost`.
  applyExpectedWasteToCost: boolean;
  isVariableWeight: boolean;
  trackInventory: boolean;
  requiresBatch: boolean;
  active: boolean;
  category: { id: string; name: string; color: string | null };
  tax: { id: string; code: string; name: string; rate: Prisma.Decimal };
  createdAt: Date;
  updatedAt: Date;
  /** Fase 18 (Bloque 18.1): SOLO presente cuando `findMany` se llamo con
   * `filters.sucursalId` (ver `products.repository.ts`) — ausente por
   * completo en los demas casos (no `undefined`: la clave ni existe en el
   * objeto), por eso es opcional aqui y no `| undefined` explicito. A lo
   * sumo una fila, gracias a `@@unique([productId, sucursalId])`. */
  inventories?: { sucursalId: string; quantity: Prisma.Decimal; reorderPoint: Prisma.Decimal | null }[];
};

/**
 * Traduce el primer (y unico, por el `@@unique([productId, sucursalId])`
 * de `schema.prisma`) registro de `inventories` incluido por
 * `products.repository.ts` a `ProductStockSummary`. `undefined`/array
 * vacio (sin `sucursalId` en el filtro, o producto sin fila de
 * `Inventory` en esa sucursal todavia) se traduce a `null` — nunca se
 * inventa un cero.
 */
function toStockSummary(product: ProductRecord): ProductStockSummary | null {
  const inventory = product.inventories?.[0];

  if (!inventory) {
    return null;
  }

  return {
    sucursalId: inventory.sucursalId,
    quantity: Number(inventory.quantity),
    reorderPoint: inventory.reorderPoint === null ? null : Number(inventory.reorderPoint),
  };
}

/**
 * QA.1 (Productos): `sku`/`barcode` son `@unique` a nivel de base de datos
 * (`schema.prisma`), pero ese indice NO excluye filas con `deletedAt`
 * distinto de `null` -- a diferencia de las validaciones de arriba
 * (`findBySku`/`findByBarcode`), que si las excluyen (via la extension de
 * borrado logico). Antes de esta correccion, reutilizar el SKU/codigo de
 * barras de un producto ya eliminado pasaba la validacion de la aplicacion
 * (el producto borrado es invisible para `findFirst`) pero fallaba en la
 * base de datos con `P2002` sin traducir, cayendo en el 500 generico del
 * error handler. Mismo patron de traduccion ya usado en
 * `sales.service.ts` (`documentNumber`) e `inventoryWaste/service.ts`
 * (`sourceReturnItemId`) -- nunca se cambia el indice de la base de datos,
 * solo se traduce el error a uno legible.
 */
function translateUniqueConstraintError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target)
  ) {
    const target = error.meta.target as string[];

    if (target.includes('sku')) {
      throw new ConflictError(
        'El SKU ya se encuentra registrado (puede pertenecer a un producto eliminado).',
      );
    }

    if (target.includes('barcode')) {
      throw new ConflictError(
        'El código de barras ya se encuentra registrado (puede pertenecer a un producto eliminado).',
      );
    }
  }

  throw error;
}

/** Traduce un registro de Prisma a la forma publica del producto. */
function toProductResponse(product: ProductRecord): ProductResponse {
  return {
    id: product.id,
    categoryId: product.categoryId,
    taxId: product.taxId,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    description: product.description,
    // Bloque 10: `?v=<updatedAt>` — el nombre de archivo de una imagen de
    // producto no cambia al reemplazarla (ver `productImageStorage.ts`),
    // asi que sin este parametro el navegador seguiria mostrando la
    // version cacheada hasta que venza `PRODUCT_IMAGES_CACHE_MAX_AGE`.
    imageUrl: product.imageUrl ? withImageCacheBusting(product.imageUrl, product.updatedAt) : null,
    stock: toStockSummary(product),
    unitOfMeasure: product.unitOfMeasure as UnitOfMeasure,
    salePrice: Number(product.salePrice),
    cost: Number(product.cost),
    cabysCode: product.cabysCode,
    expectedWastePercent: Number(product.expectedWastePercent),
    applyExpectedWasteToCost: product.applyExpectedWasteToCost,
    isVariableWeight: product.isVariableWeight,
    trackInventory: product.trackInventory,
    requiresBatch: product.requiresBatch,
    active: product.active,
    category: product.category,
    tax: {
      id: product.tax.id,
      code: product.tax.code,
      name: product.tax.name,
      rate: Number(product.tax.rate),
    },
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/**
 * Validacion CABYS <-> Impuesto (ver `cabysTaxCoherence.ts`): resuelve el
 * `taxIndicator` oficial del CABYS efectivo y la tasa real del impuesto
 * efectivo, y delega la comparacion. `cabysCode` puede ser `null` (producto
 * sin CABYS, o -en `update`- edicion que no toca ni CABYS ni impuesto) —
 * en ese caso no hay nada que validar. Si el codigo no esta en el catalogo
 * importado (`cabysRecord === null`) o el impuesto no resuelve
 * (`taxRecord === null`), tampoco se valida: sin informacion oficial no se
 * bloquea, y un `taxId` invalido lo sigue reportando el flujo de guardado
 * existente (constraint de la base de datos), sin un caso de error nuevo.
 */
async function validateCabysTaxCoherenceOnSave(params: {
  cabysCode: string | null;
  taxId: string;
  knownTax?: { rate: Prisma.Decimal; name: string };
}): Promise<void> {
  if (!params.cabysCode) {
    return;
  }

  const [cabysRecord, taxRecord] = await Promise.all([
    productsRepository.findCabysTaxIndicator(params.cabysCode),
    params.knownTax ? Promise.resolve(params.knownTax) : productsRepository.findTaxRate(params.taxId),
  ]);

  if (!cabysRecord || !taxRecord) {
    return;
  }

  assertCabysTaxCoherence({
    cabysCode: params.cabysCode,
    officialTaxIndicator: cabysRecord.taxIndicator,
    selectedTax: { rate: Number(taxRecord.rate), name: taxRecord.name },
  });
}

export async function create(dto: CreateProductDto): Promise<ProductResponse> {
  const existingByName = await productsRepository.findByName(dto.name);

  if (existingByName) {
    throw new ConflictError('El nombre del producto ya se encuentra registrado.');
  }

  if (dto.sku) {
    const existingBySku = await productsRepository.findBySku(dto.sku);

    if (existingBySku) {
      throw new ConflictError('El SKU ya se encuentra registrado.');
    }
  }

  if (dto.barcode) {
    const existingByBarcode = await productsRepository.findByBarcode(dto.barcode);

    if (existingByBarcode) {
      throw new ConflictError('El codigo de barras ya se encuentra registrado.');
    }
  }

  await validateCabysTaxCoherenceOnSave({ cabysCode: dto.cabysCode, taxId: dto.taxId });

  try {
    const created = await productsRepository.create({
      categoryId: dto.categoryId,
      taxId: dto.taxId,
      sku: dto.sku ?? null,
      barcode: dto.barcode ?? null,
      name: dto.name,
      description: dto.description ?? null,
      unitOfMeasure: dto.unitOfMeasure,
      salePrice: dto.salePrice,
      cost: dto.cost,
      cabysCode: dto.cabysCode,
      expectedWastePercent: dto.expectedWastePercent,
      applyExpectedWasteToCost: dto.applyExpectedWasteToCost,
      isVariableWeight: dto.isVariableWeight,
      trackInventory: dto.trackInventory,
      requiresBatch: dto.requiresBatch,
      active: dto.active ?? true,
    });

    return toProductResponse(created);
  } catch (error) {
    return translateUniqueConstraintError(error);
  }
}

export async function findById(id: string): Promise<ProductResponse> {
  const product = await productsRepository.findById(id);

  if (!product) {
    throw new NotFoundError('Producto');
  }

  return toProductResponse(product);
}

export async function findMany(query: ListProductsQuery): Promise<ListProductsResult> {
  const [items, total] = await productsRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toProductResponse(item)),
    total,
  };
}

/** Arquitectura de selectores, Bloque 1-2: patron de lookup — devuelve la
 * forma liviana `ProductLookupItem[]`, nunca `ProductResponse[]` (evita
 * mapear/serializar el recurso completo). Bloque 2: la forma se amplio de
 * `LookupItem` generico a `ProductLookupItem` (ver justificacion en
 * `products.types.ts`) para que `ProductSearchDialog.tsx` pueda migrar sin
 * perder su fila de resultado actual. */
export async function lookup(query: LookupProductsQuery): Promise<ProductLookupItem[]> {
  const items = await productsRepository.lookup({
    take: query.take,
    filters: query.filters,
  });

  return items.map((item) => ({
    id: item.id,
    label: item.name,
    sku: item.sku,
    thumbnail: item.imageUrl ? withImageCacheBusting(item.imageUrl, item.updatedAt) : null,
    price: Number(item.cost),
    categoryName: item.category.name,
    taxId: item.taxId,
    taxName: item.tax.name,
    taxRate: Number(item.tax.rate),
    unitOfMeasure: item.unitOfMeasure as UnitOfMeasure,
    expectedWastePercent: Number(item.expectedWastePercent),
    requiresBatch: item.requiresBatch,
  }));
}

export async function update(id: string, dto: UpdateProductDto): Promise<ProductResponse> {
  const existing = await productsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Producto');
  }

  if (dto.name && dto.name !== existing.name) {
    const existingByName = await productsRepository.findByName(dto.name);

    if (existingByName) {
      throw new ConflictError('El nombre del producto ya se encuentra registrado.');
    }
  }

  if (dto.sku && dto.sku !== existing.sku) {
    const existingBySku = await productsRepository.findBySku(dto.sku);

    if (existingBySku) {
      throw new ConflictError('El SKU ya se encuentra registrado.');
    }
  }

  if (dto.barcode && dto.barcode !== existing.barcode) {
    const existingByBarcode = await productsRepository.findByBarcode(dto.barcode);

    if (existingByBarcode) {
      throw new ConflictError('El codigo de barras ya se encuentra registrado.');
    }
  }

  await validateCabysTaxCoherenceOnSave({
    cabysCode: dto.cabysCode ?? existing.cabysCode,
    taxId: dto.taxId ?? existing.taxId,
    knownTax: dto.taxId ? undefined : { rate: existing.tax.rate, name: existing.tax.name },
  });

  try {
    const updated = await productsRepository.update(id, {
      categoryId: dto.categoryId,
      taxId: dto.taxId,
      sku: dto.sku,
      barcode: dto.barcode,
      name: dto.name,
      description: dto.description,
      unitOfMeasure: dto.unitOfMeasure,
      salePrice: dto.salePrice,
      cost: dto.cost,
      cabysCode: dto.cabysCode,
      expectedWastePercent: dto.expectedWastePercent,
      applyExpectedWasteToCost: dto.applyExpectedWasteToCost,
      isVariableWeight: dto.isVariableWeight,
      trackInventory: dto.trackInventory,
      requiresBatch: dto.requiresBatch,
    });

    return toProductResponse(updated);
  } catch (error) {
    return translateUniqueConstraintError(error);
  }
}

export async function changeStatus(
  id: string,
  dto: ChangeProductStatusDto,
): Promise<ProductResponse> {
  const existing = await productsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Producto');
  }

  const updated = await productsRepository.changeStatus(id, dto.active);

  return toProductResponse(updated);
}

/**
 * Borrado logico de un producto. Idempotente por diseño: no distingue
 * "nunca existio" de "ya fue borrado" -- ambos casos devuelven
 * `NotFoundError`, porque `findById` ya pasa por el filtro global de
 * `deletedAt` (via la extension `softDelete.ext.ts`, con `Product` ya
 * registrado en `SOFT_DELETE_MODELS`). Mismo criterio que
 * `categories/categories.service.ts::remove`.
 *
 * Antes de borrar, se bloquea si el producto tiene historial de ventas o
 * compras: son registros transaccionales/financieros ya cerrados
 * (`SaleItem`/`PurchaseItem`, ambos con `productId` obligatorio) — dejar
 * que el producto "desaparezca" silenciosamente romperia la trazabilidad
 * de esos documentos historicos. Mismo motivo que el bloqueo de
 * `categories.service.ts::remove` (Product.categoryId), aca sobre las
 * lineas de venta/compra que apuntan al producto.
 */
export async function remove(id: string): Promise<void> {
  const existing = await productsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Producto');
  }

  const [saleItemCount, purchaseItemCount] = await Promise.all([
    productsRepository.countSaleItems(id),
    productsRepository.countPurchaseItems(id),
  ]);

  if (saleItemCount > 0) {
    throw new ConflictError('No se puede eliminar el producto porque tiene ventas asociadas.');
  }

  if (purchaseItemCount > 0) {
    throw new ConflictError('No se puede eliminar el producto porque tiene compras asociadas.');
  }

  await productsRepository.softDelete(id);
}

/**
 * POST /products/:id/image (Bloque 10). Crea o reemplaza la imagen del
 * producto — mismo endpoint para ambos casos, ya que `saveProductImage`
 * sobrescribe el archivo existente (nombrado deterministico por
 * `productId`, ver `productImageStorage.ts`) sin dejar huerfanos.
 */
export async function uploadImage(
  id: string,
  file: { mimeType: string; buffer: Buffer },
): Promise<ProductResponse> {
  const existing = await productsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Producto');
  }

  const imageUrl = await saveProductImage({
    productId: id,
    mimeType: file.mimeType,
    buffer: file.buffer,
  });

  const updated = await productsRepository.update(id, { imageUrl });

  return toProductResponse(updated);
}

/** DELETE /products/:id/image (Bloque 10). Borra el archivo fisico (sin
 * importar la extension) y limpia `Product.imageUrl` — el producto vuelve
 * al estado "sin imagen" (placeholder en el frontend). */
export async function deleteImage(id: string): Promise<ProductResponse> {
  const existing = await productsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Producto');
  }

  await deleteProductImage(id);

  const updated = await productsRepository.update(id, { imageUrl: null });

  return toProductResponse(updated);
}
