import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PurchaseStatus } from '../types/purchase.types'

interface PurchaseStatusTrackProps {
  status: PurchaseStatus | undefined
  className?: string
}

const STEPS: { status: 'DRAFT' | 'RECEIVED'; label: string }[] = [
  { status: 'DRAFT', label: 'Borrador' },
  { status: 'RECEIVED', label: 'Recibida' },
]

/**
 * features/purchases/components/PurchaseStatusTrack.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — reemplaza el `<Select>` de texto de "Estado"
 * (`PurchaseHeaderFields.tsx`, versión anterior) por una progresión visual:
 * Borrador → Recibida, con Cancelada como salida lateral (una compra
 * cancelada no "avanzó" a ningún lado, se descarta). Puramente de
 * presentación — no cambia `status` por sí mismo; la transición real ocurre
 * mediante acciones explícitas (los dos botones de guardado en
 * `PurchaseForm.tsx` al crear, o "Recibir compra"/"Cancelar compra" en
 * `PurchaseDetailPage.tsx` al editar), nunca eligiendo un valor de una lista.
 *
 * `status: undefined` (una compra nueva, todavía sin decidir) se muestra
 * como si estuviera en "Borrador" — mismo valor por defecto que ya asume el
 * backend cuando `CreatePurchaseDto.status` no se envía.
 */
export function PurchaseStatusTrack({ status, className }: PurchaseStatusTrackProps) {
  const effectiveStatus = status ?? 'DRAFT'

  if (effectiveStatus === 'CANCELLED') {
    return (
      <div className={cn('flex items-center gap-1.5 text-sm font-semibold text-destructive', className)}>
        <span className="flex size-5 items-center justify-center rounded-full border-2 border-destructive">
          <X className="size-3" />
        </span>
        Cancelada
      </div>
    )
  }

  const currentIndex = STEPS.findIndex((step) => step.status === effectiveStatus)

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step.status} className="flex items-center gap-1.5">
            {index > 0 && (
              <span className="text-xs text-muted-foreground" aria-hidden="true">
                →
              </span>
            )}
            <div
              className={cn(
                'flex items-center gap-1.5 text-sm font-semibold',
                isCurrent ? 'text-brand' : isDone ? 'text-success' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full border-2 text-[0.625rem]',
                  isDone
                    ? 'border-success bg-success text-success-foreground'
                    : isCurrent
                      ? 'border-brand'
                      : 'border-border',
                )}
              >
                {isDone ? <Check className="size-3" /> : index + 1}
              </span>
              {step.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
