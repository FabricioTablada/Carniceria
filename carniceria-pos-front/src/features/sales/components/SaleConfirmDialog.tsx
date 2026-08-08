import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import type { PaymentMethod } from '../types/sale.types'
import { PAYMENT_METHOD_OPTIONS } from '../utils/payment'

interface SaleConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Cantidad de lineas distintas en el carrito. */
  lineCount: number
  /** Cantidad total de unidades en el carrito. */
  itemCount: number
  paymentMethod: PaymentMethod
  /** Referencia del pago electronico (QA-007) — vacia para efectivo o
   * cuando el metodo de pago no la requiere. */
  paymentReference: string
  subtotal: number
  taxTotal: number
  /** Monto del descuento de carrito ya calculado (0 si no hay descuento). */
  discountAmount: number
  total: number
  /** Se dispara al presionar "Confirmar venta" dentro del modal. Es
   * literalmente `handleConfirmSale` de SalesPOSPage.tsx — este componente
   * no registra la venta por si mismo, solo pide la confirmacion previa. */
  onConfirm: () => void
  /** Deshabilita el boton de confirmar mientras la mutacion esta en curso
   * (mismo `isPending` de `useCreateSale` que ya gobernaba el boton del
   * Checkout). */
  isConfirming: boolean
}

/**
 * components/SaleConfirmDialog.tsx
 * -----------------------------------------------------------------------------
 * Paso de confirmacion previo al registro de la venta. Misma estructura de
 * dialogo (Backdrop/Popup, clases Tailwind) ya usada en PosLayout.tsx
 * ("Movimiento de caja") y SaleReceiptDialog.tsx — presentacion pura, no
 * conoce la mutacion ni el flujo de venta: solo muestra el resumen recibido
 * por props y delega en `onConfirm` (la misma `handleConfirmSale` de
 * siempre) y `onOpenChange` (cerrar/cancelar).
 */
export function SaleConfirmDialog({
  open,
  onOpenChange,
  lineCount,
  itemCount,
  paymentMethod,
  paymentReference,
  subtotal,
  taxTotal,
  discountAmount,
  total,
  onConfirm,
  isConfirming,
}: SaleConfirmDialogProps) {
  const paymentMethodLabel =
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === paymentMethod)?.label ??
    paymentMethod

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-50 bg-black/50',
            'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity',
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'flex flex-col gap-6 rounded-2xl border bg-card p-8 text-card-foreground shadow-xl',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'transition-all',
          )}
        >
          <div className="flex flex-col gap-2">
            <DialogPrimitive.Title className="text-xl font-bold tracking-tight">
              Confirmar venta
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-base text-muted-foreground">
              Revisa el resumen antes de registrar la venta.
            </DialogPrimitive.Description>
          </div>

          <div className="flex flex-col gap-2 text-base">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Líneas en el carrito</span>
              <span className="font-medium">{lineCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cantidad de productos</span>
              <span className="font-medium">{itemCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Método de pago</span>
              <span className="font-medium">{paymentMethodLabel}</span>
            </div>

            {paymentReference.trim().length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Referencia de pago</span>
                <span className="font-medium">{paymentReference}</span>
              </div>
            )}

            <div className="mt-2 flex flex-col gap-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Impuestos</span>
                <span>{formatCurrency(taxTotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="text-destructive">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-base font-semibold">TOTAL</span>
                <span className="text-xl font-bold text-brand">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-5">
            <DialogPrimitive.Close
              render={
                <Button type="button" variant="ghost" size="sm">
                  Cancelar
                </Button>
              }
            />
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isConfirming}
              className="bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
            >
              {isConfirming ? 'Confirmando...' : 'Confirmar venta'}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
