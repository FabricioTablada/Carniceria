/**
 * modules/promotions/promotions.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de Promociones (Bloque P.3, catalogo
 * administrativo). Define unicamente las formas de datos que consumen
 * `promotions.service.ts`, `promotions.repository.ts` y
 * `promotions.controller.ts`; no contiene logica de negocio, consultas
 * Prisma ni validaciones (eso vive en `promotions.service.ts`,
 * `promotions.repository.ts` y `promotions.validation.ts` respectivamente).
 *
 * ARQUITECTURA (ver analisis aprobado): esta es la unica entidad de
 * CONFIGURACION del Motor de Promociones. Separada a proposito de
 * `SaleAppliedPromotion` (Bloque P.1, modulo `sales`, tabla de AUDITORIA —
 * que ocurrio, nunca que deberia ocurrir) y del futuro motor de reglas
 * (bloque posterior, que LEE este catalogo, nunca vive dentro de el). Este
 * bloque NO implementa ningun calculo ni aplicacion automatica — solo el
 * catalogo.
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** A que aplica una promocion (enum `PromotionScopeType` de `schema.prisma`). */
export type PromotionScopeType = 'PRODUCT' | 'CATEGORY' | 'COMBO' | 'CART';

/** Como se calcula el beneficio (enum `PromotionEffectType` de
 * `schema.prisma`). `BUY_X_PAY_Y` generaliza 2x1/3x2 como el mismo
 * mecanismo con distintos parametros. */
export type PromotionEffectType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'SPECIAL_PRICE'
  | 'FIXED_PRICE'
  | 'BUY_X_PAY_Y';

/** Dia de la semana (enum `DayOfWeek` de `schema.prisma`). */
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/** PROMO-03/05 (Commercial Pricing Engine): quien decide que esta regla
 * exista (enum `PromotionOrigin` de `schema.prisma`). `INTERNAL` (default)
 * = decision propia del negocio. `SUPPLIER_MANDATED` = condicion comercial
 * impuesta por un proveedor (ej. "Martes de Pechuga", "Precio
 * obligatorio") — no es una mecanica nueva, sigue usando
 * `scopeType`/`effectType` existentes; este campo solo distingue el
 * origen, ortogonal a que hace la promocion. */
export type PromotionOrigin = 'INTERNAL' | 'SUPPLIER_MANDATED';

/** PROMO-03/05: quien financia el descuento que ve el cliente (enum
 * `PromotionFundingType` de `schema.prisma`). `NONE` (default) = el
 * negocio absorbe el descuento completo. Los otros dos valores describen
 * que el proveedor devuelve, por unidad o por porcentaje, parte o todo el
 * descuento — el monto/porcentaje concreto vive en
 * `supplierSubsidyValue`. */
export type PromotionFundingType =
  | 'NONE'
  | 'SUPPLIER_SUBSIDY_PER_UNIT'
  | 'SUPPLIER_SUBSIDY_PERCENTAGE';

/** Una linea de producto asociada a la promocion. `requiredQuantity` solo
 * tiene sentido cuando `scopeType: COMBO` (cuantas unidades de ESE
 * producto exige el combo); se ignora para `scopeType: PRODUCT`. */
export interface PromotionProductInput {
  productId: string;
  requiredQuantity?: number | null;
}

/** Datos requeridos para crear una promocion. El cliente declara todo el
 * catalogo de la regla; nada se calcula aca (sin logica de aplicacion en
 * este bloque). `productIds`/`categoryIds` son mutuamente relevantes segun
 * `scopeType` — la validacion de que combinacion corresponde a cada
 * `scopeType`/`effectType` vive en `promotions.validation.ts`. */
export interface CreatePromotionDto {
  name: string;
  description?: string | null;
  scopeType: PromotionScopeType;
  effectType: PromotionEffectType;
  effectValue?: number | null;
  buyQuantity?: number | null;
  payQuantity?: number | null;
  minQuantity?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  /** Formato "HH:mm" — se traduce a `@db.Time` dentro del servicio, nunca
   * se expone el detalle de esa representacion al cliente. */
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek?: DayOfWeek[];
  priority?: number;
  stackable?: boolean;
  exclusiveGroup?: string | null;
  active?: boolean;
  sucursalId?: string | null;
  /** PROMO-03/05: proveedor que origina/financia la promocion. `null`/
   * ausente = sin proveedor asociado (promocion propia del negocio). */
  supplierId?: string | null;
  /** PROMO-03/05: por que existe esta regla. Default `INTERNAL` (aplicado
   * en el servicio, mismo criterio que `priority`/`stackable`/`active`). */
  commercialOrigin?: PromotionOrigin;
  /** PROMO-03/05: quien financia el descuento. Default `NONE`. */
  fundingType?: PromotionFundingType;
  /** PROMO-03/05: monto (SUPPLIER_SUBSIDY_PER_UNIT) o porcentaje
   * (SUPPLIER_SUBSIDY_PERCENTAGE) segun `fundingType` — obligatorio
   * cuando `fundingType !== 'NONE'`, debe quedar vacio en caso contrario
   * (`promotions.validation.ts`/`promotions.service.ts` exigen esta
   * coherencia). */
  supplierSubsidyValue?: number | null;
  productIds?: PromotionProductInput[];
  categoryIds?: string[];
}

/** Datos permitidos para actualizar una promocion existente. Mismos campos
 * que `CreatePromotionDto`, todos opcionales — un campo ausente no se
 * modifica; para vaciar `productIds`/`categoryIds` se envia un array
 * vacio explicito, no se omite la clave. */
export type UpdatePromotionDto = Partial<CreatePromotionDto>;

/** Payload para cambiar el estado (activo/inactivo) de una promocion. */
export interface ChangePromotionStatusDto {
  active: boolean;
}

/** Filtros de busqueda/listado disponibles para promociones. */
export interface ListPromotionsFilters {
  active?: boolean;
  scopeType?: PromotionScopeType;
  search?: string;
}

/** Parametros combinados para listar promociones: filtros + paginacion. */
export interface ListPromotionsQuery extends PaginationParams {
  filters?: ListPromotionsFilters;
}

/** Resumen del producto asociado a una linea de promocion. */
export interface PromotionProductSummary {
  id: string;
  name: string;
  sku: string | null;
}

/** Linea de producto tal como la expone el modulo. */
export interface PromotionProductResponse {
  productId: string;
  requiredQuantity: number | null;
  product: PromotionProductSummary;
}

/** Resumen de la categoria asociada a una linea de promocion. */
export interface PromotionCategorySummary {
  id: string;
  name: string;
}

/** Linea de categoria tal como la expone el modulo. */
export interface PromotionCategoryResponse {
  categoryId: string;
  category: PromotionCategorySummary;
}

/** Resumen de la sucursal asociada a una promocion. `null` = aplica a
 * todas las sucursales. */
export interface PromotionSucursalSummary {
  id: string;
  name: string;
}

/** PROMO-03/05: resumen del proveedor asociado a una promocion. `null` =
 * sin proveedor asociado. */
export interface PromotionSupplierSummary {
  id: string;
  name: string;
}

/** Forma de una promocion tal como la expone el modulo hacia el resto de
 * la app. */
export interface PromotionResponse {
  id: string;
  name: string;
  description: string | null;
  scopeType: PromotionScopeType;
  effectType: PromotionEffectType;
  effectValue: number | null;
  buyQuantity: number | null;
  payQuantity: number | null;
  minQuantity: number | null;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: DayOfWeek[];
  priority: number;
  stackable: boolean;
  exclusiveGroup: string | null;
  active: boolean;
  sucursalId: string | null;
  sucursal: PromotionSucursalSummary | null;
  /** PROMO-03/05. */
  supplierId: string | null;
  supplier: PromotionSupplierSummary | null;
  commercialOrigin: PromotionOrigin;
  fundingType: PromotionFundingType;
  supplierSubsidyValue: number | null;
  products: PromotionProductResponse[];
  categories: PromotionCategoryResponse[];
  createdAt: Date;
  updatedAt: Date;
}

/** Resultado de una operacion de listado paginado de promociones. */
export interface ListPromotionsResult {
  items: PromotionResponse[];
  total: number;
}
