import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getQuantityStep, getUnitSuffix } from '@/utils/formatQuantity'
import { updateBatchSchema } from '../schemas/batch.schema'
import type { Batch, BatchStatus, UpdateBatchDto } from '../types/batch.types'

const STATUS_LABELS: Record<BatchStatus, string> = {
  ACTIVE: 'Activo',
  DEPLETED: 'Agotado',
  EXPIRED: 'Vencido',
  BLOCKED: 'Bloqueado',
}

/**
 * features/batches/components/BatchAdjustForm.tsx
 * -----------------------------------------------------------------------------
 * Formulario de ajuste (`availableQuantity`) y bloqueo/cierre (`status`) de
 * un lote EXISTENTE (`PATCH /inventory/batches/:id`) — mismo criterio que
 * `InventoryAdjustForm.tsx`: no es un formulario de creacion ni de edicion
 * general, los campos de origen/snapshot del lote (producto, sucursal,
 * proveedor, fechas, costo) no son editables desde aca, solo se muestran
 * como contexto de solo lectura.
 *
 * Unidad de captura de `availableQuantity`: la del producto asociado
 * (`getQuantityStep`/`getUnitSuffix`, `utils/formatQuantity.ts`), mismo
 * criterio que `InventoryAdjustForm.tsx`.
 */

interface BatchAdjustFormProps {
  batch: Batch
  isSubmitting?: boolean
  onSubmit: (values: UpdateBatchDto) => void
  onCancel?: () => void
}

export function BatchAdjustForm({
  batch,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: BatchAdjustFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<UpdateBatchDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<UpdateBatchDto>` que expone `batch.schema.ts` —
    // mismo cast usado en `InventoryAdjustForm.tsx`/`TaxForm.tsx`/etc. por
    // el mismo motivo.
    resolver: zodResolver(
      updateBatchSchema(batch.initialQuantity) as never,
    ) as unknown as Resolver<UpdateBatchDto>,
    defaultValues: {
      availableQuantity: batch.availableQuantity,
      status: batch.status,
      notes: batch.notes ?? '',
    },
  })

  const step = getQuantityStep(batch.product.unitOfMeasure)
  const unitSuffix = getUnitSuffix(batch.product.unitOfMeasure)

  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormSection
        icon={Scale}
        title="Cantidad disponible"
        description={`Unidad de captura: ${batch.product.unitOfMeasure === 'KILOGRAM' ? 'kilogramos (kg)' : 'unidades'}. No puede superar la cantidad inicial del lote (${batch.initialQuantity} ${unitSuffix}).`}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="batch-adjust-availableQuantity">
            Cantidad disponible ({unitSuffix})
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="batch-adjust-availableQuantity"
              type="number"
              step={step}
              min={0}
              max={batch.initialQuantity}
              disabled={isSubmitting}
              aria-invalid={!!errors.availableQuantity}
              className="max-w-40"
              {...register('availableQuantity', { valueAsNumber: true })}
            />
            <span className="text-sm text-muted-foreground">{unitSuffix}</span>
          </div>
          {errors.availableQuantity && (
            <p className="text-sm text-destructive">{errors.availableQuantity.message}</p>
          )}
        </div>
      </FormSection>

      <FormSection
        icon={Lock}
        title="Estado del lote"
        description="Bloquear un lote lo excluye del consumo FEFO de Ventas sin necesidad de vaciar su cantidad."
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="batch-adjust-status">Estado</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value ?? batch.status}
                onValueChange={(value: unknown) => field.onChange(value as BatchStatus)}
              >
                <SelectTrigger id="batch-adjust-status" disabled={isSubmitting}>
                  <SelectValue>
                    {(value: unknown) => STATUS_LABELS[value as BatchStatus] ?? ''}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                  <SelectItem value="DEPLETED">Agotado</SelectItem>
                  <SelectItem value="EXPIRED">Vencido</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="batch-adjust-notes">Observaciones</Label>
          <textarea
            id="batch-adjust-notes"
            rows={3}
            disabled={isSubmitting}
            aria-invalid={!!errors.notes}
            placeholder="Motivo del ajuste o bloqueo (opcional)"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            {...register('notes')}
          />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
        </div>
      </FormSection>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
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
