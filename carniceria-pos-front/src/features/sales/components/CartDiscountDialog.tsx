import { useState } from 'react'
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
import { RequiredMark } from '@/components/ui/RequiredMark'
import { CartDiscount } from './CartDiscount'
import type { SaleDiscountType } from '../types/sale.types'

const textareaClassName =
  'flex min-h-16 w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

interface CartDiscountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  discountType: SaleDiscountType
  discountValue: number
  onDiscountTypeChange: (type: SaleDiscountType) => void
  onDiscountValueChange: (value: number) => void
  subtotal: number
  disabled?: boolean
}

/**
 * features/sales/components/CartDiscountDialog.tsx
 * -----------------------------------------------------------------------------
 * Bloque 2 (aprobado, "descuento manual como flujo profesional de ERP"):
 * mismo `CartDiscount.tsx` de siempre (sin ningun cambio de props/logica/
 * calculo), ahora presentado dentro de un `Dialog` compartido en vez de
 * una seccion que se expandia/contraia dentro del panel derecho —
 * `SalesPOSPage.tsx` sigue siendo el unico dueño de `discountType`/
 * `discountValue`, este componente solo cambia DONDE se editan.
 *
 * "Motivo del descuento" (obligatorio) y "Observaciones" (opcional) son
 * UNICAMENTE visuales, tal como se aprobo: viven en estado local de este
 * componente, nunca salen de aca — no se pasan a `SalesPOSPage.tsx`, no
 * se envian en `CreateSaleDto`, no afectan `discountAmount`/`total`. Es
 * preparacion de UX para una futura integracion, no un campo real hoy.
 * Se reinician cada vez que el dialogo se abre (mismo patron de "resetear
 * al abrir" ya usado en `ProductSearchDialog.tsx`).
 *
 * "Cancelar" y "Aplicar descuento" hacen exactamente lo mismo a nivel de
 * datos (cerrar el dialogo): `discountType`/`discountValue` ya se escriben
 * en vivo via `onDiscountTypeChange`/`onDiscountValueChange` (mismo
 * `CartDiscount` de siempre), no hay un estado "borrador" que confirmar o
 * descartar — mismo comportamiento que tenia la seccion expandible antes
 * de este bloque, solo que ahora vive en un Dialog.
 */
export function CartDiscountDialog({
  open,
  onOpenChange,
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
  subtotal,
  disabled = false,
}: CartDiscountDialogProps) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  // Reinicia Motivo/Observaciones cada vez que el dialogo pasa de cerrado
  // a abierto — ajuste de estado durante el render (no un efecto), mismo
  // criterio ya usado en `ProductSearchDialog.tsx` (`prevOpen`).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setReason('')
      setNotes('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar descuento</DialogTitle>
          <DialogDescription>
            Descuento manual sobre el subtotal de esta venta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <CartDiscount
            discountType={discountType}
            discountValue={discountValue}
            onDiscountTypeChange={onDiscountTypeChange}
            onDiscountValueChange={onDiscountValueChange}
            subtotal={subtotal}
            disabled={disabled}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-discount-reason">
              Motivo del descuento
              <RequiredMark />
            </Label>
            <Input
              id="pos-discount-reason"
              placeholder="Ej. Cliente frecuente, producto con imperfección..."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-discount-notes">Observaciones (opcional)</Label>
            <textarea
              id="pos-discount-notes"
              placeholder="Notas adicionales (opcional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={disabled}
              className={textareaClassName}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={disabled || reason.trim().length === 0}
          >
            Aplicar descuento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
