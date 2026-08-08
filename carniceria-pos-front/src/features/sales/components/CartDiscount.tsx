import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Input } from '@/components/ui/input'
import { toNumber } from '@/utils/parseNumber'
import type { SaleDiscountType } from '../types/sale.types'

const DISCOUNT_TYPE_OPTIONS: { value: SaleDiscountType; label: string }[] = [
  { value: 'NONE', label: 'Sin descuento' },
  { value: 'PERCENTAGE', label: '%' },
  { value: 'FIXED', label: '₡' },
]

interface CartDiscountProps {
  discountType: SaleDiscountType
  discountValue: number
  onDiscountTypeChange: (type: SaleDiscountType) => void
  onDiscountValueChange: (value: number) => void
  /** Subtotal actual del carrito: acota el descuento FIXED (no puede
   * superarlo) y sirve para el mensaje de validacion. */
  subtotal: number
  disabled?: boolean
}

/**
 * features/sales/components/CartDiscount.tsx
 * -----------------------------------------------------------------------------
 * Bloque de descuento del carrito (distinto del descuento por linea, que
 * este POS no expone en la UI). Presentacion pura + validacion de UI: no
 * calcula el monto final ni decide `total` — SalesPOSPage.tsx sigue siendo
 * quien deriva `discountAmount`/`total` a partir de estos mismos
 * `discountType`/`discountValue`, replicando la misma regla que aplica el
 * backend (`sales.service.ts`), para que la vista previa antes de confirmar
 * coincida con lo que el servidor va a calcular.
 *
 * Rediseño del POS (aprobado): deja de ser una `Card` independiente — es
 * una seccion mas dentro de la composicion unica del carrito armada en
 * `SalesPOSPage.tsx`, sin logica ni estilos de tarjeta propios.
 *
 * Pulido de layout (aprobado, Bloque 1 "carrito protagonista"): este
 * componente en si NO cambio (mismos props, mismo `onDiscountTypeChange`/
 * `onDiscountValueChange`) — lo que cambio es que `SalesPOSPage.tsx` ya no
 * lo renderiza siempre visible dentro de la tarjeta de totales, sino
 * oculto por defecto y mostrado al presionar "Aplicar descuento" (igual
 * que la maqueta, que solo muestra el resultado numerico en Totales).
 */
export function CartDiscount({
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
  subtotal,
  disabled = false,
}: CartDiscountProps) {
  // Buffer de texto (QA de UX de campos numericos, Bloque 3): el input
  // SIEMPRE muestra este string, nunca `discountValue` directamente —
  // mismo diagnostico que `SaleCorrectForm.tsx`/`PurchaseItemRow.tsx`
  // (Bloques 1 y 2): un input controlado que reconvierte a `Number` en
  // cada `onChange` y usa ese numero como `value` pierde el "." que el
  // usuario acaba de tipear. `discountValue` (prop, `number`) sigue
  // siendo la unica fuente que leen `SalesPOSPage.tsx`/`SaleCorrectForm.tsx`
  // para calcular `discountAmount`/`total` — no cambia su tipo ni su
  // significado, solo deja de ser lo que el input MUESTRA.
  //
  // Resincronizacion (ej. `setDiscountValue(0)` en `SalesPOSPage.tsx` al
  // completar una venta, o el propio `onDiscountValueChange(0)` de abajo
  // al cambiar a "Sin descuento"): comparacion directa contra el numero
  // que el texto ya representa, mismo patron ya simplificado en
  // `PurchaseItemRow.tsx` (sin rastrear un "valor externo anterior" —
  // eso disparaba un `setState` de mas en cada tecla).
  const [discountText, setDiscountText] = useState(discountValue === 0 ? '' : String(discountValue))
  if (discountValue !== toNumber(discountText)) {
    setDiscountText(discountValue === 0 ? '' : String(discountValue))
  }

  const handleTypeChange = (type: string) => {
    onDiscountTypeChange(type as SaleDiscountType)

    if (type === 'NONE') {
      onDiscountValueChange(0)
    }
  }

  const handleValueChange = (raw: string) => {
    setDiscountText(raw)
    onDiscountValueChange(toNumber(raw))
  }

  const validationMessage =
    discountType === 'PERCENTAGE' && discountValue > 100
      ? 'El porcentaje no puede ser mayor a 100.'
      : discountType === 'FIXED' && discountValue > subtotal
        ? 'El descuento no puede ser mayor al subtotal.'
        : discountValue < 0
          ? 'El descuento no puede ser negativo.'
          : null

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Descuento
      </span>

      <div className="flex items-center gap-2">
        <SegmentedControl
          options={DISCOUNT_TYPE_OPTIONS}
          value={discountType}
          onChange={handleTypeChange}
          size="md"
        />

        {discountType !== 'NONE' && (
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={discountType === 'PERCENTAGE' ? 100 : undefined}
            step={discountType === 'PERCENTAGE' ? 1 : 0.01}
            placeholder={discountType === 'PERCENTAGE' ? '0 - 100' : '0'}
            value={discountText}
            onChange={(event) => handleValueChange(event.target.value)}
            disabled={disabled}
            aria-invalid={!!validationMessage}
            className="h-8 w-24 shrink-0 rounded-lg"
          />
        )}
      </div>

      {validationMessage && (
        <p className="text-xs text-destructive">{validationMessage}</p>
      )}
    </div>
  )
}
