/**
 * features/promotions/utils/promotionAlerts.ts
 * -----------------------------------------------------------------------------
 * Bloque 1 (rediseño de Promociones, panel lateral): consolida en una sola
 * lista las alertas de configuración que hoy están dispersas — el
 * checklist de `PromotionFormSummary.tsx` (info/alcance/beneficio
 * incompletos) y las advertencias visuales de `EffectCards.tsx` (precio
 * fijo ≥ precio de venta, precio fijo con alcance inválido) — más las
 * reglas de coherencia comercial que hoy solo se validan al guardar
 * (`promotion.schema.ts`), mostradas aca como aviso temprano.
 *
 * NO reemplaza ninguna validación: el schema de Zod (espejo del backend)
 * sigue siendo quien realmente bloquea el guardado. Esto es puramente
 * informativo, para que el usuario vea el problema en el panel lateral
 * sin esperar al error de submit.
 */
import type {
  PromotionEffectType,
  PromotionFundingType,
  PromotionOrigin,
  PromotionScopeType,
} from '../types/promotion.types'

export interface PromotionAlert {
  id: string
  message: string
}

export interface PromotionAlertsInput {
  name?: string
  scopeType?: PromotionScopeType
  hasScopeSelection: boolean
  effectType?: PromotionEffectType
  effectValue?: number | null
  buyQuantity?: number | null
  payQuantity?: number | null
  referenceProductSalePrice?: number | null
  commercialOrigin?: PromotionOrigin
  supplierId?: string | null
  fundingType?: PromotionFundingType
  supplierSubsidyValue?: number | null
}

export function buildPromotionAlerts(input: PromotionAlertsInput): PromotionAlert[] {
  const alerts: PromotionAlert[] = []

  if (!input.name || input.name.trim().length < 3) {
    alerts.push({ id: 'name', message: 'Falta un nombre para la promoción (mínimo 3 caracteres).' })
  }

  if (input.scopeType && input.scopeType !== 'CART' && !input.hasScopeSelection) {
    alerts.push({
      id: 'scope',
      message:
        input.scopeType === 'CATEGORY'
          ? 'Elegí al menos una categoría.'
          : 'Elegí al menos un producto.',
    })
  }

  if (input.effectType === 'BUY_X_PAY_Y') {
    if (input.buyQuantity == null || input.payQuantity == null) {
      alerts.push({ id: 'effect-value', message: 'Faltan las cantidades de "compra" y "paga".' })
    } else if (input.payQuantity >= input.buyQuantity) {
      alerts.push({
        id: 'effect-buyxpayy',
        message: 'La cantidad a pagar debe ser menor a la cantidad a comprar.',
      })
    }
  } else if (input.effectType && input.effectValue == null) {
    alerts.push({ id: 'effect-value', message: 'Falta el valor del beneficio.' })
  }

  if (
    input.effectType === 'FIXED_PRICE' &&
    input.scopeType != null &&
    input.scopeType !== 'PRODUCT' &&
    input.scopeType !== 'CATEGORY'
  ) {
    alerts.push({
      id: 'fixed-price-scope',
      message: 'El precio fijo solo puede aplicarse a un producto o una categoría.',
    })
  }

  if (
    input.effectType === 'FIXED_PRICE' &&
    input.effectValue != null &&
    input.referenceProductSalePrice != null &&
    input.effectValue >= input.referenceProductSalePrice
  ) {
    alerts.push({
      id: 'fixed-price-too-high',
      message: 'El precio fijo no es menor al precio de venta actual — no representa un descuento real todavía.',
    })
  }

  if ((input.commercialOrigin ?? 'INTERNAL') === 'SUPPLIER_MANDATED' && !input.supplierId) {
    alerts.push({
      id: 'commercial-origin-supplier',
      message: 'Falta indicar el proveedor: el origen comercial es "impuesta por el proveedor".',
    })
  }

  const fundingType = input.fundingType ?? 'NONE'
  if (fundingType !== 'NONE' && input.supplierSubsidyValue == null) {
    alerts.push({ id: 'funding-value', message: 'Falta el valor del subsidio del proveedor.' })
  }

  return alerts
}
