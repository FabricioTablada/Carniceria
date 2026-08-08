// src/features/products/types/product.types.ts
/**
 * features/products/types/product.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Products. Contrato identico al backend, sin adaptaciones:
 * mismos nombres de propiedad, misma opcionalidad y misma nulabilidad que
 * `modules/products/products.types.ts` y `modules/products/products.validation.ts`
 * (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como llegan
 * realmente por HTTP (JSON no tiene tipo `Date`; Express los serializa a
 * ISO string). No es una traduccion de propiedades ni una capa de
 * adaptacion: es el tipo correcto del dato tal como existe en runtime en
 * el cliente. Mismo criterio ya usado en `user.types.ts` y `role.types.ts`.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Unidad de medida del producto (enum `UnitOfMeasure` de schema.prisma). */
export type UnitOfMeasure = 'KILOGRAM' | 'UNIT'

/** Producto tal como lo expone el backend (`ProductResponse`). */
export interface Product {
  id: string
  categoryId: string
  taxId: string
  sku: string | null
  barcode: string | null
  name: string
  description: string | null
  /** Fase 17: columna aditiva agregada en Fase 16 (`imageUrl` en el
   * backend) — `null` para todo producto sin imagen asignada (los 28
   * productos originales del catalogo, entre otros). */
  imageUrl: string | null
  /** Fase 18 (Bloque 18.1/18.2): SOLO presente (no-null) cuando el listado
   * se pidio con `ProductFilters.sucursalId` — escopado a ESA sucursal
   * puntual, nunca una cifra global del producto. `null` si no se pidio
   * `sucursalId`, o si el producto no tiene existencia registrada en esa
   * sucursal todavia. Reemplaza la necesidad de `useInventory()` por
   * tarjeta en el catalogo del POS (ver `ProductCatalogCard.tsx`). */
  stock: {
    sucursalId: string
    quantity: number
    reorderPoint: number | null
  } | null
  unitOfMeasure: UnitOfMeasure
  salePrice: number
  cost: number
  /** Bloque 7.12: código CABYS (Costa Rica), 13 dígitos — `null` para
   * productos creados antes de este bloque (sin backfill). Enviado como
   * `productKey` a Alegra al emitir factura electrónica. */
  cabysCode: string | null
  /** Bloque COST-05 (backend: 14.4/COST-01.1): porcentaje esperado de
   * merma (0-100), dato maestro vigente del producto. Sin snapshot propio
   * — el CostEngine (backend) es la unica fuente de verdad para calcular
   * el costo efectivo; este campo aqui es solo el insumo de esa formula,
   * nunca un resultado. */
  expectedWastePercent: number
  /** Bloque COST-05: si este producto usa el costo efectivo (calculado a
   * partir de `expectedWastePercent`) en vez del costo promedio (`cost`)
   * para validar ventas y calcular utilidad. `false` por defecto. */
  applyExpectedWasteToCost: boolean
  isVariableWeight: boolean
  trackInventory: boolean
  /** Bloque LOTES-08: si este producto participa del Módulo de Lotes
   * (`features/batches/`) — Compras crea un lote automático al recibirlo,
   * Ventas lo consume por FEFO, Mermas/Devoluciones lo integran por
   * `batchId`. `false` por defecto. */
  requiresBatch: boolean
  active: boolean
  category: {
    id: string
    name: string
    /** Color personalizado de la categoria (hex) — `null` si no tiene
     * uno propio. Mismo campo que `Category.color`
     * (`features/categories/types/category.types.ts`), resolver siempre
     * via `resolveCategoryColor` (`lib/categoryColor.ts`). */
    color: string | null
  }
  tax: {
    id: string
    code: string
    name: string
    rate: number
  }
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un producto.
 * Coincide exactamente con `CreateProductSchema` (Zod) del backend:
 * `sku`/`barcode`/`description` son `.nullish()`; `unitOfMeasure`, `cost`,
 * `isVariableWeight`, `trackInventory` y `active` son `.optional()`.
 */
export interface CreateProductDto {
  categoryId: string
  taxId: string
  sku?: string | null
  barcode?: string | null
  name: string
  description?: string | null
  unitOfMeasure?: UnitOfMeasure
  salePrice: number
  cost?: number
  /** Bloque 7.12: obligatorio, ver `Product.cabysCode`. */
  cabysCode: string
  /** Bloque COST-05: opcional, `Product.expectedWastePercent` por defecto 0. */
  expectedWastePercent?: number
  /** Bloque COST-05: opcional, `Product.applyExpectedWasteToCost` por
   * defecto `false`. */
  applyExpectedWasteToCost?: boolean
  isVariableWeight?: boolean
  trackInventory?: boolean
  /** Bloque LOTES-08: opcional, `Product.requiresBatch` por defecto `false`. */
  requiresBatch?: boolean
  active?: boolean
}

/**
 * Datos permitidos para actualizar un producto.
 * Coincide exactamente con `UpdateProductSchema` (Zod) del backend: todos
 * los campos opcionales, sin `active` (el backend maneja el cambio de
 * estado por separado, en `ChangeProductStatusDto`).
 */
export interface UpdateProductDto {
  categoryId?: string
  taxId?: string
  sku?: string | null
  barcode?: string | null
  name?: string
  description?: string | null
  unitOfMeasure?: UnitOfMeasure
  salePrice?: number
  cost?: number
  /** Bloque 7.12: opcional, ver `Product.cabysCode`. */
  cabysCode?: string
  /** Bloque COST-05: ver `CreateProductDto.expectedWastePercent`. */
  expectedWastePercent?: number
  /** Bloque COST-05: ver `CreateProductDto.applyExpectedWasteToCost`. */
  applyExpectedWasteToCost?: boolean
  isVariableWeight?: boolean
  trackInventory?: boolean
  /** Bloque LOTES-08: ver `CreateProductDto.requiresBatch`. */
  requiresBatch?: boolean
}

/** Payload de PATCH /products/:id/status (`ChangeProductStatusDto` del backend). */
export interface ChangeProductStatusDto {
  active: boolean
}

/**
 * Filtros de listado de productos.
 * Coincide exactamente con `ListProductsFilters` del backend: mismos
 * nombres y mismos tipos.
 */
export interface ProductFilters {
  categoryId?: string
  taxId?: string
  active?: boolean
  search?: string
  /** Pagina solicitada (1-indexado). El backend por defecto devuelve solo
   * la pagina 1 (20 registros, `createdAt desc`) si no se envia — ver
   * `ProductsPage.tsx`, unico consumidor que pagina explicitamente. */
  page?: number
  /** Tamaño de pagina. No se usa hoy (se deja el default del backend, 20). */
  limit?: number
  /** Fase 18 (Bloque 18.2): opcional. Cuando se provee, cada producto de
   * la respuesta incluye su existencia en ESA sucursal (`Product.stock`)
   * en la misma peticion — usado por `SalesPOSPage.tsx` para eliminar el
   * patron N+1 de `ProductCatalogCard.tsx` (una peticion a `useInventory`
   * por tarjeta). Sin este filtro, el comportamiento es identico al de
   * antes de este bloque. */
  sucursalId?: string
}

/**
 * Respuesta real de GET /products.
 * El controlador (`products.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedProductsResponse {
  success: true
  data: Product[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Arquitectura de selectores, Bloque 2: filtros del lookup de productos —
 * mismo criterio que `ProductFilters`, pero sin `page`/`limit`/`categoryId`/
 * `taxId`/`sucursalId` (el lookup no es una tabla paginable, ver backend
 * `LookupProductsFilters`).
 */
export interface ProductLookupFilters {
  search?: string
  active?: boolean
  /** Tamaño de resultados (techo real: `LOOKUP_MAX_LIMIT` del backend,
   * hoy 50 — ver `shared/utils/lookup.ts`). */
  limit?: number
}

/**
 * Item de resultado de GET /products/lookup — coincide exactamente con
 * `ProductLookupItem` del backend. Deliberadamente mas rico que un lookup
 * generico `{id,label}`: trae los campos puntuales que
 * `ProductSearchDialog.tsx` pinta en su fila de resultado (miniatura, SKU,
 * categoria, impuesto, precio), pero sigue sin ser el recurso completo
 * `Product` (sin `barcode`, `description`, `categoryId`, `active`,
 * timestamps). `taxId` SI se incluye — no es solo display,
 * `PurchaseItemsField.tsx` lo necesita para autocompletar el impuesto de
 * la linea de compra al elegir un producto.
 */
export interface ProductLookupItem {
  id: string
  label: string
  sku: string | null
  thumbnail: string | null
  price: number
  categoryName: string
  taxId: string
  taxName: string
  taxRate: number
  unitOfMeasure: UnitOfMeasure
  /** Bloque COST-06.1: `Product.expectedWastePercent` vigente — permite a
   * `PurchaseItemsField.tsx` precargar la merma esperada de cada linea de
   * compra con el valor por defecto del producto. */
  expectedWastePercent: number
  /** Bloque LOTES-09: `Product.requiresBatch` vigente — `PurchaseItemRow.tsx`
   * lo usa para decidir si mostrar los campos de trazabilidad de lote
   * (código de lote del proveedor, fecha de producción, fecha de
   * vencimiento) para esa línea. */
  requiresBatch: boolean
}

/** Respuesta real de GET /products/lookup — sin `meta` de paginacion (el
 * lookup no la tiene, ver backend `shared/utils/lookup.ts`). */
export interface LookupProductsResponse {
  success: true
  data: ProductLookupItem[]
}

/**
 * Version 1.1, Bloque 2 (asistente de CABYS): filtros del lookup de
 * `GET /cabys/lookup` — mismo criterio que `ProductLookupFilters`, sin
 * `active` (el backend siempre filtra por codigos activos, no es una
 * opcion del selector).
 */
export interface CabysLookupFilters {
  search?: string
  limit?: number
}

/** Item de resultado de GET /cabys/lookup — coincide exactamente con
 * `CabysLookupItem` del backend. Deliberadamente distinto del `LookupItem`
 * generico: `ProductCabysField.tsx` necesita el codigo (unico valor que se
 * persiste en `cabysCode`) y la descripcion (solo informativa) como campos
 * separados. */
export interface CabysLookupItem {
  code: string
  description: string
  // Mejora UX (indicador visual del impuesto oficial): coincide exactamente
  // con `CabysLookupItem.taxIndicator` del backend — valor crudo de
  // `CabysCode.taxIndicator`, solo lectura/informativo aqui.
  taxIndicator: string | null
}

/** Respuesta real de GET /cabys/lookup — sin `meta` de paginacion. */
export interface LookupCabysResponse {
  success: true
  data: CabysLookupItem[]
}