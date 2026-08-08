import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { emptyToUndefined, emptyToUndefinedNumber } from '../utils/emptyValue'
import type { CreatePromotionDto } from '../types/promotion.types'

const checkboxClassName = cn(
  'size-4 rounded border-input',
  'focus-visible:ring-3 focus-visible:ring-ring/50',
)

interface PromotionCompatibilityFieldsProps {
  register: UseFormRegister<CreatePromotionDto>
  errors: FieldErrors<CreatePromotionDto>
  isSubmitting: boolean
}

/**
 * features/promotions/components/PromotionCompatibilityFields.tsx
 * -----------------------------------------------------------------------------
 * Bloque 1 (rediseño de Promociones) — Paso "Combinación". Extraído de
 * `AdvancedRulesSection.tsx`: mismos 3 campos (`priority`/`stackable`/
 * `exclusiveGroup`), mismo `register`, ninguna regla nueva. La revisión
 * visual mas profunda (ej. prioridad como control segmentado en vez de
 * un número crudo) queda para el Bloque 3, según lo aprobado — este
 * bloque solo reubica los campos en su propio paso del riel.
 */
export function PromotionCompatibilityFields({
  register,
  errors,
  isSubmitting,
}: PromotionCompatibilityFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="promotion-form-priority">Prioridad</Label>
        <Input
          id="promotion-form-priority"
          type="number"
          min={0}
          step="1"
          disabled={isSubmitting}
          aria-invalid={!!errors.priority}
          {...register('priority', { setValueAs: emptyToUndefinedNumber })}
        />
        <p className="text-xs text-muted-foreground">
          Si dos promociones aplican a la misma línea, se evalúa primero la de mayor prioridad.
        </p>
        {errors.priority && <p className="text-sm text-destructive">{errors.priority.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="promotion-form-stackable"
          type="checkbox"
          disabled={isSubmitting}
          className={checkboxClassName}
          {...register('stackable')}
        />
        <Label htmlFor="promotion-form-stackable">Se puede combinar con otras promociones</Label>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="promotion-form-exclusiveGroup">Grupo de exclusión (opcional)</Label>
        <Input
          id="promotion-form-exclusiveGroup"
          placeholder="Ej. TEMPORADA_NAVIDENA"
          disabled={isSubmitting}
          {...register('exclusiveGroup', { setValueAs: emptyToUndefined })}
        />
        <p className="text-xs text-muted-foreground">
          Promociones del mismo grupo nunca se combinan entre sí, aunque sean "combinables".
        </p>
      </div>
    </div>
  )
}
