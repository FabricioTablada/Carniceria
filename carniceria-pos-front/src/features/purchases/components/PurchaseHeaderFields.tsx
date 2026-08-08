import { Controller, useWatch } from 'react-hook-form'
import type {
  Control,
  FieldErrors,
  FieldValues,
  Path,
  UseFormRegister,
} from 'react-hook-form'
import { Calendar, Truck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { PurchaseStatusTrack } from './PurchaseStatusTrack'
import { PurchaseSupplierField } from './PurchaseSupplierField'
import type { PurchaseStatus } from '../types/purchase.types'

/**
 * features/purchases/components/PurchaseHeaderFields.tsx
 * -----------------------------------------------------------------------------
 * Los 5 campos de encabezado compartidos entre `PurchaseForm.tsx`
 * (creacion, `CreatePurchaseDto`) y `EditPurchaseForm.tsx` (edicion,
 * `UpdatePurchaseDto`). Ambos DTOs tienen estos mismos 5 campos, pero no
 * exactamente el mismo tipo (`supplierId` es requerido en creacion,
 * opcional en edicion) — por eso este componente es generico sobre
 * `TFieldValues`, restringido a `PurchaseHeaderFieldValues` (con los 5
 * campos declarados opcionales ahi, para que tanto la version requerida
 * de creacion como la opcional de edicion lo satisfagan).
 *
 * No incluye `items`: eso es exclusivo de `PurchaseForm`/
 * `PurchaseItemsField` (creacion), `UpdatePurchaseDto` no lo tiene.
 * No incluye `sucursalId`/`userId`: ninguno de los dos formularios los
 * expone (hallazgo documentado, sin fuente de datos en el frontend).
 *
 * Rediseño de Compras ("documento vivo"): 3 campos en una fila (Proveedor/
 * Documento/Fecha, antes 4 con Estado incluido) + Notas debajo. "Estado"
 * sale de esta grilla — pasa a ser `PurchaseStatusTrack`, una progresión
 * visual de solo lectura, nunca un `<Select>`. El asterisco rojo en
 * Proveedor/Fecha es solo visual — ambos ya eran requeridos en
 * `purchase.schema.ts`.
 *
 * Canvas Workspace (aprobado): deja de ser una `FormSection` (tarjeta con
 * borde propia) y pasa a ser la banda de identidad superior de la única
 * superficie de `PurchaseForm.tsx`/`EditPurchaseForm.tsx` — mismo patrón
 * ya usado en `TaxForm.tsx`/`CategoryForm.tsx`/`SupplierForm.tsx` (ícono a
 * la izquierda, campos a la derecha, `border-b` en vez de tarjeta
 * independiente). Mismos campos, misma lógica, sin ningún cambio de
 * validación.
 */
export interface PurchaseHeaderFieldValues {
  supplierId?: string
  status?: PurchaseStatus
  documentNumber?: string | null
  purchaseDate?: string
  notes?: string | null
}

interface PurchaseHeaderFieldsProps<
  TFieldValues extends FieldValues & PurchaseHeaderFieldValues,
> {
  /** `control` del formulario padre (CreatePurchaseDto o UpdatePurchaseDto). */
  control: Control<TFieldValues>
  /** `register` del mismo formulario padre — usado para los campos de
   * texto nativos (`documentNumber`/`purchaseDate`/`notes`), igual que
   * en `PurchaseForm.tsx` original. `supplierId`/`status` siguen
   * usando `Controller`, no por la genericidad del componente, sino
   * porque `Select` (`@base-ui/react`) no es un elemento nativo con
   * `ref` compatible con `register`. */
  register: UseFormRegister<TFieldValues>
  /** Errores de validacion del mismo formulario padre. */
  errors: FieldErrors<TFieldValues>
  /** Deshabilita todos los controles mientras el guardado esta en curso. */
  isSubmitting?: boolean
  /** QA.7 (Proveedores): proveedor ya conocido al editar una compra
   * existente — ver doc en `PurchaseSupplierField.tsx`. `undefined` en
   * creacion (no hay compra previa). */
  initialSupplier?: { id: string; name: string } | null
}

const textareaClassName =
  'flex min-h-9 w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function PurchaseHeaderFields<
  TFieldValues extends FieldValues & PurchaseHeaderFieldValues,
>({
  control,
  register,
  errors,
  isSubmitting = false,
  initialSupplier = null,
}: PurchaseHeaderFieldsProps<TFieldValues>) {
  const supplierIdName = 'supplierId' as Path<TFieldValues>
  const statusName = 'status' as Path<TFieldValues>
  const documentNumberName = 'documentNumber' as Path<TFieldValues>
  const purchaseDateName = 'purchaseDate' as Path<TFieldValues>
  const notesName = 'notes' as Path<TFieldValues>

  // Rediseño de Compras: el estado deja de ser un `<Select>` mas dentro de
  // esta tarjeta — pasa a ser una progresion visual de solo lectura
  // (`PurchaseStatusTrack`), en el encabezado de la seccion. La transicion
  // real (Recibir/Cancelar) ahora es una accion explicita propia (ver
  // `ReceivePurchaseDialog.tsx`/`CancelPurchaseDialog.tsx` en
  // `PurchaseDetailPage.tsx`, y los dos botones de guardado de
  // `PurchaseForm.tsx` al crear), nunca eligiendo un valor de una lista —
  // por eso este campo ya no se registra con `Controller`/`register` aca.
  const status = useWatch({ control, name: statusName }) as PurchaseStatus | undefined

  return (
    <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-start">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Truck className="size-6" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Datos de la compra</h3>
          <PurchaseStatusTrack status={status} />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="purchase-form-supplierId">
              Proveedor
              <RequiredMark />
            </Label>
            <Controller
              control={control}
              name={supplierIdName}
              render={({ field }) => (
                <PurchaseSupplierField
                  id="purchase-form-supplierId"
                  value={(field.value as string | undefined) ?? ''}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                  error={errors.supplierId?.message as string | undefined}
                  initialSupplier={initialSupplier}
                />
              )}
            />
            {errors.supplierId && (
              <p className="text-sm text-destructive">
                {errors.supplierId.message as string}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="purchase-form-documentNumber">
              Número de documento
            </Label>
            <Input
              id="purchase-form-documentNumber"
              placeholder="Ej. 001-000123"
              disabled={isSubmitting}
              aria-invalid={!!errors.documentNumber}
              {...register(documentNumberName)}
            />
            {errors.documentNumber && (
              <p className="text-sm text-destructive">
                {errors.documentNumber.message as string}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="purchase-form-purchaseDate">
              Fecha de compra
              <RequiredMark />
            </Label>
            <div className="relative">
              <Input
                id="purchase-form-purchaseDate"
                type="date"
                disabled={isSubmitting}
                aria-invalid={!!errors.purchaseDate}
                className="pr-8 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:opacity-0"
                {...register(purchaseDateName)}
              />
              <Calendar className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            {errors.purchaseDate && (
              <p className="text-sm text-destructive">
                {errors.purchaseDate.message as string}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="purchase-form-notes">Notas</Label>
          <textarea
            id="purchase-form-notes"
            placeholder="Notas adicionales (opcional)"
            disabled={isSubmitting}
            aria-invalid={!!errors.notes}
            className={textareaClassName}
            {...register(notesName)}
          />
          {errors.notes && (
            <p className="text-sm text-destructive">
              {errors.notes.message as string}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
