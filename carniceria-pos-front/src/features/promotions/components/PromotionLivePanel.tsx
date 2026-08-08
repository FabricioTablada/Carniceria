import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildScopePhrase } from '../utils/promotionNarrative'
import { calculatePromotionProfitabilityPreview } from '../utils/promotionProfitabilityPreview'
import { buildPromotionAlerts } from '../utils/promotionAlerts'
import type {
  PromotionEffectType,
  PromotionFundingType,
  PromotionOrigin,
  PromotionScopeType,
} from '../types/promotion.types'

export interface PromotionLivePanelReferenceProduct {
  name: string
  salePrice: number
  cost: number
  expectedWastePercent: number
  applyExpectedWasteToCost: boolean
  taxRate: number
  unitOfMeasure: 'KILOGRAM' | 'UNIT'
}

interface PromotionLivePanelProps {
  name?: string
  scopeType?: PromotionScopeType
  hasScopeSelection: boolean
  selectedNames: string[]
  effectType?: PromotionEffectType
  effectValue?: number | null
  buyQuantity?: number | null
  payQuantity?: number | null
  minQuantity?: number | null
  referenceProduct?: PromotionLivePanelReferenceProduct | null
  fundingType?: PromotionFundingType
  supplierSubsidyValue?: number | null
  supplierId?: string | null
  commercialOrigin?: PromotionOrigin
  /** Estado real de la promoción — en creación, el checkbox del formulario;
   * en edición, el estado ya persistido (`Promotion.active`, que no forma
   * parte de `updatePromotionSchema`: el cambio de estado es una acción
   * separada, `useUpdatePromotionStatus`). Puramente informativo aca. */
  isActive: boolean
}

type StatTone = 'neutral' | 'brand' | 'success' | 'destructive'

/**
 * features/promotions/components/PromotionLivePanel.tsx
 * -----------------------------------------------------------------------------
 * Bloque 1 (rediseño de Promociones) — reemplaza a `PromotionFormSummary.tsx`
 * (narrativa + 6 cifras de rentabilidad) por una simulación comercial
 * completa, en el orden pedido: producto/categoría, precio normal, precio
 * promocional, cantidad, subtotal, descuento, impuestos, total, costo,
 * utilidad, margen, estado y alertas.
 *
 * Reutiliza EXCLUSIVAMENTE calculo ya existente:
 * `calculatePromotionProfitabilityPreview` (extendida en este mismo bloque
 * con subtotal/descuento/impuesto/total, mismas 4 formulas de descuento de
 * siempre) y `buildScopePhrase` (`promotionNarrative.ts`, sin cambios). Las
 * alertas reutilizan las mismas condiciones que ya existían dispersas en
 * `PromotionFormSummary.tsx`/`EffectCards.tsx` (`promotionAlerts.ts`, nuevo
 * archivo que solo las consolida). Ningún cálculo de negocio nuevo.
 *
 * Workspace Promociones (aprobado): sin borde/fondo/sombra propios —
 * antes era una tarjeta suelta (`rounded-xl border bg-card shadow-sm`),
 * ahora es directamente la columna derecha del Canvas único de
 * `PromotionForm.tsx`. Único consumidor de este componente, por eso se
 * edita el estilo base directo en vez de agregar un prop `bare`.
 */
export function PromotionLivePanel({
  name,
  scopeType,
  hasScopeSelection,
  selectedNames,
  effectType,
  effectValue,
  buyQuantity,
  payQuantity,
  minQuantity,
  referenceProduct,
  fundingType,
  supplierSubsidyValue,
  supplierId,
  commercialOrigin,
  isActive,
}: PromotionLivePanelProps) {
  const profitability = referenceProduct
    ? calculatePromotionProfitabilityPreview(
        {
          averageCost: referenceProduct.cost,
          expectedWastePercent: referenceProduct.expectedWastePercent,
          applyExpectedWasteToCost: referenceProduct.applyExpectedWasteToCost,
          salePrice: referenceProduct.salePrice,
          taxRate: referenceProduct.taxRate,
        },
        { effectType, effectValue, buyQuantity, payQuantity, minQuantity, fundingType, supplierSubsidyValue },
      )
    : null

  const scopePhrase = buildScopePhrase({ scopeType, selectedNames })

  const alerts = buildPromotionAlerts({
    name,
    scopeType,
    hasScopeSelection,
    effectType,
    effectValue,
    buyQuantity,
    payQuantity,
    referenceProductSalePrice: referenceProduct?.salePrice,
    commercialOrigin,
    supplierId,
    fundingType,
    supplierSubsidyValue,
  })

  const unitLabel = referenceProduct?.unitOfMeasure === 'KILOGRAM' ? 'kg' : 'unidades'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Simulación comercial
        </p>
        <p className="truncate text-base font-bold text-foreground">
          {name || 'Promoción sin nombre'}
        </p>
      </div>

      <div className="flex flex-col divide-y divide-border border-t border-border">
        <StatRow label="Producto / categoría" value={scopePhrase} />

        {profitability && referenceProduct ? (
          <>
            <StatRow label="Precio normal" value={formatCurrency(referenceProduct.salePrice)} />
            <StatRow
              label="Precio promocional"
              value={formatCurrency(profitability.salePrice)}
              tone="brand"
            />
            <StatRow label="Cantidad" value={`${profitability.simulatedQuantity} ${unitLabel}`} />
            <StatRow label="Subtotal" value={formatCurrency(profitability.subtotal)} />
            <StatRow
              label="Descuento"
              value={`− ${formatCurrency(profitability.discountTotal)}`}
              tone="destructive"
            />
            <StatRow label="Impuestos" value={formatCurrency(profitability.taxTotal)} />
            <StatRow label="Total" value={formatCurrency(profitability.total)} tone="brand" emphasis />
            <StatRow label="Costo" value={formatCurrency(profitability.effectiveCost)} />
            <StatRow
              label="Utilidad"
              value={formatCurrency(profitability.finalProfitability)}
              tone={profitability.finalProfitability >= 0 ? 'success' : 'destructive'}
            />
            <StatRow
              label="Margen"
              value={
                profitability.marginPercent != null ? `${profitability.marginPercent.toFixed(1)}%` : '—'
              }
              tone={
                profitability.marginPercent == null
                  ? 'neutral'
                  : profitability.marginPercent >= 0
                    ? 'success'
                    : 'destructive'
              }
            />
          </>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            Elegí un producto (o un combo) y un beneficio para ver la simulación completa.
          </p>
        )}

        <StatRow
          label="Estado"
          value={isActive ? 'Activa' : 'Inactiva'}
          tone={isActive ? 'success' : 'neutral'}
        />
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Alertas de configuración
          </p>
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatRow({
  label,
  value,
  tone = 'neutral',
  emphasis = false,
}: {
  label: string
  value: string
  tone?: StatTone
  emphasis?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'brand'
          ? 'text-brand'
          : 'text-foreground'

  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'shrink-0 text-right text-sm font-semibold tabular-nums',
          emphasis && 'text-base font-bold',
          toneClass,
        )}
      >
        {value}
      </span>
    </div>
  )
}
