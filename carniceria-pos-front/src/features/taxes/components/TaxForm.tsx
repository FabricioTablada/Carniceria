import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { Switch } from '@/components/ui/switch'
import { createTaxSchema, updateTaxSchema } from '../schemas/tax.schema'
import { TaxStatusBadge } from './TaxStatusBadge'
import type { CreateTaxDto } from '../types/tax.types'

interface TaxFormProps {
  /** Determina que schema de validacion se usa y que campos se muestran. */
  mode: 'create' | 'update'
  /** Valores iniciales del formulario (por ejemplo, al editar un impuesto). */
  defaultValues?: Partial<CreateTaxDto>
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: CreateTaxDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
  /** Solo en modo edicion — `UpdateTaxDto` no incluye `active` (el
   * backend lo maneja aparte, ver `tax.schema.ts`), asi que el
   * formulario no lo observa por `watch()` en este modo; se muestra el
   * valor ya conocido del impuesto. Mismo criterio que
   * `ProductForm.tsx`/`CategoryForm.tsx`. */
  initialActive?: boolean
}

/**
 * features/taxes/components/TaxForm.tsx
 * -----------------------------------------------------------------------------
 * "Canvas Workspace" (aprobado, mismo lenguaje visual que
 * `ProductForm.tsx`/`CategoryForm.tsx`): una única superficie
 * (`rounded-2xl border bg-card shadow-sm`), sin tarjeta lateral — el
 * panel de Resumen (`TaxFormSummary.tsx`) se ELIMINÓ, cada dato que
 * mostraba encontró un lugar dentro de la misma superficie:
 *  - Banda de identidad (arriba): ícono neutro de marca (`Percent`, sin
 *    color por id — un impuesto no se "agrupa" visualmente como una
 *    categoría) + Nombre + Código + Tasa + Estado (Switch en creación,
 *    badge de solo lectura en edición).
 *  - Cuerpo: único switch "Impuesto por defecto" — 4 campos no
 *    justifican una grilla de columnas (mismo criterio ya documentado en
 *    `CategoryForm.tsx`: forzarla sería relleno artificial).
 *
 * Tasa como protagonista (aprobado, "mismo tratamiento que 'Precio de
 * venta' en Productos, sin volverla una tarjeta grande"): caja con tinte
 * de marca (`bg-brand/5 border-brand/15`) y tipografía mas grande/pesada
 * (`text-xl font-bold text-brand`) que el campo "Código" de al lado —
 * mismo input `type="number"`, misma validación, solo mas peso visual,
 * proporcional al tamaño de la banda de identidad (no una tarjeta grande
 * como la de Productos, que tiene mas espacio disponible).
 *
 * "Impuesto activo" reutiliza el mismo `Switch` de `ProductForm.tsx`/
 * `CategoryForm.tsx` (antes: checkbox nativo dentro de una `FormSection`
 * propia solo para eso) — ya no vive en una tarjeta independiente.
 */
export function TaxForm({
  mode,
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
  initialActive,
}: TaxFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTaxDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<CreateTaxDto | UpdateTaxDto>` que exponen los
    // schemas de tax.schema.ts (no se modifica ese archivo desde aqui).
    // Mismo cast usado en ProductForm.tsx/CategoryForm.tsx.
    resolver: zodResolver(
      (mode === 'create' ? createTaxSchema : updateTaxSchema) as never,
    ) as unknown as Resolver<CreateTaxDto>,
    defaultValues,
  })

  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="@container/tax-form flex flex-col">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        {/* Banda de identidad — ver doc del componente arriba. */}
        <div className="flex flex-col gap-4 border-b border-border p-5 @lg/tax-form:flex-row @lg/tax-form:items-center">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Percent className="size-6" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label htmlFor="tax-form-name">
              Nombre
              <RequiredMark />
            </Label>
            <Input
              id="tax-form-name"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              className="h-10 text-lg font-semibold"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1 @lg/tax-form:w-32">
            <Label htmlFor="tax-form-code">
              Código
              <RequiredMark />
            </Label>
            <Input
              id="tax-form-code"
              disabled={isSubmitting}
              aria-invalid={!!errors.code}
              className="font-mono"
              {...register('code')}
            />
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1 @lg/tax-form:w-28">
            <Label htmlFor="tax-form-rate" className="text-brand/70">
              Tasa (%)
              <RequiredMark />
            </Label>
            <Input
              id="tax-form-rate"
              type="number"
              step="0.01"
              disabled={isSubmitting}
              aria-invalid={!!errors.rate}
              className="h-10 border-brand/20 bg-brand/5 text-xl font-bold text-brand tabular-nums"
              {...register('rate', { valueAsNumber: true })}
            />
            {errors.rate && (
              <p className="text-sm text-destructive">{errors.rate.message}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2.5 self-start rounded-lg border border-input bg-card px-3.5 py-2.5 @lg/tax-form:self-auto">
            {mode === 'create' ? (
              <>
                <Label htmlFor="tax-form-active" className="text-sm">
                  Impuesto activo
                </Label>
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <Switch
                      id="tax-form-active"
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
                <TaxStatusBadge active={initialActive ?? false} />
              </>
            )}
          </div>
        </div>

        {/* Cuerpo — único switch propio de este módulo. */}
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-3.5 py-3">
            <Label htmlFor="tax-form-isDefault">Impuesto por defecto</Label>
            <Controller
              control={control}
              name="isDefault"
              render={({ field }) => (
                <Switch
                  id="tax-form-isDefault"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se preselecciona automáticamente al crear un producto nuevo.
          </p>
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
