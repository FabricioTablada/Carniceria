import { Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { EmptyState } from '@/components/common/EmptyState'
import { formatCurrency } from '@/utils/formatCurrency'
import { usePurchases } from '../hooks/usePurchases'
import { formatPurchaseDate } from '../utils/purchase.utils'
import { PurchaseStatusBadge } from './PurchaseStatusBadge'
import type { Purchase } from '../types/purchase.types'

interface DuplicatePurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (purchase: Purchase) => void
}

/**
 * features/purchases/components/DuplicatePurchaseDialog.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — acción rápida "Duplicar compra anterior": lista las
 * últimas compras (`GET /purchases`, mismo endpoint que la lista del
 * módulo, sin filtro nuevo) para elegir una y precargar el formulario de
 * una compra nueva (`duplicatePurchaseToDto`, `PurchaseForm.tsx`). Sin
 * mutación propia: solo lee y entrega la `Purchase` elegida.
 */
export function DuplicatePurchaseDialog({ open, onOpenChange, onSelect }: DuplicatePurchaseDialogProps) {
  const { data, isLoading } = usePurchases({ limit: 20 })
  const purchases = data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] w-[95vw] max-w-lg flex-col gap-4 p-5">
        <DialogHeader>
          <DialogTitle>Duplicar compra anterior</DialogTitle>
          <DialogDescription>
            Elegí una compra reciente para precargar sus productos, proveedor y notas en la compra nueva.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Cargando compras...</p>}

        {!isLoading && purchases.length === 0 && (
          <EmptyState
            icon={Copy}
            title="No hay compras para duplicar"
            description="Todavía no se registró ninguna compra en el sistema."
          />
        )}

        {!isLoading && purchases.length > 0 && (
          <div className="flex flex-col gap-1.5 overflow-y-auto">
            {purchases.map((purchase) => (
              <button
                key={purchase.id}
                type="button"
                onClick={() => onSelect(purchase)}
                className="flex items-center gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:bg-brand/5 hover:border-brand/20"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {purchase.supplier.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {purchase.documentNumber ?? 'Sin documento'} · {formatPurchaseDate(purchase.purchaseDate)} ·{' '}
                    {purchase.items.length} producto{purchase.items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <PurchaseStatusBadge status={purchase.status} className="shrink-0" />
                <span className="shrink-0 text-sm font-bold tabular-nums text-brand">
                  {formatCurrency(purchase.total)}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
