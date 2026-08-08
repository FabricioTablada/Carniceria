/**
 * shared/services/promotionEngine/promotionEngine.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del Motor de Reglas de Promociones (Bloque P.4). Solo formas de
 * datos — sin logica, sin Prisma, sin acceso a base de datos. El motor NO
 * importa tipos de `@prisma/client` ni de `modules/promotions/` a
 * proposito: recibe una forma MINIMA y auto-contenida (`EnginePromotion`),
 * para que pueda probarse y usarse sin depender de la capa HTTP/DTO del
 * catalogo ni de un cliente de base de datos real.
 *
 * ARQUITECTURA (ver analisis y Bloque P.3 aprobados): este motor es
 * puramente de CALCULO. Nunca persiste nada — recibe un carrito temporal y
 * un catalogo de promociones candidatas (ya cargados por quien lo invoque)
 * y devuelve un resultado estructurado. La persistencia sigue siendo
 * responsabilidad exclusiva de `sales.service.ts` (bloque futuro,
 * integracion) y la carga del catalogo desde la base de datos es
 * responsabilidad de quien invoque el motor (`promotions.repository.ts` u
 * otro), nunca del motor mismo.
 */

/** A que aplica una promocion — mismo vocabulario que `PromotionScopeType`
 * de `modules/promotions/promotions.types.ts`, redeclarado aca para no
 * acoplar el motor a ese modulo. */
export type PromotionScopeType = 'PRODUCT' | 'CATEGORY' | 'COMBO' | 'CART';

/** Como se calcula el beneficio — mismo vocabulario que
 * `PromotionEffectType`. */
export type PromotionEffectType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'SPECIAL_PRICE'
  | 'FIXED_PRICE'
  | 'BUY_X_PAY_Y';

/** Dia de la semana — mismo vocabulario que `DayOfWeek`. */
export type EngineDayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/**
 * Una linea del carrito TEMPORAL que se le pasa al motor para evaluar —
 * NO es un `SaleItem` real ni un `CreateSaleItemDto`: el motor no sabe
 * nada de como se persiste una venta, solo necesita lo minimo para decidir
 * que promociones aplican y cuanto descuentan.
 */
export interface EngineCartLine {
  /** Identificador de la linea DENTRO de este carrito temporal (no un id
   * de base de datos) — permite que el resultado indique a que linea
   * especifica corresponde cada descuento aplicado. Quien invoque el
   * motor decide como generarlo (ej. el indice del array, o un id
   * temporal propio del carrito del POS). */
  lineId: string;
  productId: string;
  /** Categoria del producto — requerida para evaluar promociones
   * `scopeType: CATEGORY`; quien invoque el motor la resuelve (el motor
   * no consulta la base de datos). */
  categoryId: string;
  quantity: number;
  unitPrice: number;
}

/** Contexto de evaluacion — separado del carrito para que el motor sea
 * 100% determinista y facil de probar (nunca lee `new Date()` ni
 * `Date.now()` internamente). */
export interface EngineContext {
  /** Momento a evaluar. Se interpreta en la zona horaria de la sucursal
   * (America/Costa_Rica, ver `conditions.ts`) sin importar en que zona
   * horaria corra el proceso de Node. */
  now: Date;
  sucursalId: string;
}

/** Una linea de producto/combo de una promocion — mismo shape que
 * `PromotionProductResponse` del catalogo, reducido a lo que el motor
 * necesita. */
export interface EnginePromotionProduct {
  productId: string;
  /** Solo relevante para `scopeType: COMBO` — cuantas unidades de ESE
   * producto exige el combo. */
  requiredQuantity: number | null;
}

/**
 * Forma MINIMA de una promocion que el motor necesita para evaluarla —
 * subconjunto deliberado de `PromotionResponse` (`modules/promotions/`),
 * sin importar ese tipo directamente (desacoplamiento, ver nota de
 * archivo). Quien invoque el motor (bloque futuro de integracion) es
 * responsable de traducir el catalogo real a esta forma.
 */
export interface EnginePromotion {
  id: string;
  name: string;
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
  daysOfWeek: EngineDayOfWeek[];
  priority: number;
  stackable: boolean;
  exclusiveGroup: string | null;
  active: boolean;
  /** `null` = aplica a todas las sucursales. */
  sucursalId: string | null;
  products: EnginePromotionProduct[];
  categoryIds: string[];
}

/** Un descuento REALMENTE calculado por el motor para una promocion. No
 * es un registro de auditoria (`SaleAppliedPromotion` sigue siendo
 * responsabilidad exclusiva de quien persiste, `sales.service.ts` en el
 * bloque de integracion futuro) — es el resultado del calculo, en
 * memoria. */
export interface EngineAppliedPromotion {
  promotionId: string;
  promotionName: string;
  effectType: PromotionEffectType;
  /** Snapshot del valor CRUDO de la regla (`EnginePromotion.effectValue`)
   * — el porcentaje o monto tal como esta configurado en el catalogo,
   * NO el resultado del calculo (eso es `amount`). Bloque P.6
   * (integracion con Ventas): necesario para que quien persista
   * `SaleAppliedPromotion` pueda guardar el mismo snapshot de regla que
   * ya se guarda para el descuento manual (`discountValue`), no solo el
   * monto final. `null` para `BUY_X_PAY_Y` (usa `buyQuantity`/
   * `payQuantity` en su lugar, sin un unico valor que snapshotear aca). */
  effectValue: number | null;
  /** `lineId` de las lineas del carrito de entrada afectadas. `null` =
   * afecta al carrito completo (`scopeType: CART`), no a lineas
   * especificas. */
  affectedLineIds: string[] | null;
  /** Monto total descontado por ESTA promocion, en la misma unidad
   * monetaria que `EngineCartLine.unitPrice` (colones). */
  amount: number;
}

/** Resultado estructurado devuelto por `evaluatePromotions()` — el unico
 * punto de salida del motor. */
export interface PromotionEngineResult {
  appliedPromotions: EngineAppliedPromotion[];
  /** Suma de `amount` de todas las promociones aplicadas — conveniencia
   * para quien invoque el motor, no agrega ningun dato nuevo. */
  totalDiscount: number;
}
