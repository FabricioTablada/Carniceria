import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getQuantityStep, getUnitSuffix } from '@/utils/formatQuantity'
import { updateInventorySchema } from '../schemas/inventory.schema'
import type { Inventory, UpdateInventoryDto } from '../types/inventory.types'

/**
 * features/inventory/components/InventoryAdjustForm.tsx
 * -----------------------------------------------------------------------------
 * Formulario de ajuste de una fila de inventario EXISTENTE. No es un
 * formulario de creacion ni de edicion general: `sucursalId`/`productId`
 * (tambien presentes en `UpdateInventoryDto`) identifican QUE fila se
 * esta ajustando, no algo que tenga sentido editar desde acá — la fila
 * ya existe, ya tiene su producto y su sucursal fijados. Por eso este
 * formulario expone unicamente `quantity` y `reorderPoint`, que son los
 * dos campos que realmente representan un "ajuste" de negocio (y los
 * que, al cambiar `quantity`, generan un `InventoryMovement` del lado
 * del backend — hallazgo 2.2 de la auditoria).
 *
 * QA critico ("Unificacion de captura de cantidades por peso"): antes,
 * este era el UNICO formulario del ERP que no comunicaba la unidad de
 * captura en absoluto (`step="0.01"` fijo para ambas unidades, sin
 * sufijo, sin nombre de producto en pantalla) — a diferencia de Compras
 * (`PurchaseItemRow.tsx`) y Mermas (`InventoryWasteForm.tsx`), que ya
 * mostraban "kg" explicitamente. La unidad oficial del ERP para
 * productos por peso sigue siendo kilogramos con 3 decimales (sin
 * gramos, sin conversion, sin selector) — este cambio solo hace que el
 * formulario lo COMUNIQUE, reutilizando `getQuantityStep`/`getUnitSuffix`
 * (`utils/formatQuantity.ts`) en vez de duplicar la logica de unidad.
 *
 * Sprint UX/UI PIPASA V1: campos envueltos en `FormSection` (mismo
 * estandar visual del resto del ERP) en vez de un `<form>` plano — sin
 * cambiar ningun campo, regla de validacion ni el `resolver`.
 */

interface InventoryAdjustFormProps {
  /** Producto de la fila que se esta ajustando — unica fuente de verdad
   * de la unidad de captura (`unitOfMeasure`), mismo criterio que
   * `InventoryWasteForm.tsx`. */
  product: Inventory['product']
  /** Valores iniciales del formulario (la fila de inventario que se esta ajustando). */
  defaultValues?: Partial<UpdateInventoryDto>
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: UpdateInventoryDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
}

export function InventoryAdjustForm({
  product,
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: InventoryAdjustFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateInventoryDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<UpdateInventoryDto>` que expone
    // inventory.schema.ts (no se modifica ese archivo desde aqui). Mismo
    // cast usado en CategoryForm.tsx/TaxForm.tsx/SupplierForm.tsx/
    // PurchaseForm.tsx/EditPurchaseForm.tsx por el mismo motivo.
    resolver: zodResolver(updateInventorySchema as never) as unknown as Resolver<UpdateInventoryDto>,
    defaultValues,
  })

  const step = getQuantityStep(product.unitOfMeasure)
  const unitSuffix = getUnitSuffix(product.unitOfMeasure)

  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormSection
        icon={Scale}
        title="Cantidad y punto de reorden"
        description={`Unidad de captura: ${product.unitOfMeasure === 'KILOGRAM' ? 'kilogramos (kg)' : 'unidades'}.`}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inventory-adjust-quantity">Cantidad ({unitSuffix})</Label>
          <div className="flex items-center gap-2">
            <Input
              id="inventory-adjust-quantity"
              type="number"
              step={step}
              min={0}
              placeholder={product.unitOfMeasure === 'KILOGRAM' ? '0.000' : '0'}
              disabled={isSubmitting}
              aria-invalid={!!errors.quantity}
              className="max-w-40"
              {...register('quantity', { valueAsNumber: true })}
            />
            <span className="text-sm text-muted-foreground">{unitSuffix}</span>
          </div>
          {errors.quantity && (
            <p className="text-sm text-destructive">
              {errors.quantity.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inventory-adjust-reorderPoint">
            Punto de reorden ({unitSuffix})
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="inventory-adjust-reorderPoint"
              type="number"
              step={step}
              min={0}
              placeholder={product.unitOfMeasure === 'KILOGRAM' ? '0.000' : '0'}
              disabled={isSubmitting}
              aria-invalid={!!errors.reorderPoint}
              className="max-w-40"
              {...register('reorderPoint', { valueAsNumber: true })}
            />
            <span className="text-sm text-muted-foreground">{unitSuffix}</span>
          </div>
          {errors.reorderPoint && (
            <p className="text-sm text-destructive">
              {errors.reorderPoint.message}
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
