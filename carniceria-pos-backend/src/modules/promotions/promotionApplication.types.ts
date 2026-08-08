/**
 * modules/promotions/promotionApplication.types.ts
 * -----------------------------------------------------------------------------
 * Tipos de la capa adaptadora (Bloque P.5) entre el Motor de Reglas
 * (`shared/services/promotionEngine/`, agnostico de Ventas) y el dominio
 * de Ventas (`sales/service.ts`, agnostico de la implementacion interna
 * del motor). Vocabulario en terminos de VENTAS (`saleItemId`,
 * `lineSubtotal`, `taxRate`) — nunca en terminos del motor (`lineId`,
 * `EngineCartLine`) — para que quien consuma esta capa no necesite saber
 * que el motor existe por debajo.
 */
import type { PromotionEffectType } from '@/shared/services/promotionEngine';
import type { PricingFundingType } from '@/shared/services/pricingAnalysis';

export type { PromotionEffectType };

/** PROMO-10: mismo vocabulario que `PromotionOrigin` (`promotions.types.ts`),
 * redeclarado aca por el mismo motivo que `PricingFundingType` ya se
 * redeclara mas abajo — desacoplar esta capa del modulo administrativo. */
export type PromotionOrigin = 'INTERNAL' | 'SUPPLIER_MANDATED';

/**
 * Una linea de venta (real o TEMPORAL, todavia sin persistir — sirve
 * tanto para una venta nueva del POS como para una cotizacion futura)
 * traducida al vocabulario minimo que esta capa necesita.
 *
 * `saleItemId`: en una venta ya persistida es el id real de `SaleItem`;
 * en una venta que todavia no se creo (el caso normal del POS, evaluado
 * ANTES de `computeItems()`/`salesRepository.create()`) es un id
 * temporal que el caller genera (ej. el indice de la linea en el
 * carrito) — esta capa nunca lo interpreta como un id de base de datos,
 * solo lo usa para devolver el resultado ya separado por linea.
 *
 * `categoryId`: Ventas no la necesita para nada propio (`computeItems()`
 * no la usa) — existe aca UNICAMENTE porque el motor la requiere para
 * evaluar promociones `scopeType: CATEGORY`. Es responsabilidad de quien
 * arme este carrito (bloque futuro de integracion) resolverla desde
 * `Product.categoryId`.
 *
 * `lineSubtotal`: el subtotal de la linea YA calculado (cantidad *
 * precio unitario, con el descuento de linea manual ya restado si
 * corresponde) — la base sobre la que las promociones automaticas
 * calculan su propio descuento adicional, mismo criterio que
 * `computeItems()` en `sales/service.ts` usa para el impuesto.
 */
export interface PromotionApplicationCartLine {
  saleItemId: string;
  productId: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  /** Snapshot de la tasa de impuesto de la linea (`SaleItem.taxRate`) —
   * necesaria para recalcular el impuesto sobre el subtotal ya ajustado
   * por promociones, sin duplicar la logica de calculo de impuesto que
   * ya vive en `sales/service.ts`. */
  taxRate: number;
}

/** Contexto de evaluacion en terminos de Ventas. `now` es opcional —
 * si se omite, el adaptador (no el motor, que exige el parametro
 * siempre) usa el momento real; se puede fijar explicitamente para
 * pruebas o para una cotizacion que deba evaluarse "como si" fuera otro
 * momento. */
export interface PromotionApplicationContext {
  sucursalId: string;
  now?: Date;
}

/** Resultado de promociones automaticas para UNA linea del carrito. */
export interface PromotionApplicationLineResult {
  saleItemId: string;
  /** Suma de todas las promociones automaticas que afectaron esta linea
   * (puede ser 0 si ninguna aplico). Distinto de `SaleItem.discount`
   * (descuento MANUAL de linea, Bloque previo a este Motor) — combinar
   * ambos, si corresponde, es decision de quien integre esta capa. */
  promotionDiscount: number;
  /** `lineSubtotal` de entrada menos `promotionDiscount` (nunca
   * negativo). */
  adjustedLineSubtotal: number;
  /** Impuesto recalculado SOBRE `adjustedLineSubtotal`, usando la misma
   * `taxRate` de entrada (snapshot, sin cambios) — mismo orden de
   * calculo que `computeItems()`: el descuento se resta ANTES de
   * calcular el impuesto. */
  adjustedLineTax: number;
  /** `adjustedLineSubtotal + adjustedLineTax`. */
  adjustedLineTotal: number;
}

/**
 * Un descuento automatico listo para convertirse en una fila de
 * `SaleAppliedPromotion` (Bloque P.1/P.2) — UNA fila por combinacion
 * (promocion, linea afectada); si una promocion afecta varias lineas
 * (ej. `scopeType: CATEGORY` con dos productos de esa categoria en el
 * carrito), produce una entrada por cada una, con su porcion
 * proporcional del monto total — el modelo `SaleAppliedPromotion` solo
 * admite UN `saleItemId` por fila, nunca una lista.
 *
 * `saleItemId: null` = descuento a nivel de carrito completo
 * (`scopeType: CART`), mismo significado que ya usa
 * `SaleAppliedPromotion.saleItemId` para el descuento manual (Bloque
 * P.1).
 *
 * NOTA DE INTEGRACION (decision NO tomada en este bloque, ver
 * `promotions.service.ts`/Bloque P.1): `SaleAppliedPromotion.discountType`
 * hoy es `SaleDiscountType` (`PERCENTAGE`/`FIXED`/`NONE`), un vocabulario
 * mas angosto que `PromotionEffectType` (que ademas incluye
 * `SPECIAL_PRICE`/`FIXED_PRICE`/`BUY_X_PAY_Y`). Persistir `effectType`/`effectValue`
 * tal cual salen de esta capa requerira ampliar esa columna (o agregar
 * una nueva) en el bloque que efectivamente conecte esto a
 * `sales.service.ts` — aca solo se expone el dato correcto, sin resolver
 * ese ajuste de esquema todavia.
 */
export interface PromotionApplicationAppliedPromotion {
  saleItemId: string | null;
  promotionId: string;
  promotionName: string;
  effectType: PromotionEffectType;
  /** Snapshot del valor CRUDO de la regla (el porcentaje o monto
   * configurado en el catalogo, NO el resultado del calculo — eso es
   * `amountApplied`). `null` para `BUY_X_PAY_Y`. Mismo campo que
   * `EngineAppliedPromotion.effectValue` (Bloque P.4), propagado sin
   * cambios — necesario para que Bloque P.6 pueda snapshotear la regla
   * completa en `SaleAppliedPromotion`, no solo el monto. */
  effectValue: number | null;
  /** Monto ya prorrateado para ESTA linea especificamente (o el monto
   * completo si `saleItemId` es `null`, carrito completo). */
  amountApplied: number;
  /** PROMO-09 (integracion de Pricing Analysis en Ventas): campos
   * comerciales (PROMO-03) de la promocion que genero este descuento,
   * propagados sin cambios desde el catalogo ya cargado por
   * `findActiveForEvaluation()` — sin ninguna consulta adicional.
   * Necesarios para que `sales/service.ts` calcule el aporte del
   * proveedor de esta linea (`calculateLineProfitability()`,
   * `shared/services/pricingAnalysis/`) sin volver a tocar la base de
   * datos. `fundingType: 'NONE'`/`supplierSubsidyValue: null` es el caso
   * normal (promocion sin financiamiento externo). */
  fundingType: PricingFundingType;
  supplierSubsidyValue: number | null;
  /** PROMO-10 (snapshot historico): mismo criterio que `fundingType`/
   * `supplierSubsidyValue` arriba — propagados sin cambios desde el
   * catalogo, para que `sales/service.ts` pueda snapshotearlos en
   * `SaleAppliedPromotion` sin ninguna consulta adicional. */
  commercialOrigin: PromotionOrigin;
  supplierId: string | null;
}

/** Totales recalculados incorporando el efecto de las promociones
 * automaticas — mismo vocabulario que `Sale.subtotal/taxTotal/total`
 * (`sales/service.ts`), listos para que quien integre esta capa decida
 * como combinarlos con el descuento manual de carrito ya existente
 * (`Sale.discountType`/`discountValue`/`discountTotal`, sin cambios). */
export interface PromotionApplicationTotals {
  /** Suma de `adjustedLineSubtotal` de todas las lineas — YA incorpora
   * los descuentos automaticos de linea (no es el subtotal "antes" de
   * promociones). */
  subtotal: number;
  /** Suma de `adjustedLineTax` de todas las lineas. */
  taxTotal: number;
  /** Suma de TODOS los descuentos automaticos (de linea + a nivel de
   * carrito) — cifra informativa de ahorro total, NO se resta de nuevo
   * en `total` (los de linea ya estan incorporados en `subtotal`; solo
   * el de carrito se resta explicitamente, ver `total`). NO incluye el
   * descuento manual existente (`Sale.discountTotal`). */
  promotionDiscountTotal: number;
  /** Suma de `adjustedLineTotal` de todas las lineas, menos el descuento
   * automatico a nivel de CARRITO (si hubo alguno) — mismo orden que
   * `sales/service.ts` (`computeCartDiscountAmount`/`total`): el
   * descuento de carrito se resta al final, sobre subtotal + impuesto ya
   * calculados. NO resta el descuento manual existente — eso sigue
   * siendo responsabilidad exclusiva de quien integre esta capa. */
  total: number;
}

/** Resultado completo de la capa adaptadora — todo lo que quien la
 * invoque (bloque futuro de integracion) necesita para actualizar
 * `SaleItem`, generar `SaleAppliedPromotion` y recalcular los totales de
 * la venta. Esta capa NUNCA persiste nada de esto — solo lo calcula y lo
 * estructura. */
export interface PromotionApplicationResult {
  lines: PromotionApplicationLineResult[];
  appliedPromotions: PromotionApplicationAppliedPromotion[];
  totals: PromotionApplicationTotals;
}
