import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { emptyToUndefinedNumber } from '../utils/emptyValue'
import { PromotionSupplierField } from './PromotionSupplierField'
import type { CreatePromotionDto } from '../types/promotion.types'

const FUNDING_TYPE_OPTIONS: {
  value: 'NONE' | 'SUPPLIER_SUBSIDY_PER_UNIT' | 'SUPPLIER_SUBSIDY_PERCENTAGE'
  label: string
}[] = [
  { value: 'NONE', label: 'Sin financiamiento externo' },
  { value: 'SUPPLIER_SUBSIDY_PER_UNIT', label: 'Subsidio del proveedor por unidad' },
  { value: 'SUPPLIER_SUBSIDY_PERCENTAGE', label: 'Subsidio del proveedor por porcentaje' },
]

interface PromotionFundingFieldsProps {
  control: Control<CreatePromotionDto>
  register: UseFormRegister<CreatePromotionDto>
  setValue: UseFormSetValue<CreatePromotionDto>
  errors: FieldErrors<CreatePromotionDto>
  isSubmitting: boolean
  /** QA.9 (Promociones): proveedor ya conocido de la promoción que se
   * esta editando — ver doc en `PromotionSupplierField.tsx`. `undefined`
   * en creación (no hay promoción previa). */
  initialSupplier?: { id: string; name: string } | null
}

/**
 * features/promotions/components/PromotionFundingFields.tsx
 * -----------------------------------------------------------------------------
 * Bloque 1 (rediseño de Promociones) — Paso "Financiamiento", CONDICIONAL:
 * `PromotionForm.tsx` solo lo muestra en el riel cuando `commercialOrigin`
 * (Paso "Origen") es `SUPPLIER_MANDATED`. Extraído de
 * `AdvancedRulesSection.tsx`: mismos 3 campos (`supplierId`/`fundingType`/
 * `supplierSubsidyValue`), mismo `PromotionSupplierField`, misma limpieza
 * de `supplierSubsidyValue` al volver a "Sin financiamiento" — ninguna
 * regla nueva.
 */
export function PromotionFundingFields({
  control,
  register,
  setValue,
  errors,
  isSubmitting,
  initialSupplier = null,
}: PromotionFundingFieldsProps) {
  const fundingType = useWatch({ control, name: 'fundingType' }) ?? 'NONE'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="promotion-form-supplierId">
          Proveedor
          <RequiredMark />
        </Label>
        <Controller
          control={control}
          name="supplierId"
          render={({ field }) => (
            <PromotionSupplierField
              id="promotion-form-supplierId"
              value={field.value ?? null}
              onChange={field.onChange}
              disabled={isSubmitting}
              error={errors.supplierId?.message}
              initialSupplier={initialSupplier}
            />
          )}
        />
        {errors.supplierId && <p className="text-sm text-destructive">{errors.supplierId.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="promotion-form-fundingType">Financiamiento</Label>
        <Controller
          control={control}
          name="fundingType"
          render={({ field }) => (
            <Select
              value={field.value ?? 'NONE'}
              onValueChange={(value: unknown) => {
                field.onChange(value as string)
                // Al volver a "Sin financiamiento" se limpia el valor del
                // subsidio — mismo criterio que `VigenciaSection.tsx` al
                // apagar su interruptor: el campo oculto queda vacío, no
                // con un número viejo que ya no se muestra.
                if (value === 'NONE') {
                  setValue('supplierSubsidyValue', undefined, { shouldValidate: false })
                }
              }}
            >
              <SelectTrigger id="promotion-form-fundingType" disabled={isSubmitting}>
                <SelectValue>
                  {(value: unknown) =>
                    FUNDING_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
                    'Sin financiamiento externo'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FUNDING_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {fundingType !== 'NONE' && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="promotion-form-supplierSubsidyValue">
            {fundingType === 'SUPPLIER_SUBSIDY_PERCENTAGE'
              ? 'Porcentaje de subsidio del proveedor (%)'
              : 'Monto de subsidio del proveedor por unidad (₡)'}
            <RequiredMark />
          </Label>
          <Input
            id="promotion-form-supplierSubsidyValue"
            type="number"
            min={0}
            step="0.01"
            disabled={isSubmitting}
            aria-invalid={!!errors.supplierSubsidyValue}
            {...register('supplierSubsidyValue', { setValueAs: emptyToUndefinedNumber })}
          />
          {errors.supplierSubsidyValue && (
            <p className="text-sm text-destructive">{errors.supplierSubsidyValue.message}</p>
          )}
        </div>
      )}
    </div>
  )
}
