import { useState } from 'react'
import { Scale } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/utils/formatCurrency'
import { getQuantityStep } from '@/utils/formatQuantity'
import { NumericKeypad } from './NumericKeypad'

interface ProductWeightDialogProps {
  /** Controla si el dialogo esta abierto. Componente controlado, sin
   * estado propio de apertura (mismo criterio que `CartDiscountDialog.tsx`). */
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  /** Precio por kilogramo del producto — mismo `Product.salePrice` que ya
   * usa el resto del POS, solo para la vista previa del subtotal. */
  unitPrice: number
  /** Peso ya cargado en el carrito para este producto (0 si es la primera
   * vez que se agrega). */
  initialWeight: number
  /** Se dispara con el peso ya validado (> 0) al confirmar. La validacion
   * de stock disponible la resuelve `SalesPOSPage.tsx` (mismo criterio que
   * el resto de las validaciones de carrito), no este dialogo. */
  onConfirm: (weight: number) => void
}

/**
 * features/sales/components/ProductWeightDialog.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del POS (aprobado): "cambiar definitivamente la decisión del
 * peso variable" — ya NO se espera una báscula electrónica; los productos
 * por KILOGRAMO piden el peso acá, con decimales (`step` reutiliza
 * `getQuantityStep('KILOGRAM')` = 0.001, mismo criterio ya usado en
 * Inventario/Compras para esta misma unidad). Mismo `CartLine.quantity`
 * de siempre: para un producto KILOGRAM, ese campo YA representa el peso
 * (no una cuenta de unidades) — no se agrega ningún campo nuevo al
 * carrito, solo esta forma de completarlo.
 *
 * Un único punto de entrada, dos usos (nuevo vs editar): `initialWeight`
 * en `0` es "agregar por primera vez" (buscador/catálogo/escáner);
 * `initialWeight > 0` es "editar el peso ya cargado" (click sobre el peso
 * en `CartItems.tsx`). Mismo dialogo, mismo `onConfirm`.
 */
export function ProductWeightDialog({
  open,
  onOpenChange,
  productName,
  unitPrice,
  initialWeight,
  onConfirm,
}: ProductWeightDialogProps) {
  const [weightInput, setWeightInput] = useState('')

  // Precarga el peso actual cada vez que el dialogo pasa de cerrado a
  // abierto — mismo patron de "ajuste de estado durante el render" ya
  // usado en `CartDiscountDialog.tsx`/`ProductSearchDialog.tsx`.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setWeightInput(initialWeight > 0 ? String(initialWeight) : '')
    }
  }

  const parsedWeight = Number(weightInput)
  const isValid = weightInput.trim().length > 0 && Number.isFinite(parsedWeight) && parsedWeight > 0
  const previewSubtotal = isValid ? parsedWeight * unitPrice : 0

  const handleConfirm = () => {
    if (!isValid) {
      return
    }

    onConfirm(parsedWeight)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-5 text-brand" />
            Ingresar peso
          </DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-product-weight">Peso (kg)</Label>
            <Input
              id="pos-product-weight"
              // Version 1.0.3, Bloque 5: `type="number"` (antes) saneaba a
              // "" el string intermedio "2." apenas se tocaba la coma
              // decimal del `NumericKeypad` (WHATWG: un punto sin digitos
              // despues no es un numero valido) — el placeholder "0.000"
              // se mostraba un instante, pareciendo un "reinicio" al
              // cajero, aunque el estado de React nunca se corrompia. Con
              // `type="text"` el navegador ya no sanea nada; la validacion
              // real sigue siendo `isValid` (arriba), no el tipo del input.
              type="text"
              inputMode="decimal"
              step={getQuantityStep('KILOGRAM')}
              min={0}
              autoFocus
              placeholder="0.000"
              value={weightInput}
              onChange={(event) => setWeightInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleConfirm()
                }
              }}
              className="h-12 text-center text-xl font-bold tabular-nums"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-bold tabular-nums">{formatCurrency(previewSubtotal)}</span>
          </div>

          {/* Rediseño del POS (aprobado, "venta por peso — mismo teclado
              numérico que el panel de cobro"): mismo componente compartido
              (`NumericKeypad`, `variant="decimal"`) — escribe sobre el
              mismo `weightInput` que ya editaba el input nativo de arriba,
              sin estado ni lógica nueva. */}
          <NumericKeypad value={weightInput} onChange={setWeightInput} variant="decimal" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!isValid}>
            {initialWeight > 0 ? 'Actualizar peso' : 'Agregar al pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
