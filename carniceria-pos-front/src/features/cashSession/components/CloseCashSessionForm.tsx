import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { closeCashSessionSchema } from '../schema/cashSession.schema'
import type { CloseCashSessionDto } from '../types/cashSession.types'

interface CloseCashSessionFormProps {
  /** Deshabilita el formulario mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** Se dispara con los valores validados al enviar el formulario. */
  onSubmit: (values: CloseCashSessionDto) => void
  /** Se dispara al presionar "Cancelar" (opcional). */
  onCancel?: () => void
  /** Rediseño de Caja: notifica CADA cambio del campo "Monto contado" (no
   * solo el envío final) — permite que `CashArqueoPanel.tsx` muestre la
   * diferencia en tiempo real mientras el usuario escribe, sin que este
   * formulario deje de ser la única fuente de verdad del valor real que
   * se envía. Aditivo: por defecto `undefined`, sin cambiar nada para
   * quien no lo pase. */
  onClosingAmountChange?: (value: number) => void
}

export function CloseCashSessionForm({
  isSubmitting = false,
  onSubmit,
  onCancel,
  onClosingAmountChange,
}: CloseCashSessionFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CloseCashSessionDto>({
    // `zodResolver` no puede resolver sus overloads contra el tipo
    // abstracto `z.ZodType<CloseCashSessionDto>` que expone
    // cashSession.schema.ts (no se modifica ese archivo desde aqui).
    // Mismo cast usado en TaxForm.tsx/SupplierForm.tsx/PurchaseForm.tsx/
    // InventoryAdjustForm.tsx por el mismo motivo.
    resolver: zodResolver(closeCashSessionSchema as never) as unknown as Resolver<CloseCashSessionDto>,
  })

  const submit = handleSubmit((values) => onSubmit(values))

  const closingAmountField = register('closingAmount', { valueAsNumber: true })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="close-cash-session-closingAmount">
          Monto contado
        </Label>
        <Input
          id="close-cash-session-closingAmount"
          type="number"
          step="0.01"
          disabled={isSubmitting}
          aria-invalid={!!errors.closingAmount}
          {...closingAmountField}
          onChange={(event) => {
            closingAmountField.onChange(event)
            onClosingAmountChange?.(event.target.valueAsNumber)
          }}
        />
        {errors.closingAmount && (
          <p className="text-sm text-destructive">
            {errors.closingAmount.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="close-cash-session-notes">Notas</Label>
        <Input
          id="close-cash-session-notes"
          disabled={isSubmitting}
          aria-invalid={!!errors.notes}
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

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
          {isSubmitting ? 'Cerrando caja...' : 'Cerrar caja'}
        </Button>
      </div>
    </form>
  )
}