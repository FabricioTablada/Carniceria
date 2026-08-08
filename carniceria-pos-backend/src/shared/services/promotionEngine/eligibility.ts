/**
 * shared/services/promotionEngine/eligibility.ts
 * -----------------------------------------------------------------------------
 * RESOLUCION DE ELEGIBILIDAD (Bloque P.4) — un unico responsabilidad:
 * dado un carrito, determinar que promociones tienen AL MENOS UNA
 * posibilidad de aplicar, segun su `scopeType` contra el contenido real
 * del carrito. No evalua fechas/horarios/dias/cantidad minima (eso vive
 * en `conditions.ts`) ni calcula ningun monto (`calculation.ts`) — solo
 * responde "esta promocion tiene algo que descontar en este carrito, si
 * el resto de sus condiciones se cumplen".
 */
import type { EngineCartLine, EnginePromotion } from './promotionEngine.types';

/**
 * Filtra el catalogo de promociones a las que son elegibles para ESTE
 * carrito segun su alcance (`scopeType`):
 *  - CART: siempre elegible si el carrito tiene al menos una linea.
 *  - PRODUCT: elegible si alguno de sus productos esta en el carrito.
 *  - CATEGORY: elegible si alguna de sus categorias esta representada en
 *    el carrito.
 *  - COMBO: elegible SOLO si TODOS los productos requeridos estan
 *    presentes en cantidad suficiente (`requiredQuantity`) — un combo
 *    parcial no es elegible, no se aplica "a medias".
 */
export function resolveEligiblePromotions(
  promotions: EnginePromotion[],
  cart: EngineCartLine[],
): EnginePromotion[] {
  return promotions.filter((promotion) => isEligible(promotion, cart));
}

function isEligible(promotion: EnginePromotion, cart: EngineCartLine[]): boolean {
  switch (promotion.scopeType) {
    case 'CART':
      return cart.length > 0;

    case 'PRODUCT':
      return promotion.products.some((required) =>
        cart.some((line) => line.productId === required.productId),
      );

    case 'CATEGORY':
      return promotion.categoryIds.some((categoryId) =>
        cart.some((line) => line.categoryId === categoryId),
      );

    case 'COMBO':
      return (
        promotion.products.length > 0 &&
        promotion.products.every((required) => {
          const cartQuantity = sumQuantityForProduct(cart, required.productId);
          return cartQuantity >= (required.requiredQuantity ?? 0);
        })
      );

    default:
      return false;
  }
}

function sumQuantityForProduct(cart: EngineCartLine[], productId: string): number {
  return cart
    .filter((line) => line.productId === productId)
    .reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Resuelve exactamente que lineas del carrito quedan AFECTADAS por una
 * promocion ya elegible, segun su `scopeType` — usada tanto por
 * `conditions.ts` (para `minQuantity`, que solo se mide sobre las lineas
 * relevantes) como por el orquestador (`promotionEngine.ts`, para saber
 * que lineas "consume" una promocion no acumulable).
 *
 * Devuelve el string literal `'CART'` en vez de un array cuando el
 * alcance es el carrito completo — evita confundir "afecta a estas 0
 * lineas especificas" con "afecta a todo el carrito", una diferencia con
 * significado real para la resolucion de exclusividad.
 */
export function resolveAffectedLines(
  promotion: EnginePromotion,
  cart: EngineCartLine[],
): EngineCartLine[] | 'CART' {
  switch (promotion.scopeType) {
    case 'CART':
      return 'CART';

    case 'PRODUCT':
    case 'COMBO':
      return cart.filter((line) =>
        promotion.products.some((required) => required.productId === line.productId),
      );

    case 'CATEGORY':
      return cart.filter((line) => promotion.categoryIds.includes(line.categoryId));

    default:
      return [];
  }
}
