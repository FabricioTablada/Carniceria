/**
 * shared/services/promotionEngine/calculation.ts
 * -----------------------------------------------------------------------------
 * CALCULO DEL BENEFICIO (Bloque P.4) — unica responsabilidad: dada una
 * promocion (ya elegible y con condiciones cumplidas) y las lineas del
 * carrito que afecta, calcular el MONTO exacto a descontar segun su
 * `effectType`. No decide si la promocion deberia aplicar (eso ya se
 * resolvio en `eligibility.ts`/`conditions.ts`) ni resuelve conflictos
 * con otras promociones (`promotionEngine.ts`) — es una funcion pura,
 * monto = f(promocion, lineas).
 *
 * Sin `Prisma.Decimal`: el motor trabaja con `number` (ver nota de
 * `promotionEngine.types.ts`, desacoplado de `@prisma/client` a
 * proposito). `roundCurrency` redondea a 2 decimales (colones), mismo
 * criterio de precision que `shared/utils/money.ts` usa para Decimal.
 */
import type { EngineCartLine, EnginePromotion, PromotionEffectType } from './promotionEngine.types';

/** Redondea a 2 decimales (colones) — unica conversion de precision de
 * este archivo. Se usa `number` nativo (no `Prisma.Decimal`) porque el
 * motor no depende de `@prisma/client`; el error de punto flotante en 2
 * decimales sobre montos de esta magnitud es despreciable para el
 * proposito de este calculo (a diferencia de la persistencia real, que
 * SI usa `Prisma.Decimal` en `sales/service.ts`). */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula el monto a descontar para una promocion sobre las lineas que
 * la afectan. `lines` debe ser el resultado de `resolveAffectedLines()`
 * ya resuelto a un array real (el caller traduce `'CART'` al carrito
 * completo antes de llamar esta funcion — este archivo no conoce el
 * carrito completo, solo las lineas relevantes).
 */
export function calculateBenefit(promotion: EnginePromotion, lines: EngineCartLine[]): number {
  if (lines.length === 0) {
    return 0;
  }

  const calculator = CALCULATORS[promotion.effectType];

  return roundCurrency(Math.max(0, calculator(promotion, lines)));
}

const CALCULATORS: Record<
  PromotionEffectType,
  (promotion: EnginePromotion, lines: EngineCartLine[]) => number
> = {
  PERCENTAGE: (promotion, lines) => {
    if (promotion.effectValue == null) {
      return 0;
    }

    return sumLineTotal(lines) * (promotion.effectValue / 100);
  },

  FIXED_AMOUNT: (promotion) => promotion.effectValue ?? 0,

  SPECIAL_PRICE: (promotion, lines) => {
    if (promotion.effectValue == null) {
      return 0;
    }

    // El "precio especial" es el precio FINAL del conjunto de lineas
    // afectadas (ej. el combo completo, o el total de un producto en
    // oferta) — el descuento es la diferencia contra el total actual, sin
    // asumir una sola unidad.
    return sumLineTotal(lines) - promotion.effectValue;
  },

  // PROMO-13: precio fijo POR UNIDAD — a diferencia de SPECIAL_PRICE (que
  // fija el TOTAL del conjunto de lineas, sin importar cuantas unidades
  // sean), aca cada linea aporta `cantidad * (precio_actual -
  // precio_fijo)`. Esto es lo que hace que escale correctamente con
  // cualquier cantidad/peso (ej. 1.35 kg a un precio fijo por kg) y con
  // lineas de productos distintos dentro de la misma promocion (ej.
  // `scopeType: CATEGORY` con dos productos de precio de lista distinto)
  // — cada una se re-precia de forma independiente a su propio precio
  // fijo, en vez de repartir un unico total combinado entre ambas.
  FIXED_PRICE: (promotion, lines) => {
    if (promotion.effectValue == null) {
      return 0;
    }

    return lines.reduce(
      (sum, line) => sum + line.quantity * (line.unitPrice - promotion.effectValue!),
      0,
    );
  },

  BUY_X_PAY_Y: (promotion, lines) => {
    if (!promotion.buyQuantity || !promotion.payQuantity) {
      return 0;
    }

    // Agrupa por producto: cada producto acumula su propia cuenta de
    // "grupos completos" de `buyQuantity` unidades — evita mezclar
    // cantidades de productos distintos (con precios distintos) en un
    // solo conteo cuando la promocion tiene mas de un producto elegible.
    const byProduct = new Map<string, { quantity: number; unitPrice: number }>();

    for (const line of lines) {
      const existing = byProduct.get(line.productId);
      byProduct.set(line.productId, {
        quantity: (existing?.quantity ?? 0) + line.quantity,
        unitPrice: line.unitPrice,
      });
    }

    let discount = 0;

    for (const { quantity, unitPrice } of byProduct.values()) {
      const completeGroups = Math.floor(quantity / promotion.buyQuantity!);
      const freeUnitsPerGroup = promotion.buyQuantity! - promotion.payQuantity!;
      discount += completeGroups * freeUnitsPerGroup * unitPrice;
    }

    return discount;
  },
};

function sumLineTotal(lines: EngineCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}
