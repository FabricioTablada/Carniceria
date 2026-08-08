import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { cn } from '@/lib/utils'

interface PromotionCardProps {
  name: string
  icon: LucideIcon
  effectLabel: string
  scopeLabel: string
  benefit: string | null
  /** Resalta la card (borde/fondo/icono en verde) — "aplicada" en el
   * listado de solo lectura, "activa" en el de administración. Mismo
   * criterio visual en ambos casos: una promoción con efecto real ahora
   * mismo se distingue de un vistazo. */
  highlighted: boolean
  /** Contenido a la derecha del nombre — badge "Aplicada" (solo lectura) o
   * el `Switch` de activar/desactivar (administración). Cada dialogo
   * decide el suyo, esta card no sabe cuál es. */
  statusSlot?: ReactNode
  /** Línea final opcional (ej. "Disponible" / motivo por el que no se
   * aplicó todavía) — solo en el listado de solo lectura. */
  footerNote?: ReactNode
}

/**
 * features/sales/components/PromotionCard.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del POS (aprobado, "modal de Promociones — cada promoción como
 * una card moderna del ERP"): extrae el markup que antes vivía duplicado,
 * casi idéntico, en `PromotionsAvailableDialog.tsx` (solo lectura) y
 * `PromotionsActivationDialog.tsx` (activar/desactivar) — un solo diseño
 * de card, dos consumidores. Mismo criterio visual que las cards de
 * información del resto del ERP (icono en caja de color, jerarquía
 * nombre → chips → detalle), no una fila de tabla comprimida.
 */
export function PromotionCard({
  name,
  icon: Icon,
  effectLabel,
  scopeLabel,
  benefit,
  highlighted,
  statusSlot,
  footerNote,
}: PromotionCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3.5 rounded-2xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150',
        highlighted
          ? 'border-success/30 bg-success/[0.06]'
          : 'border-border/70 bg-card hover:border-brand/25',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          highlighted ? 'bg-success/15 text-success' : 'bg-brand/10 text-brand',
        )}
      >
        <Icon className="size-[1.125rem]" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="truncate text-base leading-tight font-bold tracking-tight text-foreground">
            {name}
          </span>
          {statusSlot}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="accent">{effectLabel}</Badge>
          <Badge variant="muted">{scopeLabel}</Badge>
        </div>

        {benefit && <p className="text-sm text-muted-foreground">{benefit}</p>}

        {footerNote}
      </div>
    </div>
  )
}
