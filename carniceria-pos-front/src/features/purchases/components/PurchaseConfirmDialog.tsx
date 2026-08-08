import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatPurchaseDate } from '../utils/purchase.utils'

export interface PurchaseConfirmItem {
  productName: string
  quantity: number
  unitCost: number
  /** "13%" o "Sin impuesto" — ya resuelto por quien arma la lista
   * (`PurchaseForm.tsx`), este componente no conoce impuestos. */
  taxLabel: string
  lineTotal: number
}

interface PurchaseConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierName: string
  documentNumber: string | null | undefined
  /** `purchaseDate` tal como esta en el form (`"YYYY-MM-DD"`), se formatea
   * aca con `formatPurchaseDate`. */
  purchaseDate: string | undefined
  items: PurchaseConfirmItem[]
  subtotal: number
  taxTotal: number
  total: number
  /** Se dispara al presionar "Confirmar compra" dentro del modal. Es
   * literalmente el `onSubmit` de `PurchaseForm.tsx` — este componente no
   * envia la compra por si mismo, solo pide la confirmacion previa. Mismo
   * criterio que `SaleConfirmDialog.tsx` en Sales. */
  onConfirm: () => void
  isSubmitting?: boolean
  /** Rediseño de Compras — "vista previa antes de recibir": cuando la
   * compra se va a guardar y recibir en el mismo paso ("Guardar y recibir
   * ahora", `PurchaseForm.tsx`), se muestran las consecuencias reales de
   * esa transición antes de confirmar. `undefined` cuando la compra se
   * guarda como borrador — no hay ninguna consecuencia que anticipar. */
  receiveConsequences?: {
    productCount: number
    batchCount: number
  }
}

/**
 * features/purchases/components/PurchaseConfirmDialog.tsx
 * -----------------------------------------------------------------------------
 * Paso de confirmacion previo al registro de la compra: la compra solo se
 * envia al backend cuando el usuario confirma aca (ver `PurchaseForm.tsx`,
 * que intercepta el submit del formulario y abre este dialogo en vez de
 * llamar a `onSubmit` directamente). Mismo patron de dialogo (Backdrop/
 * Popup, clases Tailwind) ya usado en `SaleConfirmDialog.tsx` de Sales —
 * presentacion pura, no conoce el formulario ni la mutacion.
 */
export function PurchaseConfirmDialog({
  open,
  onOpenChange,
  supplierName,
  documentNumber,
  purchaseDate,
  items,
  subtotal,
  taxTotal,
  total,
  onConfirm,
  isSubmitting = false,
  receiveConsequences,
}: PurchaseConfirmDialogProps) {
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
            'fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'flex max-h-[85vh] flex-col gap-5 rounded-2xl border bg-card p-6 text-card-foreground shadow-xl',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'transition-all',
          )}
        >
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-lg font-bold tracking-tight">
              Confirmar compra
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Revisa los datos antes de registrar la compra.
            </DialogPrimitive.Description>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Proveedor
              </span>
              <span className="font-medium">{supplierName}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Documento
              </span>
              <span className="font-medium">{documentNumber ?? '—'}</span>
            </div>
            <div className="col-span-2 flex flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Fecha
              </span>
              <span className="font-medium">
                {purchaseDate ? formatPurchaseDate(purchaseDate) : '—'}
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Productos ({items.length})
            </span>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th scope="col" className="p-2 text-left font-semibold">Producto</th>
                    <th scope="col" className="p-2 text-right font-semibold">Cant.</th>
                    <th scope="col" className="p-2 text-right font-semibold">Costo</th>
                    <th scope="col" className="p-2 text-left font-semibold">Impuesto</th>
                    <th scope="col" className="p-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-b last:border-b-0">
                      <td className="p-2">{item.productName}</td>
                      <td className="p-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="p-2 text-right tabular-nums">{formatCurrency(item.unitCost)}</td>
                      <td className="p-2 text-muted-foreground">{item.taxLabel}</td>
                      <td className="p-2 text-right font-medium tabular-nums">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {receiveConsequences && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-brand/20 bg-brand/5 p-3 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-brand">
                <PackageCheck className="size-4" />
                Al recibir esta compra
              </span>
              <p className="text-muted-foreground">
                Se sumará stock de {receiveConsequences.productCount} producto
                {receiveConsequences.productCount === 1 ? '' : 's'} y se recalculará su costo promedio.
                {receiveConsequences.batchCount > 0 &&
                  ` Se creará${receiveConsequences.batchCount === 1 ? '' : 'n'} ${receiveConsequences.batchCount} lote${receiveConsequences.batchCount === 1 ? '' : 's'} nuevo${receiveConsequences.batchCount === 1 ? '' : 's'}.`}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Impuestos</span>
              <span className="font-medium tabular-nums">{formatCurrency(taxTotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-base font-semibold">TOTAL</span>
              <span className="text-xl font-bold tabular-nums text-brand">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <DialogPrimitive.Close
              render={
                <Button type="button" variant="ghost" size="sm" disabled={isSubmitting}>
                  Volver a editar
                </Button>
              }
            />
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
            >
              {isSubmitting ? 'Guardando...' : 'Confirmar compra'}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
