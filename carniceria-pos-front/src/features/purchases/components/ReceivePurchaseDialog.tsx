import { PackageCheck } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { Purchase } from '../types/purchase.types'

interface ReceivePurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: Purchase
  onConfirm: () => void
  isSubmitting?: boolean
}

/**
 * features/purchases/components/ReceivePurchaseDialog.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — reemplaza el `<Select>` de Estado escondido en
 * `EditPurchaseForm.tsx` como forma de "recibir" una compra existente: la
 * transición DRAFT → RECEIVED (la de mayor consecuencia real del módulo —
 * dispara acreditación de stock, recálculo de costo promedio y creación de
 * lotes) pasa a ser una acción propia, con vista previa de consecuencias
 * antes de confirmar. Mismo `PATCH /purchases/:id` de siempre
 * (`useUpdatePurchase`, `PurchaseDetailPage.tsx`), sin ningún endpoint
 * nuevo.
 *
 * `useProducts({ limit: 100 })`: mismo techo/patrón ya usado en el resto
 * del módulo para cruzar `requiresBatch` sin una consulta por producto.
 */
export function ReceivePurchaseDialog({
  open,
  onOpenChange,
  purchase,
  onConfirm,
  isSubmitting = false,
}: ReceivePurchaseDialogProps) {
  const { data: productsResponse } = useProducts({ limit: 100 })
  const products = productsResponse?.data ?? []

  const distinctProductIds = new Set(purchase.items.map((item) => item.productId))
  const batchCount = purchase.items.filter(
    (item) => products.find((product) => product.id === item.productId)?.requiresBatch,
  ).length

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
            'flex flex-col gap-4 rounded-2xl border bg-card p-6 text-card-foreground shadow-xl',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'transition-all',
          )}
        >
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-lg font-bold tracking-tight">
              ¿Recibir esta compra?
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {purchase.supplier.name} · {purchase.documentNumber ?? 'Sin documento'} ·{' '}
              {formatCurrency(purchase.total)}
            </DialogPrimitive.Description>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-brand/20 bg-brand/5 p-3.5 text-sm">
            <div className="flex items-start gap-2.5">
              <PackageCheck className="mt-0.5 size-4 shrink-0 text-brand" />
              <span>
                Se sumará stock de {distinctProductIds.size} producto{distinctProductIds.size === 1 ? '' : 's'} al
                inventario de esta sucursal y se recalculará su costo promedio.
              </span>
            </div>
            {batchCount > 0 && (
              <div className="flex items-start gap-2.5">
                <PackageCheck className="mt-0.5 size-4 shrink-0 text-brand" />
                <span>
                  Se creará{batchCount === 1 ? '' : 'n'} {batchCount} lote{batchCount === 1 ? '' : 's'} nuevo
                  {batchCount === 1 ? '' : 's'} con trazabilidad de recepción.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <DialogPrimitive.Close
              render={
                <Button type="button" variant="ghost" size="sm" disabled={isSubmitting}>
                  Cancelar
                </Button>
              }
            />
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
            >
              <PackageCheck className="size-4" />
              {isSubmitting ? 'Recibiendo...' : 'Sí, recibir compra'}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
