/**
 * features/purchases/types/purchase.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Purchases. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/purchases/types.ts` y
 * `modules/purchases/validation.ts` (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend
 * (`purchaseDate`, `createdAt`, `updatedAt`) se tipan aqui como `string`,
 * porque asi es como viajan realmente por HTTP (JSON no tiene tipo `Date`;
 * se serializan a ISO string tanto en la respuesta del servidor como en lo
 * que el cliente envia). Mismo criterio ya usado en `user.types.ts`,
 * `product.types.ts`, `category.types.ts`, `sale.types.ts` e
 * `inventory.types.ts`.
 *
 * NOTA (igual que en el backend): `Purchase` no tiene campo `active` ni
 * endpoint de cambio de estado — el estado de una compra se maneja con
 * `status` (`PurchaseStatus`), editable via `UpdatePurchaseDto`.
 *
 * NOTA: `CreatePurchaseDto` NO incluye `sucursalId` ni `userId` — el
 * backend los resuelve desde `req.user` (JWT), no los acepta del cliente
 * (`purchases.controller.ts`/`purchases.validation.ts`, mismo criterio ya
 * aplicado en Sales y en `openSession`/`closeSession` de Cash). `Purchase`
 * (la respuesta) sigue exponiendo `sucursalId`/`userId`, porque esos
 * datos si viajan de vuelta al cliente una vez creada la compra.
 *
 * NOTA: `UpdatePurchaseDto` todavia incluye `sucursalId`/`userId`
 * opcionales, sin cambios — ese hallazgo quedo documentado por separado,
 * fuera del alcance de este bloque (ver analisis de correccion de
 * Purchases, backend).
 *
 * NOTA (igual que en el backend): `lineSubtotal`, `lineTax`, `lineTotal`,
 * `subtotal`, `taxTotal` y `total` nunca se envian desde el cliente — los
 * calcula el backend a partir de `quantity` y `unitCost`. Por eso no
 * aparecen en `CreatePurchaseItemDto`, `CreatePurchaseDto` ni
 * `UpdatePurchaseDto`, solo en `Purchase`.
 *
 * NOTA: `PurchaseResult` (backend) esta declarado en
 * `modules/purchases/types.ts` pero `purchases.service.ts` nunca lo
 * retorna (`create`/`findById`/`update` devuelven `PurchaseResponse`
 * directo) — mismo caso ya detectado con `SaleResult` en Sales,
 * `ProductResult` en Products e `InventoryResult` en Inventory. No se
 * copia al frontend.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Estado de la compra (enum `PurchaseStatus` de schema.prisma). */
export type PurchaseStatus = 'DRAFT' | 'RECEIVED' | 'CANCELLED'

/**
 * Detalle de compra tal como lo expone el backend
 * (`PurchaseItemResponse`). `unitCost` es el valor recibido del cliente;
 * `taxRate`, `lineSubtotal`, `lineTax` y `lineTotal` son un snapshot
 * calculado por el backend al momento de la compra.
 */
export interface PurchaseItem {
  id: string
  productId: string
  taxId: string | null
  quantity: number
  unitCost: number
  taxRate: number
  /** Bloque COST-06.1: merma esperada de ESTE lote/recepcion especifica —
   * independiente de `Product.expectedWastePercent` (el valor por defecto
   * del producto, que esta linea nunca modifica). `null` cuando la linea
   * no la especifico. Puramente informativo: sin uso en ningun calculo
   * todavia. */
  expectedWastePercent: number | null
  /** Bloque LOTES-09: trazabilidad del lote de ESTA recepción, propagada
   * tal cual al `Batch` automático cuando el producto tiene
   * `Product.requiresBatch`. `null` cuando la línea no la especificó (o el
   * producto no usa lotes). `productionDate`/`expiryDate` son fecha-solo
   * (`YYYY-MM-DD`), mismo criterio que `Purchase.purchaseDate`. */
  supplierLotCode: string | null
  productionDate: string | null
  expiryDate: string | null
  lineSubtotal: number
  lineTax: number
  lineTotal: number
  /** Motor de Documentos (PURCHASE_ORDER): resumen de producto/impuesto,
   * mismo criterio que `SaleItem.product`/`.tax` — el backend ahora lo
   * incluye (`purchases/repository.ts`) para que cualquier vista muestre
   * el nombre de la línea sin un lookup aparte. */
  product: {
    id: string
    name: string
    sku: string | null
    unitOfMeasure: 'KILOGRAM' | 'UNIT'
  }
  tax: {
    id: string
    name: string
  } | null
}

/**
 * Compra tal como la expone el backend (`PurchaseResponse`). `subtotal`,
 * `taxTotal` y `total` son calculados por el backend; nunca se reciben
 * del cliente.
 */
export interface Purchase {
  id: string
  sucursalId: string
  supplierId: string
  userId: string
  documentNumber: string | null
  status: PurchaseStatus
  purchaseDate: string
  subtotal: number
  taxTotal: number
  total: number
  notes: string | null
  sucursal: {
    id: string
    code: string
    name: string
  }
  supplier: {
    id: string
    name: string
  }
  user: {
    id: string
    fullName: string
  }
  items: PurchaseItem[]
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un detalle de compra dentro de
 * `CreatePurchaseDto`. Coincide exactamente con el
 * `CreatePurchaseItemSchema` (Zod) del backend: el cliente solo declara
 * producto, impuesto (si aplica), cantidad y costo unitario; los importes
 * de linea los calcula el backend.
 */
export interface CreatePurchaseItemDto {
  productId: string
  taxId?: string | null
  quantity: number
  unitCost: number
  /** Bloque COST-06.1: opcional, ver `PurchaseItem.expectedWastePercent`. */
  expectedWastePercent?: number | null
  /** Bloque LOTES-09: opcionales, ver `PurchaseItem.supplierLotCode`/
   * `productionDate`/`expiryDate`. Solo tienen sentido de negocio cuando
   * `ProductLookupItem.requiresBatch` es `true` para el producto de esta
   * línea — `PurchaseItemRow.tsx` decide cuándo mostrarlos. */
  supplierLotCode?: string | null
  productionDate?: string | null
  expiryDate?: string | null
}

/**
 * Datos requeridos para crear una compra junto con sus detalles.
 * Coincide exactamente con `CreatePurchaseSchema` (Zod) del backend:
 * `documentNumber`/`notes` son `.nullish()`; `status` y `purchaseDate`
 * son `.optional()`. Los totales de la compra no se envian: el backend
 * los calcula a partir de `items`. `sucursalId`/`userId` tampoco se
 * envian: el backend los resuelve desde el usuario autenticado.
 */
export interface CreatePurchaseDto {
  supplierId: string
  documentNumber?: string | null
  status?: PurchaseStatus
  purchaseDate?: string
  notes?: string | null
  items: CreatePurchaseItemDto[]
}

/**
 * Datos permitidos para actualizar una compra existente. Coincide
 * exactamente con `UpdatePurchaseSchema` (Zod) del backend: todos los
 * campos opcionales. Los detalles (`items`) no se editan por esta via, y
 * por lo tanto tampoco los totales derivados de ellos.
 */
export interface UpdatePurchaseDto {
  sucursalId?: string
  supplierId?: string
  userId?: string
  documentNumber?: string | null
  status?: PurchaseStatus
  purchaseDate?: string
  notes?: string | null
}

/**
 * Filtros de listado de compras.
 * Coincide exactamente con `ListPurchasesFilters` del backend: mismos
 * nombres y mismos tipos.
 */
export interface PurchaseFilters {
  sucursalId?: string
  supplierId?: string
  status?: PurchaseStatus
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 4:
   * mismo criterio ya usado por `ProductFilters`/`CategoryFilters`. */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /purchases.
 * El controlador (`purchases/controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedPurchasesResponse {
  success: true
  data: Purchase[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}