import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { createCustomerSchema, updateCustomerSchema } from '../schemas/customer.schema'
import { CustomerStatusBadge } from './CustomerStatusBadge'
import type { CreateCustomerDto, CustomerIdentificationType } from '../types/customer.types'

interface CustomerFormProps {
  /** Determina que schema de validacion se usa y que campos se muestran. */
  mode: 'create' | 'update'
  /** Valores iniciales del formulario (por ejemplo, al editar un cliente). */
  defaultValues?: Partial<CreateCustomerDto>
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: CreateCustomerDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
  /** Solo en modo edicion — `UpdateCustomerDto` no incluye `active` (el
   * backend lo maneja aparte), mismo criterio que `SupplierForm.tsx`. */
  initialActive?: boolean
}

/** Catalogo de tipos de identificacion soportados (mismo catalogo real de
 * Alegra Costa Rica, confirmado en el Bloque 7.13). */
const IDENTIFICATION_TYPE_OPTIONS: { value: CustomerIdentificationType; label: string }[] = [
  { value: 'CF', label: 'Cédula física (CF)' },
  { value: 'CJ', label: 'Cédula jurídica (CJ)' },
  { value: 'DIMEX', label: 'DIMEX' },
  { value: 'NITE', label: 'NITE' },
  { value: 'PE', label: 'Pasaporte (PE)' },
]

const IDENTIFICATION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  IDENTIFICATION_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

/**
 * features/customers/components/CustomerForm.tsx
 * -----------------------------------------------------------------------------
 * Bloque 8.2 — mismo "Canvas Workspace" que `SupplierForm.tsx`: una única
 * superficie, sin panel lateral.
 *  - Banda de identidad: ícono neutro (`UserRound`) + Nombre + Tipo de
 *    identificación (Select) + Número de identificación + Estado.
 *  - Cuerpo: único bloque "Contacto" (Correo + Teléfono, Dirección) — mismo
 *    criterio que `SupplierForm.tsx`.
 */
export function CustomerForm({
  mode,
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
  initialActive,
}: CustomerFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCustomerDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<CreateCustomerDto | UpdateCustomerDto>` que
    // exponen los schemas de customer.schema.ts. Mismo cast usado en
    // `SupplierForm.tsx`/`ProductForm.tsx` por el mismo motivo.
    resolver: zodResolver(
      (mode === 'create' ? createCustomerSchema : updateCustomerSchema) as never,
    ) as unknown as Resolver<CreateCustomerDto>,
    defaultValues,
  })

  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="@container/customer-form flex flex-col">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        {/* Banda de identidad — ver doc del componente arriba. */}
        <div className="flex flex-col gap-4 border-b border-border p-5 @lg/customer-form:flex-row @lg/customer-form:items-center">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <UserRound className="size-6" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="customer-form-name">
              Nombre
              <RequiredMark />
            </Label>
            <Input
              id="customer-form-name"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              className="h-10 text-lg font-semibold"
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex shrink-0 flex-col gap-1 @lg/customer-form:w-44">
            <Label htmlFor="customer-form-identificationType">
              Tipo de identificación
              <RequiredMark />
            </Label>
            <Controller
              control={control}
              name="identificationType"
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(value: unknown) => field.onChange(value as string)}
                >
                  <SelectTrigger
                    id="customer-form-identificationType"
                    disabled={isSubmitting}
                    aria-invalid={!!errors.identificationType}
                  >
                    <SelectValue>
                      {(value: unknown) => IDENTIFICATION_TYPE_LABELS[value as string] ?? 'Seleccionar'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {IDENTIFICATION_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.identificationType && (
              <p className="text-sm text-destructive">{errors.identificationType.message}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1 @lg/customer-form:w-48">
            <Label htmlFor="customer-form-identificationNumber">
              Número de identificación
              <RequiredMark />
            </Label>
            <Input
              id="customer-form-identificationNumber"
              disabled={isSubmitting}
              aria-invalid={!!errors.identificationNumber}
              className="font-mono"
              {...register('identificationNumber')}
            />
            {errors.identificationNumber && (
              <p className="text-sm text-destructive">{errors.identificationNumber.message}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2.5 self-start rounded-lg border border-input bg-card px-3.5 py-2.5 @lg/customer-form:self-auto">
            {mode === 'create' ? (
              <>
                <Label htmlFor="customer-form-active" className="text-sm">
                  Cliente activo
                </Label>
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <Switch
                      id="customer-form-active"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Estado</span>
                <CustomerStatusBadge active={initialActive ?? false} />
              </>
            )}
          </div>
        </div>

        {/* Cuerpo — bloque de Contacto, columna única (ver doc). */}
        <div className="flex flex-col gap-3.5 p-5">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Contacto
          </h3>

          <div className="grid grid-cols-1 gap-3.5 @lg/customer-form:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="customer-form-email">Correo electrónico</Label>
              <Input
                id="customer-form-email"
                type="email"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="customer-form-phone">Teléfono</Label>
              <Input
                id="customer-form-phone"
                disabled={isSubmitting}
                aria-invalid={!!errors.phone}
                {...register('phone')}
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 @lg/customer-form:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="customer-form-address">Dirección</Label>
              <Input
                id="customer-form-address"
                disabled={isSubmitting}
                aria-invalid={!!errors.address}
                {...register('address')}
              />
              {errors.address && (
                <p className="text-sm text-destructive">{errors.address.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border px-5 py-3">
          {onCancel && (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </form>
  )
}
