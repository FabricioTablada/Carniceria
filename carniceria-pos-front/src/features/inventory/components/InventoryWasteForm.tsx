import { useMemo } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/common/Skeleton'
import { formatQuantity, getQuantityStep, roundToUnitPrecision } from '@/utils/formatQuantity'
import { useProduct } from '@/features/products/hooks/useProduct'
import { useProductLastPurchase } from '@/features/purchases/hooks/useProductLastPurchase'
import { useBatches } from '@/features/batches/hooks/useBatches'
import { formatBatchDate, getDaysUntilExpiry } from '@/features/batches/utils/batch.utils'
import { cn } from '@/lib/utils'
import { createInventoryWasteSchema } from '../schemas/inventory.schema'
import { WASTE_REASON_OPTIONS } from '../constants/wasteReason.constants'
import type { CreateInventoryWasteDto, Inventory, WasteReason } from '../types/inventory.types'

/** Pulido UX del selector de lotes (aprobado): indicador discreto de
 * vencimiento — puramente de presentación, reutiliza `getDaysUntilExpiry`
 * (ya existente, mismo cálculo que `BatchesTable.tsx`/`InventoryContextPanel.tsx`),
 * sin ningún cálculo nuevo. `null` cuando falta más de una semana — no
 * mostrar información innecesaria. Mismos 3 umbrales/colores ya
 * establecidos en `BatchesTable.tsx` ("Días restantes"). */
function getExpiryIndicator(expiryDate: string | null): { label: string; className: string } | null {
  const days = getDaysUntilExpiry(expiryDate)

  if (days === null || days > 7) return null
  if (days === 0) return { label: 'Vence hoy', className: 'text-destructive' }
  if (days === 1) return { label: 'Vence mañana', className: 'text-destructive' }
  return { label: 'Próximo a vencer', className: 'text-accent-amber' }
}

interface InventoryWasteFormProps {
  /** Existencia sobre la que se registra la merma — fija `sucursalId`/
   * `productId` (mismo criterio que `InventoryAdjustForm.tsx`: la fila ya
   * existe, no algo que tenga sentido editar desde aca) y acota la
   * cantidad maxima al stock disponible (`item.quantity`). */
  item: Inventory
  isSubmitting?: boolean
  onSubmit: (values: CreateInventoryWasteDto) => void
  onCancel?: () => void
  /** Flujo de conciliación de inventario (aprobado): prellena "Cantidad a
   * mermar" con la diferencia ya detectada en `InventoryAdjustDrawer.tsx`
   * — el usuario sigue eligiendo motivo/observaciones y puede corregir el
   * número igual que si lo hubiera tipeado. Opcional/aditivo: sin este
   * prop, el campo arranca vacío exactamente como antes. */
  defaultQuantity?: number
}

/**
 * features/inventory/components/InventoryWasteForm.tsx
 * -----------------------------------------------------------------------------
 * Bloque 5.4 ("Modulo de Mermas", integracion frontend). Mismo patron que
 * `InventoryAdjustForm.tsx`: react-hook-form + zodResolver, formulario de
 * una fila de inventario EXISTENTE (no de creacion/edicion general).
 *
 * A diferencia de Ajustar (que fija un valor ABSOLUTO de `quantity`), este
 * formulario pide la cantidad a DAR DE BAJA — mismo criterio ya usado por
 * `SaleReturnForm.tsx` (Bloque 4.3) frente a `SaleCorrectForm.tsx`. La
 * cantidad nunca puede superar `item.quantity` (stock disponible): el
 * `max` del schema (`createInventoryWasteSchema`) lo bloquea en el
 * cliente; el backend (Bloque 5.3) es la autoridad final y revalida
 * dentro de su transaccion.
 *
 * `sourceReturnItemId` nunca se completa aca — este formulario es
 * exclusivamente el origen MANUAL (arquitectura del Bloque 5.3 ya soporta
 * el origen automatico desde una devolucion, pero eso no se integra en
 * este bloque).
 *
 * Pulido "Análisis de mermas" (aprobado): aviso informativo, NO
 * bloqueante, cuando `useProductLastPurchase` (ya usado en
 * `InventoryAdjustDrawer.tsx`/`InventoryContextPanel.tsx`, misma ventana
 * de compras recientes que el resto del ERP) no encuentra ninguna compra
 * de este producto — la merma se sigue registrando exactamente igual, el
 * aviso solo explica por adelantado por qué la vista "Análisis" no va a
 * poder calcular el % real hasta que exista una compra recibida. Ningún
 * cálculo nuevo: mismo hook, mismo dato, solo se muestra antes de
 * enviar en vez de descubrirse después en otra pantalla.
 *
 * Corrección de sincronización Mermas/Lotes (aprobada, causa raíz del
 * desajuste `Inventory.quantity` vs. suma de lotes diagnosticado): el
 * backend YA soportaba `batchId` en `CreateInventoryWasteDto` y YA
 * descontaba el lote correspondiente (`createWasteTransaction`,
 * `recordMovement`) — este formulario simplemente nunca lo enviaba. Sin
 * cálculos nuevos: `useProduct` (ya existente) resuelve
 * `requiresBatch`; `useBatches` (ya existente, mismo hook que
 * `InventoryContextPanel.tsx`/Lotes) trae los lotes `ACTIVE` de este
 * producto/sucursal — se filtran en cliente los que tengan
 * `availableQuantity > 0` y se ordenan FEFO (vencimiento asc., código
 * como desempate). Para productos sin lotes (`requiresBatch: false`), el
 * formulario queda exactamente igual que antes — ningún selector nuevo.
 */
export function InventoryWasteForm({
  item,
  isSubmitting = false,
  onSubmit,
  onCancel,
  defaultQuantity,
}: InventoryWasteFormProps) {
  const { data: product } = useProduct(item.productId)
  const requiresBatch = product?.requiresBatch ?? false

  const { data: batchesResponse, isLoading: isLoadingBatches } = useBatches({
    productId: item.productId,
    sucursalId: item.sucursalId,
    status: 'ACTIVE',
    limit: 100,
  })

  const eligibleBatches = useMemo(() => {
    return [...(batchesResponse?.data ?? [])]
      .filter((batch) => batch.availableQuantity > 0)
      .sort((a, b) => {
        const aExpiry = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY
        const bExpiry = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY
        return aExpiry !== bExpiry ? aExpiry - bExpiry : a.code.localeCompare(b.code, 'es')
      })
  }, [batchesResponse])

  const batchAvailableQuantityById = useMemo(
    () => new Map(eligibleBatches.map((batch) => [batch.id, batch.availableQuantity])),
    [eligibleBatches],
  )

  const noBatchesAvailable = requiresBatch && !isLoadingBatches && eligibleBatches.length === 0

  // QA correctivo: el limite de validacion se redondea a la MISMA
  // precision que `formatQuantity` muestra como "stock disponible" (ver
  // `roundToUnitPrecision`) — sin esto, un residuo de punto flotante en
  // `item.quantity` (invisible en el "20.000 kg" que ve el usuario) podia
  // rechazar como invalida una cantidad que visualmente parecia estar
  // dentro del limite.
  const maxQuantity = roundToUnitPrecision(item.quantity, item.product.unitOfMeasure)
  const schema = useMemo(
    () =>
      createInventoryWasteSchema(maxQuantity, {
        required: requiresBatch,
        availableQuantityById: batchAvailableQuantityById,
      }),
    [maxQuantity, requiresBatch, batchAvailableQuantityById],
  )

  const { data: lastPurchase, isLoading: isLoadingLastPurchase } = useProductLastPurchase(item.productId)
  const hasNoPurchaseHistory = !isLoadingLastPurchase && !lastPurchase

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateInventoryWasteDto>({
    resolver: zodResolver(schema as never) as unknown as Resolver<CreateInventoryWasteDto>,
    defaultValues: {
      sucursalId: item.sucursalId,
      productId: item.productId,
      reason: undefined,
      notes: '',
      quantity: defaultQuantity,
      sourceReturnItemId: null,
      batchId: null,
    },
  })

  // `useWatch` (no `watch()` de `useForm()`): la funcion `watch()` no es
  // compatible con la memoizacion del React Compiler (lint
  // `react-hooks/incompatible-library`) — `useWatch` si lo es, mismo
  // criterio ya usado en `PurchaseItemRow.tsx` para leer un valor
  // controlado sin ese problema.
  const reason = useWatch({ control, name: 'reason' })
  const submit = handleSubmit((values) => onSubmit(values))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold">{item.product.name}</span> — stock disponible:{' '}
        {formatQuantity(item.quantity, item.product.unitOfMeasure)}
      </p>

      {hasNoPurchaseHistory && (
        <div className="flex gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Este producto no posee compras registradas. La merma se registrará correctamente. Sin
            embargo, el análisis de merma no podrá calcular el porcentaje real hasta que exista al
            menos una compra recibida para este producto.
          </p>
        </div>
      )}

      {requiresBatch && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inventory-waste-batch">Lote</Label>
          {isLoadingBatches ? (
            <Skeleton className="h-10 w-full" />
          ) : noBatchesAvailable ? (
            <div className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <p>
                No existen lotes activos con disponibilidad para este producto — no es posible
                registrar la merma hasta que exista un lote con saldo.
              </p>
            </div>
          ) : (
            <Controller
              control={control}
              name="batchId"
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(value: unknown) => field.onChange(value as string)}
                >
                  <SelectTrigger id="inventory-waste-batch" aria-invalid={!!errors.batchId}>
                    <SelectValue>
                      {(value: unknown) => {
                        const batch = eligibleBatches.find((option) => option.id === value)
                        if (!batch) return 'Selecciona un lote'
                        const indicator = getExpiryIndicator(batch.expiryDate)
                        return (
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <span className="truncate">
                              {batch.code} — {formatQuantity(batch.availableQuantity, item.product.unitOfMeasure)} disp. — vence {formatBatchDate(batch.expiryDate)}
                            </span>
                            {indicator && (
                              <span className={cn('shrink-0 text-xs font-semibold whitespace-nowrap', indicator.className)}>
                                · {indicator.label}
                              </span>
                            )}
                          </span>
                        )
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleBatches.map((batch) => {
                      const indicator = getExpiryIndicator(batch.expiryDate)
                      return (
                        <SelectItem key={batch.id} value={batch.id}>
                          <span className="inline-flex items-center gap-1.5">
                            <span>
                              {batch.code} — {formatQuantity(batch.availableQuantity, item.product.unitOfMeasure)} disp. — vence {formatBatchDate(batch.expiryDate)}
                            </span>
                            {indicator && (
                              <span className={cn('shrink-0 rounded-full bg-current/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap', indicator.className)}>
                                {indicator.label}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          {errors.batchId && <p className="text-sm text-destructive">{errors.batchId.message}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inventory-waste-quantity">Cantidad a mermar</Label>
        <Input
          id="inventory-waste-quantity"
          type="number"
          step={getQuantityStep(item.product.unitOfMeasure)}
          min={0}
          max={maxQuantity}
          disabled={isSubmitting || noBatchesAvailable}
          aria-invalid={!!errors.quantity}
          {...register('quantity', { valueAsNumber: true })}
        />
        {errors.quantity && (
          <p className="text-sm text-destructive">{errors.quantity.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inventory-waste-reason">Motivo</Label>
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(value: unknown) => field.onChange(value as WasteReason)}
            >
              <SelectTrigger id="inventory-waste-reason" aria-invalid={!!errors.reason}>
                <SelectValue>
                  {(value: unknown) =>
                    WASTE_REASON_OPTIONS.find((option) => option.value === value)?.label ??
                    'Selecciona un motivo'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WASTE_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inventory-waste-notes">
          Observaciones{reason === 'OTHER' ? ' (obligatorio)' : ' (opcional)'}
        </Label>
        <textarea
          id="inventory-waste-notes"
          rows={2}
          disabled={isSubmitting}
          aria-invalid={!!errors.notes}
          placeholder="Detalle adicional sobre la merma..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          {...register('notes')}
        />
        {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {onCancel && (
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="destructive" disabled={isSubmitting || noBatchesAvailable}>
          {isSubmitting ? 'Registrando...' : 'Registrar merma'}
        </Button>
      </div>
    </form>
  )
}
