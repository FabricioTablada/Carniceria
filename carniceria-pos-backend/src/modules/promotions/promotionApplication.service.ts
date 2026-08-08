/**
 * modules/promotions/promotionApplication.service.ts
 * -----------------------------------------------------------------------------
 * PromotionApplicationService (Bloque P.5) — capa adaptadora entre el
 * Motor de Reglas (`shared/services/promotionEngine/`) y el dominio de
 * Ventas.
 *
 *   PromotionEngine  ->  PromotionApplicationService  ->  SalesService
 *
 * Responsabilidades (y NADA MAS que esto):
 *  - Cargar el catalogo de promociones activas relevantes
 *    (`promotions.repository.ts`, `findActiveForEvaluation`).
 *  - Traducir ese catalogo, y el carrito recibido en vocabulario de
 *    Ventas, a la forma que el motor entiende (`EnginePromotion`/
 *    `EngineCartLine`).
 *  - Invocar `evaluatePromotions()` (el motor, sin conocer su
 *    implementacion interna mas alla de esa unica funcion exportada).
 *  - Traducir `PromotionEngineResult` de vuelta a vocabulario de Ventas:
 *    subtotales/impuestos/totales recalculados por linea, y una lista de
 *    descuentos lista para convertirse en filas de `SaleAppliedPromotion`.
 *
 * LO QUE ESTA CAPA DELIBERADAMENTE NO HACE:
 *  - No persiste absolutamente nada (ni `Sale`, ni `SaleItem`, ni
 *    `SaleAppliedPromotion`) — devuelve un resultado en memoria, igual
 *    que el motor. Persistir sigue siendo responsabilidad exclusiva de
 *    `sales.service.ts`, en un bloque de integracion futuro que todavia
 *    no existe.
 *  - No se invoca desde ningun lado todavia: ni el POS, ni
 *    `sales.service.ts`, ni ningun endpoint. Verificar con
 *    `grep -r "promotionApplication" src/modules/sales` (debe devolver
 *    vacio hasta que se apruebe el bloque de integracion).
 *  - No conoce el modelo `Sale`/`SaleItem` de Prisma — solo los tipos de
 *    `promotionApplication.types.ts`, deliberadamente minimos.
 *
 * El PromotionEngine, por su parte, sigue sin saber que `Sales` existe:
 * nunca importa nada de este archivo ni de `sales/`. El acoplamiento va
 * en una sola direccion, siempre hacia adentro (Sales -> esta capa ->
 * el motor), nunca al reves.
 */
import * as promotionsRepository from './promotions.repository';
import { formatTimeString } from './promotionTime.utils';
import { evaluatePromotions } from '@/shared/services/promotionEngine';
import type {
  EngineCartLine,
  EngineContext,
  EngineDayOfWeek,
  EnginePromotion,
} from '@/shared/services/promotionEngine';
import type { PricingFundingType } from '@/shared/services/pricingAnalysis';
import type {
  PromotionApplicationAppliedPromotion,
  PromotionApplicationCartLine,
  PromotionApplicationContext,
  PromotionApplicationLineResult,
  PromotionApplicationResult,
  PromotionOrigin,
} from './promotionApplication.types';

/** Redondea a 2 decimales (colones) — mismo criterio que
 * `shared/services/promotionEngine/calculation.ts` (el motor tampoco usa
 * `Prisma.Decimal`; esta capa mantiene la misma precision al traducir de
 * vuelta a vocabulario de Ventas, sin introducir un tercer criterio de
 * redondeo). La conversion final a `Prisma.Decimal` para persistir, si
 * corresponde, es responsabilidad de `sales.service.ts` en el bloque de
 * integracion. */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Forma minima del catalogo de Prisma que este adaptador necesita para
 * traducir hacia `EnginePromotion` — evita importar el tipo completo de
 * `PromotionResponse` (capa HTTP) o el modelo generado de Prisma
 * directamente, mismo criterio de desacoplamiento que el resto del
 * modulo. */
type PromotionCatalogRecord = Awaited<
  ReturnType<typeof promotionsRepository.findActiveForEvaluation>
>[number];

/** Traduce una promocion cargada de la base de datos a la forma minima
 * que el motor entiende (`EnginePromotion`) — unica funcion de este
 * archivo que conoce la forma real de Prisma. */
function toEnginePromotion(promotion: PromotionCatalogRecord): EnginePromotion {
  return {
    id: promotion.id,
    name: promotion.name,
    scopeType: promotion.scopeType,
    effectType: promotion.effectType,
    effectValue: promotion.effectValue ? Number(promotion.effectValue) : null,
    buyQuantity: promotion.buyQuantity,
    payQuantity: promotion.payQuantity,
    minQuantity: promotion.minQuantity ? Number(promotion.minQuantity) : null,
    startDate: promotion.startDate,
    endDate: promotion.endDate,
    startTime: promotion.startTime ? formatTimeString(promotion.startTime) : null,
    endTime: promotion.endTime ? formatTimeString(promotion.endTime) : null,
    daysOfWeek: promotion.daysOfWeek as EngineDayOfWeek[],
    priority: promotion.priority,
    stackable: promotion.stackable,
    exclusiveGroup: promotion.exclusiveGroup,
    active: promotion.active,
    sucursalId: promotion.sucursalId,
    products: promotion.products.map((item) => ({
      productId: item.productId,
      requiredQuantity: item.requiredQuantity ? Number(item.requiredQuantity) : null,
    })),
    categoryIds: promotion.categories.map((item) => item.categoryId),
  };
}

/**
 * Punto de entrada de la capa adaptadora. Recibe un carrito en
 * vocabulario de Ventas (real o temporal, todavia sin persistir) y
 * devuelve el resultado completo de aplicar el catalogo de promociones
 * activas — listo para que `sales.service.ts` (bloque de integracion
 * futuro) decida como persistirlo. Esta funcion no persiste nada.
 */
export async function evaluateSalePromotions(
  cartLines: PromotionApplicationCartLine[],
  context: PromotionApplicationContext,
): Promise<PromotionApplicationResult> {
  if (cartLines.length === 0) {
    return { lines: [], appliedPromotions: [], totals: emptyTotals() };
  }

  const catalog = await promotionsRepository.findActiveForEvaluation(context.sucursalId);
  const promotions = catalog.map(toEnginePromotion);

  // PROMO-09/PROMO-10: `catalog` ya trae los campos comerciales (PROMO-03,
  // columnas reales de `Promotion`) de cada fila — se arma este mapa de
  // conveniencia (mismo criterio que `costByProductId` en
  // `sales/service.ts`) para no volver a consultar la base de datos al
  // traducir el resultado del motor de vuelta a vocabulario de Ventas.
  const commercialFieldsByPromotionId = new Map(
    catalog.map((promotion) => [
      promotion.id,
      {
        fundingType: promotion.fundingType as PricingFundingType,
        supplierSubsidyValue: promotion.supplierSubsidyValue ? Number(promotion.supplierSubsidyValue) : null,
        commercialOrigin: promotion.commercialOrigin as PromotionOrigin,
        supplierId: promotion.supplierId,
      },
    ]),
  );

  const engineCart: EngineCartLine[] = cartLines.map((line) => ({
    lineId: line.saleItemId,
    productId: line.productId,
    categoryId: line.categoryId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }));

  const engineContext: EngineContext = {
    now: context.now ?? new Date(),
    sucursalId: context.sucursalId,
  };

  const engineResult = evaluatePromotions(engineCart, promotions, engineContext);

  return translateEngineResult(cartLines, engineResult.appliedPromotions, commercialFieldsByPromotionId);
}

function emptyTotals() {
  return { subtotal: 0, taxTotal: 0, promotionDiscountTotal: 0, total: 0 };
}

/**
 * Traduce `EngineAppliedPromotion[]` (vocabulario del motor: `lineId`,
 * montos ya calculados pero sin distribuir) al resultado completo en
 * vocabulario de Ventas: reparte cada descuento entre las lineas que
 * afecta, recalcula subtotal/impuesto/total por linea, y arma la lista
 * de descuentos lista para persistir como `SaleAppliedPromotion` (una
 * entrada por combinacion promocion+linea, ver nota en
 * `promotionApplication.types.ts`).
 */
function translateEngineResult(
  cartLines: PromotionApplicationCartLine[],
  engineApplied: ReturnType<typeof evaluatePromotions>['appliedPromotions'],
  commercialFieldsByPromotionId: Map<
    string,
    {
      fundingType: PricingFundingType;
      supplierSubsidyValue: number | null;
      commercialOrigin: PromotionOrigin;
      supplierId: string | null;
    }
  >,
): PromotionApplicationResult {
  const lineDiscounts = new Map<string, number>();
  const appliedPromotions: PromotionApplicationAppliedPromotion[] = [];
  let cartLevelDiscount = 0;

  for (const applied of engineApplied) {
    // PROMO-09: `commercialFieldsByPromotionId` siempre tiene esta clave
    // — `applied.promotionId` proviene del mismo `catalog` con el que se
    // armo el mapa, unas lineas mas arriba. Default defensivo (`NONE`/
    // `null`, el caso normal) en vez de asumir la clave presente, sin
    // costo real: nunca deberia ejecutarse.
    const commercialFields = commercialFieldsByPromotionId.get(applied.promotionId) ?? {
      fundingType: 'NONE' as PricingFundingType,
      supplierSubsidyValue: null,
      commercialOrigin: 'INTERNAL' as PromotionOrigin,
      supplierId: null,
    };

    if (applied.affectedLineIds === null) {
      cartLevelDiscount = roundCurrency(cartLevelDiscount + applied.amount);
      appliedPromotions.push({
        saleItemId: null,
        promotionId: applied.promotionId,
        promotionName: applied.promotionName,
        effectType: applied.effectType,
        effectValue: applied.effectValue,
        amountApplied: applied.amount,
        ...commercialFields,
      });
      continue;
    }

    const affectedLines = cartLines.filter((line) => applied.affectedLineIds!.includes(line.saleItemId));
    const totalBase = affectedLines.reduce((sum, line) => sum + line.lineSubtotal, 0);

    for (const line of affectedLines) {
      // Reparto proporcional al peso de cada linea dentro del monto
      // afectado por ESTA promocion — evita que una promocion que cubre
      // varias lineas de precios distintos (ej. `scopeType: CATEGORY`
      // con dos productos) descuente "parejo" sin relacion a cuanto pesa
      // cada una. Si `totalBase` es 0 (caso extremo, subtotal ya en
      // cero), se reparte en partes iguales en vez de dividir por cero.
      const share = totalBase > 0 ? line.lineSubtotal / totalBase : 1 / affectedLines.length;
      const lineAmount = roundCurrency(applied.amount * share);

      lineDiscounts.set(line.saleItemId, roundCurrency((lineDiscounts.get(line.saleItemId) ?? 0) + lineAmount));

      appliedPromotions.push({
        saleItemId: line.saleItemId,
        promotionId: applied.promotionId,
        promotionName: applied.promotionName,
        effectType: applied.effectType,
        effectValue: applied.effectValue,
        amountApplied: lineAmount,
        ...commercialFields,
      });
    }
  }

  // Hallazgo 1 (Auditoria de integridad financiera, 07/08/2026): promociones
  // `stackable` se evaluan de forma independiente sobre el subtotal bruto
  // original de la linea (el motor no descuenta lo que ya aplico otra
  // promocion acumulable) — la suma de sus `amountApplied` puede superar el
  // subtotal real de la linea aunque `adjustedLineSubtotal`, mas abajo, ya
  // este protegido por `Math.max(0, ...)`. Sin este ajuste, cada fila
  // `SaleAppliedPromotion` persistida (y por lo tanto el ticket, el Reporte
  // de Utilidad y el aporte de proveedor calculado sobre ella) quedaba con
  // un monto inflado. Se corrige aca, prorrateando los `amountApplied` YA
  // calculados de cada linea para que su suma coincida exactamente con el
  // subtotal real — nunca se toca el motor (`promotionEngine/`), las reglas
  // stackable/no-stackable, ni `adjustedLineSubtotal` (que da el mismo
  // resultado antes y despues de este ajuste, por construccion).
  const lineSubtotalById = new Map(cartLines.map((line) => [line.saleItemId, line.lineSubtotal]));

  for (const [saleItemId, totalDiscount] of lineDiscounts) {
    const lineSubtotal = lineSubtotalById.get(saleItemId) ?? 0;
    if (totalDiscount <= lineSubtotal) {
      continue;
    }

    const entriesForLine = appliedPromotions.filter((entry) => entry.saleItemId === saleItemId);
    let scaledSum = 0;

    entriesForLine.forEach((entry, index) => {
      if (index === entriesForLine.length - 1) {
        // La ultima entrada absorbe el residuo de redondeo — garantiza que
        // la suma final sea EXACTAMENTE `lineSubtotal`, no una aproximacion
        // que podria quedar un centavo arriba o abajo si cada entrada se
        // redondeara de forma independiente.
        entry.amountApplied = roundCurrency(lineSubtotal - scaledSum);
      } else {
        entry.amountApplied = roundCurrency(entry.amountApplied * (lineSubtotal / totalDiscount));
        scaledSum = roundCurrency(scaledSum + entry.amountApplied);
      }
    });

    lineDiscounts.set(saleItemId, lineSubtotal);
  }

  const lines: PromotionApplicationLineResult[] = cartLines.map((line) => {
    const promotionDiscount = lineDiscounts.get(line.saleItemId) ?? 0;
    const adjustedLineSubtotal = roundCurrency(Math.max(0, line.lineSubtotal - promotionDiscount));
    const adjustedLineTax = roundCurrency(adjustedLineSubtotal * (line.taxRate / 100));
    const adjustedLineTotal = roundCurrency(adjustedLineSubtotal + adjustedLineTax);

    return {
      saleItemId: line.saleItemId,
      promotionDiscount,
      adjustedLineSubtotal,
      adjustedLineTax,
      adjustedLineTotal,
    };
  });

  const subtotal = roundCurrency(lines.reduce((sum, line) => sum + line.adjustedLineSubtotal, 0));
  const taxTotal = roundCurrency(lines.reduce((sum, line) => sum + line.adjustedLineTax, 0));
  const lineDiscountTotal = roundCurrency(
    lines.reduce((sum, line) => sum + line.promotionDiscount, 0),
  );
  const total = roundCurrency(
    lines.reduce((sum, line) => sum + line.adjustedLineTotal, 0) - cartLevelDiscount,
  );

  return {
    lines,
    appliedPromotions,
    totals: {
      subtotal,
      taxTotal,
      promotionDiscountTotal: roundCurrency(lineDiscountTotal + cartLevelDiscount),
      total,
    },
  };
}
