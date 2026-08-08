/**
 * features/promotions/types/promotion.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Promotions (Bloque P.3, catalogo administrativo).
 * Contrato identico al backend, sin adaptaciones: mismos nombres de
 * propiedad, misma opcionalidad y misma nulabilidad que
 * `modules/promotions/promotions.types.ts` y
 * `modules/promotions/promotions.validation.ts` (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`startDate`,
 * `endDate`, `createdAt`, `updatedAt`) se tipan aqui como `string`, mismo
 * criterio ya usado en `tax.types.ts`/`sale.types.ts`. `startTime`/
 * `endTime` ya viajan como string "HH:mm" desde el backend (conversion
 * hecha en `promotions.service.ts`), no hay diferencia de tipo aca.
 *
 * ARQUITECTURA (ver analisis aprobado): esta es la unica entidad de
 * CONFIGURACION del Motor de Promociones — sin logica de aplicacion/
 * calculo en este bloque. No confundir con `SaleAppliedPromotion`
 * (`sale.types.ts`, Bloque P.1/P.2): esa es la auditoria de lo que
 * REALMENTE ocurrio en una venta; esta es el catalogo de reglas
 * configurables, todavia sin ningun motor que las aplique.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** A que aplica una promocion (enum `PromotionScopeType` de `schema.prisma`). */
export type PromotionScopeType = 'PRODUCT' | 'CATEGORY' | 'COMBO' | 'CART'

/** Como se calcula el beneficio (enum `PromotionEffectType` de
 * `schema.prisma`). `BUY_X_PAY_Y` generaliza 2x1/3x2. `FIXED_PRICE`
 * (PROMO-13) fija el precio POR UNIDAD — distinto de `SPECIAL_PRICE`, que
 * fija el precio TOTAL del conjunto de lineas afectadas; solo valido con
 * `scopeType: PRODUCT`/`CATEGORY` (ver `promotion.schema.ts`). */
export type PromotionEffectType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'SPECIAL_PRICE'
  | 'FIXED_PRICE'
  | 'BUY_X_PAY_Y'

/** Dia de la semana (enum `DayOfWeek` de `schema.prisma`). */
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

/** PROMO-03/07 (Commercial Pricing Engine): quien decide que esta regla
 * exista (enum `PromotionOrigin` de `schema.prisma`). `INTERNAL` (default)
 * = decision propia del negocio. `SUPPLIER_MANDATED` = condicion
 * comercial impuesta por un proveedor (ej. "Martes de Pechuga", "Precio
 * obligatorio") — no es una mecanica nueva, sigue usando
 * `scopeType`/`effectType` existentes; este campo solo distingue el
 * origen, ortogonal a que hace la promocion. */
export type PromotionOrigin = 'INTERNAL' | 'SUPPLIER_MANDATED'

/** PROMO-03/07: quien financia el descuento que ve el cliente (enum
 * `PromotionFundingType` de `schema.prisma`). `NONE` (default) = el
 * negocio absorbe el descuento completo. Los otros dos valores describen
 * que el proveedor devuelve, por unidad o por porcentaje, parte o todo el
 * descuento — el monto/porcentaje concreto vive en
 * `supplierSubsidyValue`. */
export type PromotionFundingType = 'NONE' | 'SUPPLIER_SUBSIDY_PER_UNIT' | 'SUPPLIER_SUBSIDY_PERCENTAGE'

/** Una linea de producto a asociar a la promocion. `requiredQuantity`
 * solo se usa cuando `scopeType: COMBO`. */
export interface PromotionProductInput {
  productId: string
  requiredQuantity?: number | null
}

/** Resumen del producto de una linea de promocion, resuelto por el
 * backend. */
export interface PromotionProductSummary {
  id: string
  name: string
  sku: string | null
}

/** Linea de producto tal como la expone el backend. */
export interface PromotionProduct {
  productId: string
  requiredQuantity: number | null
  product: PromotionProductSummary
}

/** Resumen de la categoria de una linea de promocion, resuelto por el
 * backend. */
export interface PromotionCategorySummary {
  id: string
  name: string
}

/** Linea de categoria tal como la expone el backend. */
export interface PromotionCategory {
  categoryId: string
  category: PromotionCategorySummary
}

/** Resumen de la sucursal asociada a una promocion. `null` = aplica a
 * todas las sucursales. */
export interface PromotionSucursalSummary {
  id: string
  name: string
}

/** PROMO-03/07: resumen del proveedor asociado a una promocion. `null` =
 * sin proveedor asociado. */
export interface PromotionSupplierSummary {
  id: string
  name: string
}

/** Promocion tal como la expone el backend (`PromotionResponse`). */
export interface Promotion {
  id: string
  name: string
  description: string | null
  scopeType: PromotionScopeType
  effectType: PromotionEffectType
  effectValue: number | null
  buyQuantity: number | null
  payQuantity: number | null
  minQuantity: number | null
  startDate: string | null
  endDate: string | null
  startTime: string | null
  endTime: string | null
  daysOfWeek: DayOfWeek[]
  priority: number
  stackable: boolean
  exclusiveGroup: string | null
  active: boolean
  sucursalId: string | null
  sucursal: PromotionSucursalSummary | null
  /** PROMO-03/07 (Commercial Pricing Engine). */
  supplierId: string | null
  supplier: PromotionSupplierSummary | null
  commercialOrigin: PromotionOrigin
  fundingType: PromotionFundingType
  supplierSubsidyValue: number | null
  products: PromotionProduct[]
  categories: PromotionCategory[]
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear una promocion.
 * Coincide exactamente con `CreatePromotionSchema` (Zod) del backend.
 */
export interface CreatePromotionDto {
  name: string
  description?: string | null
  scopeType: PromotionScopeType
  effectType: PromotionEffectType
  effectValue?: number | null
  buyQuantity?: number | null
  payQuantity?: number | null
  minQuantity?: number | null
  startDate?: string | null
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  daysOfWeek?: DayOfWeek[]
  priority?: number
  stackable?: boolean
  exclusiveGroup?: string | null
  active?: boolean
  sucursalId?: string | null
  /** PROMO-03/07: proveedor que origina/financia la promocion. `null`/
   * ausente = sin proveedor asociado (promocion propia del negocio). */
  supplierId?: string | null
  /** PROMO-03/07: por que existe esta regla. Default `INTERNAL` (aplicado
   * en el backend). */
  commercialOrigin?: PromotionOrigin
  /** PROMO-03/07: quien financia el descuento. Default `NONE`. */
  fundingType?: PromotionFundingType
  /** PROMO-03/07: monto (SUPPLIER_SUBSIDY_PER_UNIT) o porcentaje
   * (SUPPLIER_SUBSIDY_PERCENTAGE) segun `fundingType` — obligatorio
   * cuando `fundingType !== 'NONE'`, debe quedar vacio en caso contrario
   * (mismas reglas que el backend, `promotion.schema.ts`). */
  supplierSubsidyValue?: number | null
  productIds?: PromotionProductInput[]
  categoryIds?: string[]
}

/**
 * Datos permitidos para actualizar una promocion.
 * Coincide exactamente con `UpdatePromotionSchema` (Zod) del backend:
 * mismos campos que `CreatePromotionDto`, todos opcionales, sin `active`
 * (cambio de estado por separado, `ChangePromotionStatusDto`).
 */
export type UpdatePromotionDto = Omit<Partial<CreatePromotionDto>, 'active'>

/** Payload de PATCH /promotions/:id/status (`ChangePromotionStatusDto`
 * del backend). */
export interface ChangePromotionStatusDto {
  active: boolean
}

/**
 * Filtros de listado de promociones.
 * Coincide exactamente con `ListPromotionsFilters` del backend.
 */
export interface PromotionFilters {
  active?: boolean
  scopeType?: PromotionScopeType
  search?: string
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 3:
   * mismo criterio ya usado por `ProductFilters`/`ListInventoryWasteFilters`. */
  page?: number
  limit?: number
}

/**
 * Respuesta real de GET /promotions.
 * El controlador (`promotions.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedPromotionsResponse {
  success: true
  data: Promotion[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
