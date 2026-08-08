import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { Switch } from '@/components/ui/switch'
import {
  createSupplierSchema,
  updateSupplierSchema,
} from '../schemas/supplier.schema'
import { SupplierStatusBadge } from './SupplierStatusBadge'
import type { CreateSupplierDto } from '../types/supplier.types'

interface SupplierFormProps {
  /** Determina que schema de validacion se usa y que campos se muestran. */
  mode: 'create' | 'update'
  /** Valores iniciales del formulario (por ejemplo, al editar un proveedor). */
  defaultValues?: Partial<CreateSupplierDto>
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: CreateSupplierDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
  /** Solo en modo edicion — `UpdateSupplierDto` no incluye `active` (el
   * backend lo maneja aparte), asi que el formulario no lo observa por
   * `watch()` en este modo; se muestra el valor ya conocido del
   * proveedor. Mismo criterio que `ProductForm.tsx`/`CategoryForm.tsx`/
   * `TaxForm.tsx`. */
  initialActive?: boolean
}

/**
 * features/suppliers/components/SupplierForm.tsx
 * -----------------------------------------------------------------------------
 * "Canvas Workspace" (aprobado, mismo lenguaje visual que
 * `ProductForm.tsx`/`CategoryForm.tsx`/`TaxForm.tsx`): una única
 * superficie (`rounded-2xl border bg-card shadow-sm`), sin panel lateral
 * — `SupplierFormSummary.tsx` se ELIMINÓ, cada dato que mostraba
 * encontró un lugar dentro de la misma superficie:
 *  - Banda de identidad (arriba): ícono neutro de marca (`Building2`,
 *    sin color por id — igual criterio que Impuestos) + Nombre + Cédula
 *    jurídica + Estado (Switch en creación, badge de solo lectura en
 *    edición).
 *  - Cuerpo: único bloque "Contacto" (Nombre de contacto + Teléfono en
 *    una fila, Correo + Dirección en otra) — pocos campos no justifican
 *    una grilla forzada de columnas (mismo criterio ya documentado en
 *    `CategoryForm.tsx`/`TaxForm.tsx`).
 *
 * Mismos campos, mismo `register`, mismo `createSupplierSchema`/
 * `updateSupplierSchema` — el cambio es exclusivamente de organización
 * visual, sin lógica nueva.
 */
export function SupplierForm({
  mode,
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
  initialActive,
}: SupplierFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSupplierDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<CreateSupplierDto | UpdateSupplierDto>` que
    // exponen los schemas de supplier.schema.ts (no se modifica ese
    // archivo desde aqui). Mismo cast usado en TaxForm.tsx/
    // CategoryForm.tsx/ProductForm.tsx/UserForm.tsx por el mismo motivo.
    resolver: zodResolver(
      (mode === 'create' ? createSupplierSchema : updateSupplierSchema) as never,
    ) as unknown as Resolver<CreateSupplierDto>,
    defaultValues,
  })

  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="@container/supplier-form flex flex-col">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        {/* Banda de identidad — ver doc del componente arriba. */}
        <div className="flex flex-col gap-4 border-b border-border p-5 @lg/supplier-form:flex-row @lg/supplier-form:items-center">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Building2 className="size-6" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="supplier-form-name">
              Nombre
              <RequiredMark />
            </Label>
            <Input
              id="supplier-form-name"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              className="h-10 text-lg font-semibold"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1 @lg/supplier-form:w-48">
            <Label htmlFor="supplier-form-legalId">Cédula jurídica</Label>
            <Input
              id="supplier-form-legalId"
              disabled={isSubmitting}
              aria-invalid={!!errors.legalId}
              className="font-mono"
              {...register('legalId')}
            />
            {errors.legalId && (
              <p className="text-sm text-destructive">{errors.legalId.message}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2.5 self-start rounded-lg border border-input bg-card px-3.5 py-2.5 @lg/supplier-form:self-auto">
            {mode === 'create' ? (
              <>
                <Label htmlFor="supplier-form-active" className="text-sm">
                  Proveedor activo
                </Label>
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <Switch
                      id="supplier-form-active"
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
                <SupplierStatusBadge active={initialActive ?? false} />
              </>
            )}
          </div>
        </div>

        {/* Cuerpo — bloque de Contacto, columna única (ver doc). */}
        <div className="flex flex-col gap-3.5 p-5">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Contacto
          </h3>

          <div className="grid grid-cols-1 gap-3.5 @lg/supplier-form:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="supplier-form-contactName">Nombre de contacto</Label>
              <Input
                id="supplier-form-contactName"
                disabled={isSubmitting}
                aria-invalid={!!errors.contactName}
                {...register('contactName')}
              />
              {errors.contactName && (
                <p className="text-sm text-destructive">
                  {errors.contactName.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="supplier-form-phone">Teléfono</Label>
              <Input
                id="supplier-form-phone"
                disabled={isSubmitting}
                aria-invalid={!!errors.phone}
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 @lg/supplier-form:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="supplier-form-email">Correo electrónico</Label>
              <Input
                id="supplier-form-email"
                type="email"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="supplier-form-address">Dirección</Label>
              <Input
                id="supplier-form-address"
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
