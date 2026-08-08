import { Controller, type Control } from 'react-hook-form'
import { Handshake, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CreatePromotionDto } from '../types/promotion.types'

interface PromotionOriginFieldsProps {
  control: Control<CreatePromotionDto>
  isSubmitting: boolean
}

const ORIGIN_OPTIONS: {
  value: 'INTERNAL' | 'SUPPLIER_MANDATED'
  label: string
  hint: string
  icon: typeof Store
}[] = [
  {
    value: 'INTERNAL',
    label: 'Propia del negocio',
    hint: 'Es una decisión interna de precios o descuentos.',
    icon: Store,
  },
  {
    value: 'SUPPLIER_MANDATED',
    label: 'Acuerdo con proveedor',
    hint: 'Responde a una condición o campaña impuesta por un proveedor.',
    icon: Handshake,
  },
]

/**
 * features/promotions/components/PromotionOriginFields.tsx
 * -----------------------------------------------------------------------------
 * Bloque 1 (rediseño de Promociones) — Paso "Origen", el primero del
 * riel. Extraído de `AdvancedRulesSection.tsx` (donde `commercialOrigin`
 * vivía como un `<Select>` dentro de "Opciones avanzadas", casi
 * escondido) — mismo campo, misma regla de negocio (ninguna nueva), ahora
 * la primera pregunta del recorrido porque es la que decide si el paso
 * "Financiamiento" existe más adelante (`PromotionForm.tsx` calcula esa
 * visibilidad observando este mismo campo).
 *
 * Cambia únicamente la PRESENTACIÓN: de un `<Select>` con 2 opciones de
 * texto a 2 tarjetas seleccionables — mismo valor, mismo `Controller`.
 */
export function PromotionOriginFields({ control, isSubmitting }: PromotionOriginFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <Controller
        control={control}
        name="commercialOrigin"
        render={({ field }) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ORIGIN_OPTIONS.map((option) => {
              const Icon = option.icon
              const selected = (field.value ?? 'INTERNAL') === option.value

              return (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer flex-col gap-2 rounded-xl border p-5 transition-colors duration-150',
                    selected
                      ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                      : 'border-input hover:bg-muted/50',
                  )}
                >
                  <input
                    type="radio"
                    name="promotion-origin"
                    value={option.value}
                    checked={selected}
                    disabled={isSubmitting}
                    onChange={() => field.onChange(option.value)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg',
                      selected ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4.5" />
                  </div>
                  <span className={cn('text-sm font-semibold', selected && 'text-brand')}>
                    {option.label}
                  </span>
                  <p className="text-xs text-muted-foreground">{option.hint}</p>
                </label>
              )
            })}
          </div>
        )}
      />
    </div>
  )
}
