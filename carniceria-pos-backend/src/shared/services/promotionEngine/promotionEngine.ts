/**
 * shared/services/promotionEngine/promotionEngine.ts
 * -----------------------------------------------------------------------------
 * MOTOR DE REGLAS DE PROMOCIONES (Bloque P.4) — orquestador. Unico punto
 * de entrada del motor: `evaluatePromotions()`.
 *
 * RESPONSABILIDAD DE ESTE ARCHIVO ESPECIFICAMENTE: resolucion de
 * PRIORIDAD, EXCLUSIVIDAD y ACUMULACION — las tres se resuelven juntas,
 * a proposito, en un unico recorrido (no en 3 archivos separados): son
 * interdependientes paso a paso (que se aplico ya condiciona que puede
 * aplicar despues), separarlas en modulos distintos fragmentaria un solo
 * algoritmo cohesivo sin ninguna ganancia real de claridad. Elegibilidad
 * (`eligibility.ts`), condiciones (`conditions.ts`) y calculo de monto
 * (`calculation.ts`) SI son pasos independientes entre si — cada uno vive
 * en su propio archivo, ver justificacion en cada uno.
 *
 * ARQUITECTURA (ver Bloque P.3/analisis aprobados): el motor NUNCA
 * persiste nada, nunca importa Prisma, nunca llama a `sales.repository.ts`
 * ni a ningun otro repositorio. Recibe un carrito temporal + un catalogo
 * de promociones candidatas + un contexto, y devuelve un resultado en
 * memoria. La carga de promociones desde la base de datos y la
 * persistencia del resultado son responsabilidad de quien invoque este
 * modulo (bloque futuro de integracion con `sales.service.ts` y/o un
 * endpoint de cotizacion) — este archivo no sabe que existen.
 *
 * ALGORITMO DE RESOLUCION (simplificacion de v1, documentada y aprobada
 * en el analisis de arquitectura — evita un problema de optimizacion
 * combinatoria general, que no se justifica para el tamaño de este
 * negocio):
 *   1. Ordenar las promociones candidatas por `priority` DESCENDENTE.
 *   2. Recorrerlas en ese orden. Para cada una:
 *      a. Si pertenece a un `exclusiveGroup` ya usado por una promocion
 *         anterior (aplicada en este mismo recorrido), se descarta —
 *         miembros del mismo grupo NUNCA se combinan entre si, sin
 *         importar `stackable`.
 *      b. Si NO es acumulable (`stackable: false`) y alguna de sus
 *         lineas afectadas ya fue "consumida" por una promocion anterior
 *         tambien no acumulable, se descarta — dos promociones
 *         exclusivas no pueden pelear por la misma linea.
 *      c. Si sobrevive ambos filtros, se calcula su monto
 *         (`calculation.ts`). Si el monto es 0, no se aplica (nada que
 *         descontar). Si es mayor a 0, se aplica: se agrega al
 *         resultado, se marca su `exclusiveGroup` como usado, y si no es
 *         acumulable, se marcan sus lineas como consumidas.
 *   3. El resultado final es la lista de promociones efectivamente
 *      aplicadas + la suma de sus montos.
 */
import { resolveAffectedLines, resolveEligiblePromotions } from './eligibility';
import { meetsConditions } from './conditions';
import { calculateBenefit } from './calculation';
import type {
  EngineAppliedPromotion,
  EngineCartLine,
  EngineContext,
  EnginePromotion,
  PromotionEngineResult,
} from './promotionEngine.types';

/**
 * Punto de entrada del motor. Pura funcion: mismo input siempre produce
 * el mismo output, sin efectos secundarios, sin acceso a base de datos,
 * sin `new Date()` interno (ver `EngineContext.now`).
 */
export function evaluatePromotions(
  cart: EngineCartLine[],
  promotions: EnginePromotion[],
  context: EngineContext,
): PromotionEngineResult {
  if (cart.length === 0) {
    return { appliedPromotions: [], totalDiscount: 0 };
  }

  const eligible = resolveEligiblePromotions(promotions, cart);
  const candidates = eligible.filter((promotion) => meetsConditions(promotion, cart, context));
  const sortedByPriority = [...candidates].sort((a, b) => b.priority - a.priority);

  const applied: EngineAppliedPromotion[] = [];
  const consumedLineIds = new Set<string>();
  const usedExclusiveGroups = new Set<string>();
  let cartLevelConsumed = false;

  for (const promotion of sortedByPriority) {
    if (promotion.exclusiveGroup && usedExclusiveGroups.has(promotion.exclusiveGroup)) {
      continue;
    }

    const affected = resolveAffectedLines(promotion, cart);
    const isCartLevel = affected === 'CART';
    const affectedLines = isCartLevel ? cart : affected;
    const affectedLineIds = isCartLevel ? null : affectedLines.map((line) => line.lineId);

    if (!promotion.stackable) {
      const alreadyConsumed = isCartLevel
        ? cartLevelConsumed
        : (affectedLineIds ?? []).some((lineId) => consumedLineIds.has(lineId));

      if (alreadyConsumed) {
        continue;
      }
    }

    const amount = calculateBenefit(promotion, affectedLines);

    if (amount <= 0) {
      continue;
    }

    applied.push({
      promotionId: promotion.id,
      promotionName: promotion.name,
      effectType: promotion.effectType,
      effectValue: promotion.effectValue,
      affectedLineIds,
      amount,
    });

    if (promotion.exclusiveGroup) {
      usedExclusiveGroups.add(promotion.exclusiveGroup);
    }

    if (!promotion.stackable) {
      if (isCartLevel) {
        cartLevelConsumed = true;
      } else {
        for (const lineId of affectedLineIds ?? []) {
          consumedLineIds.add(lineId);
        }
      }
    }
  }

  const totalDiscount = Math.round(applied.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;

  return { appliedPromotions: applied, totalDiscount };
}
