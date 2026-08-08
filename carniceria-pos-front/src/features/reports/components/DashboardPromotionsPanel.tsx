import { Percent, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { formatCurrency } from '@/utils/formatCurrency'
import type { Promotion } from '@/features/promotions/types/promotion.types'

const MAX_VISIBLE = 5

interface DashboardPromotionsPanelProps {
  /** Promociones ya filtradas por `active: true` (mismo filtro que ya
   * soporta `usePromotions`, sin inventar uno de "por vencer" que el
   * backend no tiene). */
  promotions: Promotion[]
  isLoading: boolean
  onViewMore: () => void
}

/** Resumen corto de la mecanica de la promocion, para una fila compacta —
 * mismos campos que ya expone `Promotion`, sin ningun calculo nuevo. */
function describeEffect(promotion: Promotion): string {
  switch (promotion.effectType) {
    case 'PERCENTAGE':
      return `${promotion.effectValue ?? 0}% de descuento`
    case 'FIXED_AMOUNT':
      return `Descuento fijo de ${formatCurrency(promotion.effectValue ?? 0)}`
    case 'SPECIAL_PRICE':
      return 'Precio especial'
    case 'FIXED_PRICE':
      return 'Precio fijo por unidad'
    case 'BUY_X_PAY_Y':
      return `Lleva ${promotion.buyQuantity ?? 0}, paga ${promotion.payQuantity ?? 0}`
    default:
      return 'Promoción activa'
  }
}

/**
 * Bloque 7.29C.1: tiempo restante hasta `endDate` — mismo dato real que ya
 * exponía `Promotion.endDate` (antes mostrado como "Hasta DD/MM"), solo se
 * cambia la presentación a "Vence en N días". Sin fecha (`endDate` nulo) se
 * mantiene "Sin fecha límite", sin cambios.
 */
function describeTimeRemaining(endDate: string): string {
  const diffDays = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) {
    return 'Vence hoy'
  }

  return `Vence en ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`
}

/**
 * features/reports/components/DashboardPromotionsPanel.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del Dashboard ("centro de control", aprobado): reutiliza
 * `usePromotions` (mismo hook que `PromotionsPage.tsx`) filtrado a
 * `active: true` — presentacion pura, recibe `promotions` ya cargadas por
 * `DashboardPage.tsx`.
 */
export function DashboardPromotionsPanel({ promotions, isLoading, onViewMore }: DashboardPromotionsPanelProps) {
  const visible = promotions.slice(0, MAX_VISIBLE)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Percent}
        title="Sin promociones activas"
        description="No hay promociones vigentes en este momento."
      />
    )
  }

  return (
    <div className="flex flex-col">
      {visible.map((promotion) => (
        <div
          key={promotion.id}
          className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Tag className="size-4 shrink-0 text-brand" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{promotion.name}</span>
              <span className="truncate text-xs text-muted-foreground">{describeEffect(promotion)}</span>
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {promotion.endDate ? describeTimeRemaining(promotion.endDate) : 'Sin fecha límite'}
          </span>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 self-start"
        onClick={onViewMore}
      >
        Ver más
      </Button>
    </div>
  )
}
