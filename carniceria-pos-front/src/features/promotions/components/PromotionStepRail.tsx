import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PromotionStepId =
  | 'origin'
  | 'scope'
  | 'effect'
  | 'conditions'
  | 'combination'
  | 'funding'
  | 'review'

export type PromotionStepStatus = 'complete' | 'warning' | 'neutral'

export interface PromotionStepDefinition {
  id: PromotionStepId
  label: string
  status: PromotionStepStatus
}

interface PromotionStepRailProps {
  steps: PromotionStepDefinition[]
  currentStep: PromotionStepId
  onSelect: (id: PromotionStepId) => void
}

/**
 * features/promotions/components/PromotionStepRail.tsx
 * -----------------------------------------------------------------------------
 * Bloque 1 (rediseño de Promociones) — riel de navegación entre los
 * pasos del workspace. NO es un wizard bloqueado: cualquier paso es
 * clickeable en cualquier momento, sin importar si los anteriores están
 * completos — es un mapa del formulario, no una fila de candados. El
 * paso "Financiamiento" ni siquiera aparece en `steps` cuando no
 * corresponde (`PromotionForm.tsx` lo filtra antes de llegar aca según
 * `commercialOrigin`), en vez de mostrarse deshabilitado.
 *
 * Workspace Promociones (aprobado): sin borde/fondo propios — antes era
 * una tarjeta suelta (`rounded-xl border bg-muted/30`), ahora es
 * directamente una columna del Canvas único de `PromotionForm.tsx`
 * (divisor `lg:divide-x`, sin chrome repetido). Único consumidor de este
 * componente, por eso se edita el estilo base directo en vez de agregar
 * un prop `bare` (no hay otro caso que preservar).
 */
export function PromotionStepRail({ steps, currentStep, onSelect }: PromotionStepRailProps) {
  return (
    <nav aria-label="Pasos de la promoción" className="flex flex-col gap-1 bg-muted/20 p-3">

      {steps.map((step, index) => {
        const isActive = step.id === currentStep

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            aria-current={isActive ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150',
              isActive
                ? 'bg-card font-semibold text-brand shadow-sm'
                : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-bold tabular-nums',
                step.status === 'complete'
                  ? 'border-success bg-success text-success-foreground'
                  : isActive
                    ? 'border-brand text-brand'
                    : step.status === 'warning'
                      ? 'border-warning text-warning'
                      : 'border-border text-muted-foreground',
              )}
            >
              {step.status === 'complete' ? <Check className="size-3" /> : index + 1}
            </span>
            {step.label}
          </button>
        )
      })}
    </nav>
  )
}
