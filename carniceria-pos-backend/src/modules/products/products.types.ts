/**
 * modules/products/products.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de productos.
 * Define unicamente las formas de datos que consumen `products.service.ts`,
 * `products.repository.ts` y `products.controller.ts`; no contiene logica
 * de negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `products.service.ts`, `products.repository.ts` y
 * `products.validation.ts`).
 */
import type { PaginationParams } from '@/shared/utils/pagination';
import type { LookupParams } from '@/shared/utils/lookup';

/** Unidad de medida del producto (enum `UnitOfMeasure` de `schema.prisma`). */
export type UnitOfMeasure = 'KILOGRAM' | 'UNIT';

/** Resumen de la categoria asociada a un producto. */
export interface ProductCategorySummary {
  id: string;
  name: string;
  /** Color personalizado de la categoria (hex) — `null` si no tiene uno
   * propio, mismo criterio que `CategoryResponse.color`
   * (`modules/categories/categories.types.ts`). */
  color: string | null;
}

/** Resumen del impuesto asociado a un producto. */
export interface ProductTaxSummary {
  id: string;
  code: string;
  name: string;
  rate: number;
}

/**
 * Existencia del producto en UNA sucursal puntual (Fase 18, Bloque 18.1).
 * Siempre escopado a la `sucursalId` que se pidio en el filtro de listado
 * — nunca una cifra global del producto (`Inventory` es por sucursal,
 * `Product` es catalogo compartido). `null` en `ProductResponse.stock`
 * cuando no se pidio `sucursalId`, o cuando el producto no tiene fila de
 * `Inventory` en esa sucursal todavia (nunca comprado ahi).
 */
export interface ProductStockSummary {
  sucursalId: string;
  quantity: number;
  reorderPoint: number | null;
}

/** Forma de un producto tal como lo expone el modulo hacia el resto de la app. */
export interface ProductResponse {
  id: string;
  categoryId: string;
  taxId: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  // Fase 17: expone la columna aditiva `imageUrl` (agregada en Fase 16,
  // migracion `add_product_image_url`) — hasta ahora existia en la base de
  // datos pero este mapper la descartaba antes de responder.
  imageUrl: string | null;
  // Fase 18 (Bloque 18.1): solo presente (no-null) cuando el listado se
  // pidio con `sucursalId` — ver `ListProductsFilters.sucursalId` y
  // `ProductStockSummary`. Sin ese filtro, siempre `null` (mismo
  // comportamiento que antes de este bloque).
  stock: ProductStockSummary | null;
  unitOfMeasure: UnitOfMeasure;
  salePrice: number;
  cost: number;
  // Bloque 7.12: codigo CABYS (Costa Rica), 13 digitos — `null` para
  // productos creados antes de este bloque (sin backfill). Enviado como
  // `productKey` a Alegra al emitir factura electronica.
  cabysCode: string | null;
  // Bloque 14.4 (Mermas esperadas): porcentaje esperado de merma (0-100),
  // base para el calculo futuro de costos reales. Sin uso real todavia.
  expectedWastePercent: number;
  // Bloque COST-01.1: si este producto participa de la regla de "costo
  // efectivo por merma esperada" (CostEngine, `shared/services/costEngine/`).
  // Sin uso real todavia — el motor no esta integrado con ningun
  // consumidor en este bloque.
  applyExpectedWasteToCost: boolean;
  isVariableWeight: boolean;
  trackInventory: boolean;
  // Bloque LOTES-08 (integracion con Productos): si este producto participa
  // del Modulo de Lotes (`modules/batches`) -- Compras crea un lote
  // automatico al recibirlo, Ventas lo consume por FEFO, Mermas/Devoluciones
  // lo integran por `batchId`. Columna ya existente en `schema.prisma` desde
  // el Bloque LOTES-01 (consumida internamente por Purchases/Sales/Returns/
  // InventoryWaste), pero nunca expuesta ni editable a traves del propio
  // modulo de Productos hasta este bloque.
  requiresBatch: boolean;
  active: boolean;
  category: ProductCategorySummary;
  tax: ProductTaxSummary;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un producto. */
export interface CreateProductDto {
  categoryId: string;
  taxId: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  description?: string | null;
  unitOfMeasure?: UnitOfMeasure;
  salePrice: number;
  cost?: number;
  /** Bloque 7.12: obligatorio, ver `ProductResponse.cabysCode`. */
  cabysCode: string;
  /** Bloque 14.4: opcional, `Product.expectedWastePercent` por defecto 0. */
  expectedWastePercent?: number;
  /** Bloque COST-01.1: opcional, `Product.applyExpectedWasteToCost` por
   * defecto `false`. */
  applyExpectedWasteToCost?: boolean;
  isVariableWeight?: boolean;
  trackInventory?: boolean;
  /** Bloque LOTES-08: opcional, `Product.requiresBatch` por defecto
   * `false` (mismo criterio que `isVariableWeight`/`trackInventory`). */
  requiresBatch?: boolean;
  active?: boolean;
}

/** Datos permitidos para actualizar un producto existente. Todos opcionales. */
export interface UpdateProductDto {
  categoryId?: string;
  taxId?: string;
  sku?: string | null;
  barcode?: string | null;
  name?: string;
  description?: string | null;
  unitOfMeasure?: UnitOfMeasure;
  salePrice?: number;
  cost?: number;
  /** Bloque 7.12: opcional, ver `ProductResponse.cabysCode`. */
  cabysCode?: string;
  /** Bloque 14.4: opcional, ver `CreateProductDto.expectedWastePercent`. */
  expectedWastePercent?: number;
  /** Bloque COST-01.1: opcional, ver
   * `CreateProductDto.applyExpectedWasteToCost`. */
  applyExpectedWasteToCost?: boolean;
  isVariableWeight?: boolean;
  trackInventory?: boolean;
  /** Bloque LOTES-08: opcional, ver `CreateProductDto.requiresBatch`. */
  requiresBatch?: boolean;
}

/** Filtros de busqueda/listado disponibles para productos. */
export interface ListProductsFilters {
  categoryId?: string;
  taxId?: string;
  active?: boolean;
  search?: string;
  /** Fase 18 (Bloque 18.1): opcional. Cuando se provee, el listado incluye
   * el stock de esa sucursal para cada producto (`ProductResponse.stock`)
   * en la MISMA consulta — elimina el patron N+1 de pedir el inventario
   * de cada producto por separado. Sin este filtro, el comportamiento es
   * identico al de antes de este bloque. */
  sucursalId?: string;
}

/** Parametros combinados para listar productos: filtros + paginacion. */
export interface ListProductsQuery extends PaginationParams {
  filters?: ListProductsFilters;
}

/** Filtros del patron de lookup (busqueda acotada para selectores) —
 * deliberadamente mas chico que `ListProductsFilters`: solo lo que un
 * selector necesita para acotar resultados, ver `shared/utils/lookup.ts`. */
export interface LookupProductsFilters {
  search?: string;
  active?: boolean;
}

/** Parametros combinados para el lookup de productos: filtros + `take`. */
export interface LookupProductsQuery extends LookupParams {
  filters?: LookupProductsFilters;
}

/**
 * Arquitectura de selectores, Bloque 2 (frontend): forma especifica del
 * lookup de productos — DELIBERADAMENTE mas rica que el `LookupItem`
 * generico (`shared/utils/lookup.ts`, `{id,label}`) porque
 * `ProductSearchDialog.tsx` necesita mostrar miniatura/SKU/categoria/
 * impuesto/precio por fila sin perder esa experiencia visual al migrar
 * fuera de `GET /products`. Sigue sin ser el recurso completo
 * (`ProductResponse`): sin `barcode`, sin `description`, sin `categoryId`,
 * sin `active`/timestamps — solo lo que esa fila realmente pinta o que su
 * consumidor necesita funcionalmente. `price` mapea de `Product.cost` (no
 * `salePrice`): el dialogo vive en Compras y siempre mostro el costo, no
 * el precio de venta — mismo comportamiento exacto que antes de este
 * bloque. `taxId` (a diferencia de `categoryId`) SI se incluye: no es solo
 * display — `PurchaseItemsField.tsx` lo necesita para autocompletar el
 * impuesto de la linea de compra al elegir un producto (siempre lo hizo,
 * con el `Product` completo de antes de este bloque); es un campo escalar
 * de `Product`, no una relacion completa.
 */
export interface ProductLookupItem {
  id: string;
  label: string;
  sku: string | null;
  thumbnail: string | null;
  price: number;
  categoryName: string;
  taxId: string;
  taxName: string;
  taxRate: number;
  unitOfMeasure: UnitOfMeasure;
  /** Bloque COST-06.1: `Product.expectedWastePercent` vigente — permite a
   * Compras precargar la merma esperada de cada linea con el valor por
   * defecto del producto, editable libremente despues. Puramente
   * informativo aca; el lookup nunca escribe este dato. */
  expectedWastePercent: number;
  /** Bloque LOTES-09: `Product.requiresBatch` vigente — permite a Compras
   * decidir, por linea, si mostrar los campos de trazabilidad de lote
   * (codigo de lote del proveedor, fecha de produccion, fecha de
   * vencimiento). Puramente informativo aca; el lookup nunca escribe este
   * dato. */
  requiresBatch: boolean;
}

/** Payload para cambiar el estado (activo/inactivo) de un producto. */
export interface ChangeProductStatusDto {
  active: boolean;
}

/** Resultado de una operacion de listado paginado de productos. */
export interface ListProductsResult {
  items: ProductResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico producto. */
export interface ProductResult {
  product: ProductResponse;
}
