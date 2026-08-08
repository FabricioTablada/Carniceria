import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Banknote, Percent, Repeat2, Sparkles, Tag, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { emptyToUndefinedNumber } from '../utils/emptyValue'
import { computePreviewExample } from '../utils/promotionNarrative'
import type { CreatePromotionDto, PromotionEffectType } from '../types/promotion.types'

const EFFECT_TYPE_OPTIONS: {
  value: PromotionEffectType
  label: string
  example: string
  icon: typeof Percent
}[] = [
  { value: 'PERCENTAGE', label: 'Porcentaje', example: 'Ej. 20% → el cliente paga menos.', icon: Percent },
  { value: 'FIXED_AMOUNT', label: 'Monto fijo', example: 'Ej. ₡500 menos, sin importar el precio.', icon: Banknote },
  { value: 'SPECIAL_PRICE', label: 'Precio especial', example: 'Ej. nuevo precio total de ₡1.000.', icon: Sparkles },
  {
    value: 'FIXED_PRICE',
    label: 'Precio fijo',
    example: 'Ej. ₡2.200/kg en vez de ₡2.500/kg (solo Producto o Categoría).',
    icon: Tag,
  },
  {
    value: 'BUY_X_PAY_Y',
    label: 'Compre N pague M',
    example: 'Ej. compra 3, paga 2 (2x1, 3x2, etc.).',
    icon: Repeat2,
  },
]

interface EffectCardsProps {
  control: Control<CreatePromotionDto>
  register: UseFormRegister<CreatePromotionDto>
  errors: FieldErrors<CreatePromotionDto>
  isSubmitting: boolean
  /** Producto real de referencia para la vista previa (el primero
   * seleccionado en `ScopeCards`, si el alcance es Producto/Combo) — lo
   * resuelve `PromotionForm.tsx` desde datos ya cargados por
   * `useProducts`, sin pedir nada nuevo. `undefined` para Categoría/
   * Carrito o si todavia no hay ningun producto elegido: la vista previa
   * cae al ejemplo genérico (`computePreviewExample`). */
  referenceProduct?: { name: string; salePrice: number } | null
}

/**
 * features/promotions/components/EffectCards.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — rediseño de Promociones, seccion "¿Cuál será
 * el beneficio?" (antes "Beneficio"). Reemplaza el `<Select>` de
 * `effectType` por 4 tarjetas con un ejemplo corto cada una. Los inputs
 * numericos condicionales son los mismos de antes (mismo `register`,
 * mismos nombres, mismas reglas) — solo cambia como se elige el tipo.
 *
 * Agrega una vista previa dinamica (`computePreviewExample`,
 * `utils/promotionNarrative.ts`): puramente visual, nunca se envia al
 * backend — solo lee `effectValue`/`buyQuantity`/`payQuantity` ya
 * observados via `useWatch` y el precio real de `referenceProduct` (o un
 * ejemplo generico de ₡5.000 si no hay producto concreto todavia).
 */
export function EffectCards({ control, register, errors, isSubmitting, referenceProduct }: EffectCardsProps) {
  const effect = useWatch({ control, name: 'effectType' })
  const effectValue = useWatch({ control, name: 'effectValue' })
  const buyQuantity = useWatch({ control, name: 'buyQuantity' })
  const payQuantity = useWatch({ control, name: 'payQuantity' })
  // PROMO-13: solo para la advertencia de alcance de mas abajo — el
  // backend (`promotions.validation.ts`/`promotions.service.ts`) es quien
  // realmente bloquea la combinacion invalida; esto es apenas un aviso
  // temprano en el mismo lugar donde el usuario elige el efecto.
  const scopeType = useWatch({ control, name: 'scopeType' })

  const preview = computePreviewExample(
    { effectType: effect, effectValue, buyQuantity, payQuantity },
    referenceProduct,
  )

  // PROMO-13 (decision aprobada: "mostrar únicamente una advertencia
  // visual, no bloquear"): un precio fijo mayor o igual al precio de venta
  // actual del producto de referencia no impide guardar la promoción —
  // puede ser legítimo cargarla con antelación, antes de que el precio de
  // lista se actualice. Solo se muestra cuando hay un producto real de
  // referencia (`referenceProduct`); sin eso no hay contra qué comparar.
  const showsFixedPriceTooHighWarning =
    effect === 'FIXED_PRICE' &&
    effectValue != null &&
    referenceProduct != null &&
    effectValue >= referenceProduct.salePrice

  const showsFixedPriceScopeWarning =
    effect === 'FIXED_PRICE' && scopeType != null && scopeType !== 'PRODUCT' && scopeType !== 'CATEGORY'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>
          Tipo de beneficio
          <RequiredMark />
        </Label>
        <Controller
          control={control}
          name="effectType"
          render={({ field }) => (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {EFFECT_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon
                const selected = field.value === option.value

                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 transition-colors duration-150',
                      selected
                        ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                        : 'border-input hover:bg-muted/50',
                    )}
                  >
                    <input
                      type="radio"
                      name="promotion-effect-type"
                      value={option.value}
                      checked={selected}
                      disabled={isSubmitting}
                      onChange={() => field.onChange(option.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2">
                      <Icon className={cn('size-4', selected ? 'text-brand' : 'text-muted-foreground')} />
                      <span className={cn('text-sm font-semibold', selected && 'text-brand')}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{option.example}</p>
                  </label>
                )
              })}
            </div>
          )}
        />
        {errors.effectType && (
          <p className="text-sm text-destructive">{errors.effectType.message}</p>
        )}
      </div>

      {effect === 'BUY_X_PAY_Y' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="promotion-form-buyQuantity">
              Compra
              <RequiredMark />
            </Label>
            <Input
              id="promotion-form-buyQuantity"
              type="number"
              min={1}
              step="1"
              disabled={isSubmitting}
              aria-invalid={!!errors.buyQuantity}
              {...register('buyQuantity', { setValueAs: emptyToUndefinedNumber })}
            />
            {errors.buyQuantity && (
              <p className="text-sm text-destructive">{errors.buyQuantity.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="promotion-form-payQuantity">
              Paga
              <RequiredMark />
            </Label>
            <Input
              id="promotion-form-payQuantity"
              type="number"
              min={1}
              step="1"
              disabled={isSubmitting}
              aria-invalid={!!errors.payQuantity}
              {...register('payQuantity', { setValueAs: emptyToUndefinedNumber })}
            />
            {errors.payQuantity && (
              <p className="text-sm text-destructive">{errors.payQuantity.message}</p>
            )}
          </div>
        </div>
      ) : effect ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="promotion-form-effectValue">
            {effect === 'PERCENTAGE'
              ? 'Porcentaje de descuento (%)'
              : effect === 'SPECIAL_PRICE'
                ? 'Precio especial — total (₡)'
                : effect === 'FIXED_PRICE'
                  ? 'Precio fijo por unidad (₡)'
                  : 'Monto de descuento (₡)'}
            <RequiredMark />
          </Label>
          <Input
            id="promotion-form-effectValue"
            type="number"
            min={0}
            step="0.01"
            disabled={isSubmitting}
            aria-invalid={!!errors.effectValue}
            {...register('effectValue', { setValueAs: emptyToUndefinedNumber })}
          />
          {errors.effectValue && (
            <p className="text-sm text-destructive">{errors.effectValue.message}</p>
          )}

          {/* PROMO-13: advertencia visual, NUNCA bloquea el guardado
              (decision aprobada explicitamente). */}
          {showsFixedPriceTooHighWarning && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              El precio fijo no es menor al precio de venta actual de {referenceProduct?.name}{' '}
              ({formatCurrency(referenceProduct!.salePrice)}) — la promoción se puede guardar
              igual, pero no representará un descuento real hasta que el precio fijo sea menor.
            </p>
          )}

          {showsFixedPriceScopeWarning && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              El precio fijo solo puede aplicarse a un producto o una categoría — cambiá el
              alcance arriba para que esta promoción pueda guardarse.
            </p>
          )}
        </div>
      ) : null}

      {/* Vista previa dinamica: solo visual, nunca se envia al backend. */}
      {preview && (
        <div className="flex items-center gap-3 rounded-lg border border-brand/15 bg-brand/5 p-3">
          <div className="flex flex-1 flex-col gap-0.5">
            <p className="text-xs font-semibold tracking-wide text-brand/70 uppercase">
              Vista previa {preview.isRealProduct ? '' : '(ejemplo)'}
            </p>
            <p className="text-sm text-foreground">{preview.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">
              {formatCurrency(preview.before)}
            </span>
            <span className="text-lg font-bold tabular-nums text-brand">
              {formatCurrency(Math.max(0, preview.after))}
            </span>
          </div>
        </div>
      )}

      {effect === 'BUY_X_PAY_Y' && buyQuantity != null && payQuantity != null && payQuantity < buyQuantity && (
        <div className="rounded-lg border border-brand/15 bg-brand/5 p-3">
          <p className="text-xs font-semibold tracking-wide text-brand/70 uppercase">Vista previa</p>
          <p className="text-sm text-foreground">
            Compra {buyQuantity} y paga {payQuantity} — {buyQuantity - payQuantity} unidad
            {buyQuantity - payQuantity === 1 ? '' : 'es'} de regalo.
          </p>
        </div>
      )}
    </div>
  )
}
