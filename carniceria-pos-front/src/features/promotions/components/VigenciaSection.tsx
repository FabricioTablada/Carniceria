import { useState } from 'react'
import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { emptyToUndefined } from '../utils/emptyValue'
import type { CreatePromotionDto, DayOfWeek } from '../types/promotion.types'

const checkboxClassName = cn(
  'size-4 rounded border-input',
  'focus-visible:ring-3 focus-visible:ring-ring/50',
)

const DAY_OF_WEEK_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Lunes' },
  { value: 'TUESDAY', label: 'Martes' },
  { value: 'WEDNESDAY', label: 'Miércoles' },
  { value: 'THURSDAY', label: 'Jueves' },
  { value: 'FRIDAY', label: 'Viernes' },
  { value: 'SATURDAY', label: 'Sábado' },
  { value: 'SUNDAY', label: 'Domingo' },
]

interface VigenciaSectionProps {
  register: UseFormRegister<CreatePromotionDto>
  errors: FieldErrors<CreatePromotionDto>
  setValue: UseFormSetValue<CreatePromotionDto>
  isSubmitting: boolean
  /** `true` si la promocion (en edicion) ya tenia alguna fecha/hora/dia
   * configurado — el interruptor arranca activado en ese caso, para no
   * esconder datos reales que ya existen. */
  initialEnabled: boolean
}

/**
 * features/promotions/components/VigenciaSection.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — rediseño de Promociones, seccion "Vigencia".
 * Antes siempre visible (fechas/horas/dias expandidos aunque casi
 * siempre queden vacios — "sin límite" es el caso mas comun, ver
 * `PromotionsTable.tsx`). Ahora vive detras de un interruptor
 * ("Limitar por fecha u horario"): apagado por defecto en creacion,
 * los campos ni se muestran.
 *
 * Al APAGAR el interruptor se limpian explicitamente los 5 campos
 * (`setValue` con `shouldValidate: false` — no se dispara una validacion
 * de por medio, solo se resetea el dato) para que "interruptor apagado"
 * sea exactamente equivalente a "nunca se toco esta seccion", igual
 * comportamiento que el formulario ya tenia cuando estos campos
 * quedaban vacios. Al prenderlo no se inventa ningun valor — los inputs
 * quedan vacios, listos para completarse.
 *
 * Mismos campos, mismos `register`, mismas reglas que antes — el cambio
 * es unicamente de visibilidad.
 */
export function VigenciaSection({
  register,
  errors,
  setValue,
  isSubmitting,
  initialEnabled,
}: VigenciaSectionProps) {
  const [enabled, setEnabled] = useState(initialEnabled)

  const handleToggle = (checked: boolean) => {
    setEnabled(checked)

    if (!checked) {
      setValue('startDate', undefined, { shouldValidate: false })
      setValue('endDate', undefined, { shouldValidate: false })
      setValue('startTime', undefined, { shouldValidate: false })
      setValue('endTime', undefined, { shouldValidate: false })
      setValue('daysOfWeek', [], { shouldValidate: false })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <input
          id="promotion-form-vigencia-toggle"
          type="checkbox"
          checked={enabled}
          disabled={isSubmitting}
          onChange={(event) => handleToggle(event.target.checked)}
          className={checkboxClassName}
        />
        <Label htmlFor="promotion-form-vigencia-toggle">Limitar por fecha u horario</Label>
      </div>

      {!enabled && (
        <p className="text-sm text-muted-foreground">
          Sin límite: esta promoción aplica en cualquier fecha, hora y día.
        </p>
      )}

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="promotion-form-startDate">Fecha de inicio (opcional)</Label>
              <Input
                id="promotion-form-startDate"
                type="date"
                disabled={isSubmitting}
                {...register('startDate', { setValueAs: emptyToUndefined })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="promotion-form-endDate">Fecha de fin (opcional)</Label>
              <Input
                id="promotion-form-endDate"
                type="date"
                disabled={isSubmitting}
                aria-invalid={!!errors.endDate}
                {...register('endDate', { setValueAs: emptyToUndefined })}
              />
              {errors.endDate && (
                <p className="text-sm text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="promotion-form-startTime">Hora de inicio (opcional)</Label>
              <Input
                id="promotion-form-startTime"
                type="time"
                disabled={isSubmitting}
                {...register('startTime', { setValueAs: emptyToUndefined })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="promotion-form-endTime">Hora de fin (opcional)</Label>
              <Input
                id="promotion-form-endTime"
                type="time"
                disabled={isSubmitting}
                aria-invalid={!!errors.endTime}
                {...register('endTime', { setValueAs: emptyToUndefined })}
              />
              {errors.endTime && (
                <p className="text-sm text-destructive">{errors.endTime.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Días de la semana (vacío = todos los días)</Label>
            <div className="flex flex-wrap gap-3">
              {DAY_OF_WEEK_OPTIONS.map((day) => (
                <div key={day.value} className="flex items-center gap-1.5">
                  <input
                    id={`promotion-form-day-${day.value}`}
                    type="checkbox"
                    value={day.value}
                    disabled={isSubmitting}
                    className={checkboxClassName}
                    {...register('daysOfWeek')}
                  />
                  <Label htmlFor={`promotion-form-day-${day.value}`} className="text-sm font-normal">
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
