import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VALUE_TYPE_LABELS } from '../constants/configuration.constants'
import {
  createConfigurationSchema,
  updateConfigurationSchema,
} from '../schemas/configuration.schema'
import type { ConfigurationValueType, CreateConfigurationDto } from '../types/configuration.types'

/**
 * features/settings/components/ConfigurationForm.tsx
 * -----------------------------------------------------------------------------
 * Mismo patron que TaxForm.tsx/CategoryForm.tsx/SupplierForm.tsx: un
 * unico componente con prop `mode`, `useForm<CreateConfigurationDto>()`
 * fijo en los dos modos (no genérico), y el schema de Zod se elige
 * segun el modo.
 *
 * Sin campo `sucursalId`: el backend ya no lo acepta del cliente (lo
 * resuelve desde `req.user.sucursalId`, mismo patron ya aplicado en
 * Purchases) — corregido en `configuration/validation.ts` y
 * `configuration/controller.ts` del backend. `configuration.types.ts`/
 * `configuration.schema.ts` (frontend) ya quedaron alineados con ese
 * contrato (`CreateConfigurationDto`/`createConfigurationSchema` sin
 * `sucursalId`); este formulario los consume tal cual, sin ningun
 * campo ni logica de sucursal.
 *
 * Estandar visual de formularios del sistema (ver `ProductForm.tsx`): una
 * sola `FormSection` ("Información general") — 4 campos simples no
 * ameritan varias tarjetas.
 */

interface ConfigurationFormProps {
  mode: 'create' | 'update'
  defaultValues?: Partial<CreateConfigurationDto>
  isSubmitting?: boolean
  onSubmit: (values: CreateConfigurationDto) => void
  onCancel?: () => void
}

const NO_TYPE_VALUE = '__no_type__'

export function ConfigurationForm({
  mode,
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: ConfigurationFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateConfigurationDto>({
    resolver: zodResolver(
      (mode === 'create'
        ? createConfigurationSchema
        : updateConfigurationSchema) as never,
    ) as unknown as Resolver<CreateConfigurationDto>,
    defaultValues,
  })

  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormSection icon={Settings2} title="Información general">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="configuration-form-key">
              Clave
              <RequiredMark />
            </Label>
            <Input
              id="configuration-form-key"
              disabled={isSubmitting}
              aria-invalid={!!errors.key}
              {...register('key')}
            />
            {errors.key && (
              <p className="text-sm text-destructive">{errors.key.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="configuration-form-value">
              Valor
              <RequiredMark />
            </Label>
            <Input
              id="configuration-form-value"
              disabled={isSubmitting}
              aria-invalid={!!errors.value}
              {...register('value')}
            />
            {errors.value && (
              <p className="text-sm text-destructive">{errors.value.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="configuration-form-type">Tipo</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                value={field.value ?? NO_TYPE_VALUE}
                onValueChange={(value: unknown) => {
                  const type = value as string
                  field.onChange(type === NO_TYPE_VALUE ? undefined : type)
                }}
              >
                <SelectTrigger
                  id="configuration-form-type"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.type}
                >
                  <SelectValue>
                    {(value: unknown) => {
                      const type = value as string
                      if (type === NO_TYPE_VALUE) return 'Por defecto'
                      return (
                        VALUE_TYPE_LABELS[type as ConfigurationValueType] ??
                        type
                      )
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TYPE_VALUE}>Por defecto</SelectItem>
                  <SelectItem value="string">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="boolean">Booleano</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="configuration-form-description">Descripción</Label>
          <Input
            id="configuration-form-description"
            disabled={isSubmitting}
            aria-invalid={!!errors.description}
            {...register('description')}
          />
          {errors.description && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
