import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Label } from '@/components/ui/label'
import { useVoidSale } from '../hooks/useVoidSale'
import { getSaleErrorMessage } from '../utils/saleErrors'
import type { Sale } from '../types/sale.types'

interface SaleVoidPanelProps {
  sale: Sale
  onCancel: () => void
  /** Se dispara cuando la anulación se registró con éxito. */
  onSuccess: () => void
}

/**
 * features/sales/components/SaleVoidPanel.tsx
 * -----------------------------------------------------------------------------
 * Bloque 3 ("Anulacion/Correccion de Venta"). Paso de confirmacion con
 * motivo obligatorio, embebido dentro del mismo `Dialog` del detalle
 * (`SaleDetailDialog.tsx`) en vez de un segundo modal encadenado — no usa
 * `ConfirmDialog.tsx` porque esa confirmacion no acepta un campo de texto
 * (motivo), solo titulo/descripcion fijos.
 */
export function SaleVoidPanel({ sale, onCancel, onSuccess }: SaleVoidPanelProps) {
  const { mutate: voidSale, isPending, error } = useVoidSale()
  const [reason, setReason] = useState('')

  const canSubmit = reason.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) {
      return
    }

    voidSale(
      { id: sale.id, dto: { reason: reason.trim() } },
      {
        onSuccess: () => {
          onSuccess()
          // Bloque POS-08: evento puntual de exito, hoy silencioso (solo
          // cerraba este sub-flujo).
          toast.success('Venta anulada correctamente')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Se anulará la venta <span className="font-semibold">{sale.documentNumber}</span>. Su
        estado cambiará a <span className="font-semibold">Anulada</span> y se revertirá el
        inventario descontado. Esta acción no se puede deshacer.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold text-destructive">
          Motivo de la anulación (obligatorio)
        </Label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Explica por qué se anula esta venta..."
          aria-invalid={reason.trim().length === 0}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
      </div>

      {error && <ErrorAlert>{getSaleErrorMessage(error)}</ErrorAlert>}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
        >
          {isPending ? 'Anulando...' : 'Confirmar anulación'}
        </Button>
      </div>
    </div>
  )
}
