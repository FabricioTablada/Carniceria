/**
 * features/promotions/utils/promotionProfitabilityPreview.ts
 * -----------------------------------------------------------------------------
 * Bloque PROMO-08: espejo, EXCLUSIVAMENTE para la vista previa
 * administrativa del formulario de Promociones, del coordinador de
 * rentabilidad del backend (`shared/services/pricingAnalysis/`, que a su
 * vez combina `CostEngine`/`PromotionEngine` reales SIN modificarlos). No
 * se puede importar el backend directamente (repos separados, ver
 * CLAUDE.md) — esta es la UNICA función de todo el frontend que conoce
 * esta combinación de fórmulas; `PromotionLivePanel.tsx` (Bloque 1) es su
 * único consumidor hoy.
 *
 * Reutiliza `calculateEffectiveCost` (`features/products/utils/costEnginePreview.ts`)
 * para el costo efectivo — esa sigue siendo la única función que conoce
 * la fórmula de `CostEngine` en el frontend, esto NO la duplica.
 *
 * El calculo del DESCUENTO por `effectType` (PERCENTAGE/FIXED_AMOUNT/
 * SPECIAL_PRICE/BUY_X_PAY_Y) sí se repite aca — no existe un dueño único
 * de esa fórmula en el frontend (`promotionNarrative.ts` tiene una
 * versión deliberadamente simplificada, de un solo ejemplo visual, sin
 * `BUY_X_PAY_Y`), y el backend no exporta `calculation.ts` fuera de su
 * carpeta (`shared/services/promotionEngine/index.ts` solo expone
 * `evaluatePromotions`). Mismas 4 fórmulas exactas que
 * `calculation.ts` (backend, Bloque P.4), sin eligibilidad ni prioridad
 * (esta vista previa evalúa UNA promoción sobre UN producto de
 * referencia, no un carrito real).
 *
 * DELIBERADAMENTE IGNORADO: vigencia (`active`/fechas/horas/dias) — mismo
 * criterio que el coordinador del backend: el objetivo es "cuánto se
 * ganaría/perdería SI la promoción aplicara", no "aplicaría en este
 * instante".
 *
 * PURAMENTE INFORMATIVO: el resultado nunca se envía al backend, nunca
 * se persiste — es una SIMULACIÓN.
 */
import { calculateEffectiveCost } from '@/features/products/utils/costEnginePreview'
import type {
  PromotionEffectType,
  PromotionFundingType,
} from '../types/promotion.types'

export interface PromotionProfitabilityPreviewProductInput {
  /** `Product.cost` (costo promedio). */
  averageCost: number | null | undefined
  /** `Product.expectedWastePercent`. */
  expectedWastePercent: number | null | undefined
  /** `Product.applyExpectedWasteToCost`. */
  applyExpectedWasteToCost: boolean
  /** `Product.salePrice`, ANTES de la promoción. */
  salePrice: number | null | undefined
  /**
   * Bloque 1 (panel lateral, simulación comercial): `Product.tax.rate` —
   * mismo criterio que el resto de los campos de este input (snapshot de
   * catálogo, no una consulta nueva). `null`/`undefined` = sin impuesto
   * (mismo comportamiento que un producto sin `taxId`), `taxTotal` da 0.
   */
  taxRate?: number | null
}

export interface PromotionProfitabilityPreviewPromotionInput {
  effectType: PromotionEffectType | null | undefined
  effectValue: number | null | undefined
  buyQuantity: number | null | undefined
  payQuantity: number | null | undefined
  minQuantity: number | null | undefined
  fundingType: PromotionFundingType | null | undefined
  supplierSubsidyValue: number | null | undefined
}

export interface PromotionProfitabilityPreviewResult {
  simulatedQuantity: number
  /** Precio unitario DESPUES de la promoción (ver calculo mas abajo). */
  salePrice: number
  effectiveCost: number
  profit: number
  marginPercent: number | null
  supplierContributionPerUnit: number
  supplierContributionTotal: number
  finalProfitability: number
  /**
   * Bloque 1 (panel lateral, simulación comercial): totales del carrito
   * simulado (`simulatedQuantity` unidades), en el mismo orden en que
   * `computeItems()` los calcula en el backend (descuento antes que
   * impuesto) — SOLO para mostrar en el panel, nunca se envía al backend.
   */
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
}

/** Mismas 4 fórmulas que `CALCULATORS` (`calculation.ts`, backend), para
 * un unico producto (sin agrupar por `productId`, ya que esta vista
 * previa nunca tiene mas de una linea). El resultado se clampa a `>= 0`
 * (mismo criterio que `calculateBenefit`) — un descuento nunca sube el
 * precio. */
function calculateDiscountTotal(
  promotion: PromotionProfitabilityPreviewPromotionInput,
  totalBeforePromotion: number,
  quantity: number,
): number {
  switch (promotion.effectType) {
    case 'PERCENTAGE': {
      if (promotion.effectValue == null) return 0
      return Math.max(0, totalBeforePromotion * (promotion.effectValue / 100))
    }
    case 'FIXED_AMOUNT': {
      if (promotion.effectValue == null) return 0
      return Math.max(0, promotion.effectValue)
    }
    case 'SPECIAL_PRICE': {
      if (promotion.effectValue == null) return 0
      return Math.max(0, totalBeforePromotion - promotion.effectValue)
    }
    case 'FIXED_PRICE': {
      // PROMO-13: precio fijo POR UNIDAD — a diferencia de SPECIAL_PRICE
      // (que fija el TOTAL sin importar `quantity`), acá el descuento
      // escala con la cantidad simulada: `effectValue * quantity` es el
      // nuevo total, nunca un valor fijo independiente de cuántas
      // unidades se simulen (`minQuantity`/`buyQuantity` pueden subir
      // `simulatedQuantity` por encima de 1, ver `calculatePromotionProfitabilityPreview`).
      if (promotion.effectValue == null) return 0
      return Math.max(0, totalBeforePromotion - promotion.effectValue * quantity)
    }
    case 'BUY_X_PAY_Y': {
      if (!promotion.buyQuantity || promotion.payQuantity == null) return 0
      const unitPrice = totalBeforePromotion / quantity
      const completeGroups = Math.floor(quantity / promotion.buyQuantity)
      const freeUnitsPerGroup = promotion.buyQuantity - promotion.payQuantity
      return Math.max(0, completeGroups * freeUnitsPerGroup * unitPrice)
    }
    default:
      return 0
  }
}

/**
 * Calcula la simulación de rentabilidad, o `null` si no hay suficiente
 * información válida (mismo criterio que `calculateCostPreview`/
 * `calculateCostEnginePreview`: entrada incompleta/inválida => sin vista
 * previa, nunca un valor inventado).
 */
export function calculatePromotionProfitabilityPreview(
  product: PromotionProfitabilityPreviewProductInput,
  promotion: PromotionProfitabilityPreviewPromotionInput,
): PromotionProfitabilityPreviewResult | null {
  if (
    product.salePrice === null ||
    product.salePrice === undefined ||
    !Number.isFinite(product.salePrice) ||
    product.salePrice < 0
  ) {
    return null
  }

  const effectiveCost = calculateEffectiveCost({
    averageCost: product.averageCost,
    wastePercent: product.expectedWastePercent,
    applyExpectedWasteToCost: product.applyExpectedWasteToCost,
  })

  if (effectiveCost === null) {
    return null
  }

  if (!promotion.effectType) {
    return null
  }

  if (promotion.effectType === 'BUY_X_PAY_Y') {
    if (promotion.buyQuantity == null || promotion.payQuantity == null) {
      return null
    }
  } else if (promotion.effectValue == null) {
    return null
  }

  const simulatedQuantity = Math.max(
    1,
    promotion.buyQuantity ?? 0,
    promotion.minQuantity != null ? Math.ceil(promotion.minQuantity) : 0,
  )

  const totalBeforePromotion = simulatedQuantity * product.salePrice
  const totalDiscount = calculateDiscountTotal(promotion, totalBeforePromotion, simulatedQuantity)
  const totalAfterPromotion = totalBeforePromotion - totalDiscount
  const salePrice = totalAfterPromotion / simulatedQuantity
  const discountPerUnit = product.salePrice - salePrice

  let supplierContributionPerUnit = 0
  const fundingType = promotion.fundingType ?? 'NONE'

  if (fundingType === 'SUPPLIER_SUBSIDY_PER_UNIT' && promotion.supplierSubsidyValue != null) {
    supplierContributionPerUnit = promotion.supplierSubsidyValue
  } else if (fundingType === 'SUPPLIER_SUBSIDY_PERCENTAGE' && promotion.supplierSubsidyValue != null) {
    supplierContributionPerUnit = discountPerUnit * (promotion.supplierSubsidyValue / 100)
  }

  const netCostPerUnit = effectiveCost - supplierContributionPerUnit
  const profit = salePrice - effectiveCost
  const finalProfitability = salePrice - netCostPerUnit
  const marginPercent = salePrice > 0 ? (finalProfitability / salePrice) * 100 : null

  // Bloque 1 (panel lateral): mismo orden que `computeItems()` en el
  // backend — el descuento se resta ANTES de calcular el impuesto, sobre
  // el subtotal ya descontado.
  const taxRate = product.taxRate ?? 0
  const taxTotal = totalAfterPromotion * (taxRate / 100)

  return {
    simulatedQuantity,
    salePrice,
    effectiveCost,
    profit,
    marginPercent,
    supplierContributionPerUnit,
    supplierContributionTotal: supplierContributionPerUnit * simulatedQuantity,
    finalProfitability,
    subtotal: totalBeforePromotion,
    discountTotal: totalDiscount,
    taxTotal,
    total: totalAfterPromotion + taxTotal,
  }
}
