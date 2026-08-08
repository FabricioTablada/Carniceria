import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { updatePurchaseSchema } from '../schemas/purchase.schema'
import { PurchaseHeaderFields } from './PurchaseHeaderFields'
import type { UpdatePurchaseDto } from '../types/purchase.types'

interface EditPurchaseFormProps {
  /** Valores iniciales del formulario (la compra que se esta editando). */
  defaultValues?: Partial<UpdatePurchaseDto>
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: UpdatePurchaseDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
  /** QA.7 (Proveedores): proveedor ya conocido de la compra que se esta
   * editando — ver doc en `PurchaseSupplierField.tsx`. */
  initialSupplier?: { id: string; name: string } | null
}

export function EditPurchaseForm({
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
  initialSupplier = null,
}: EditPurchaseFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePurchaseDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<UpdatePurchaseDto>` que expone
    // purchase.schema.ts (no se modifica ese archivo desde aqui). Mismo
    // cast usado en CategoryForm.tsx/TaxForm.tsx/SupplierForm.tsx/
    // PurchaseForm.tsx por el mismo motivo.
    resolver: zodResolver(updatePurchaseSchema as never) as unknown as Resolver<UpdatePurchaseDto>,
    defaultValues,
  })

  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
        <PurchaseHeaderFields
          control={control}
          register={register}
          errors={errors}
          isSubmitting={isSubmitting}
          initialSupplier={initialSupplier}
        />

        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border px-5 py-3">
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
      </div>
    </form>
  )
}