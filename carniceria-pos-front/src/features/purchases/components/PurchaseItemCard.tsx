import { useState } from 'react'
import { Controller, useWatch } from 'react-hook-form'
import type { Control, FieldErrors } from 'react-hook-form'
import {
  ChevronDown,
  History,
  Layers3,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/common/Badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProductThumbnail } from '@/components/ui/ProductThumbnail'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { toNumber } from '@/utils/parseNumber'
import { useProduct } from '@/features/products/hooks/useProduct'
import { calculateCostPreview } from '@/features/products/utils/costEnginePreview'
import { useProductWasteHistory } from '../hooks/useProductWasteHistory'
import { useProductLastPurchase } from '../hooks/useProductLastPurchase'
import { analyzeWasteHistory } from '../utils/wasteHistoryAnalysis'
import { NO_TAX_VALUE } from '../utils/purchase.utils'
import type { CreatePurchaseDto, CreatePurchaseItemDto } from '../types/purchase.types'

interface PurchaseItemCardProps {
  control: Control<CreatePurchaseDto>
  index: number
  taxes: { id: string; name: string }[]
  itemErrors?: FieldErrors<CreatePurchaseItemDto>
  isSubmitting?: boolean
  canRemove: boolean
  onRemove: () => void
  onEditProduct: (index: number) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

/** Redondea a 2 decimales (mismo `step="0.01"` que ya admitia el input
 * numerico) para evitar arrastre de coma flotante al incrementar/
 * decrementar con los botones +/-. */
function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

function daysAgoLabel(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'hoy'
  if (days === 1) return 'hace 1 día'
  return `hace ${days} días`
}

/**
 * features/purchases/components/PurchaseItemCard.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — reemplaza `PurchaseItemRow.tsx` (fila de tabla) por
 * una tarjeta expandible: compacta por defecto (producto/cantidad/costo/
 * subtotal siempre visibles), con la simulación de costo/merma y la
 * trazabilidad de lote — la parte más densa de información del módulo —
 * dentro de un cuerpo que se expande in-place, sin scroll horizontal ni
 * texto apilado en una celda angosta.
 *
 * TODA la lógica de `PurchaseItemRow.tsx` se preserva sin cambios (buffers
 * de texto de cantidad/costo/merma, resolución del producto por id,
 * historial de merma, simulación de costo, campos de lote) — únicamente
 * cambia el layout de `<tr>/<td>` a tarjeta. Único agregado real: la
 * insignia de "última compra" (`useProductLastPurchase.ts`, nuevo hook, sin
 * endpoint nuevo) con el costo/proveedor más reciente y la variación
 * porcentual frente a la compra anterior — visible siempre que exista el
 * dato, sin convertir la tarjeta en un formulario más grande.
 */
export function PurchaseItemCard({
  control,
  index,
  taxes,
  itemErrors,
  isSubmitting = false,
  canRemove,
  onRemove,
  onEditProduct,
  isExpanded,
  onToggleExpand,
}: PurchaseItemCardProps) {
  const item = useWatch({ control, name: `items.${index}` })

  const { data: selectedProduct } = useProduct(item?.productId || '')
  const { data: wasteHistory } = useProductWasteHistory(item?.productId || '')
  const { data: lastPurchase } = useProductLastPurchase(item?.productId || '')

  const externalQuantity = Number(item?.quantity) || 0
  const externalUnitCost = Number(item?.unitCost) || 0
  const externalExpectedWastePercent =
    item?.expectedWastePercent === null || item?.expectedWastePercent === undefined
      ? null
      : Number(item.expectedWastePercent)

  const [quantityText, setQuantityText] = useState(externalQuantity === 0 ? '' : String(externalQuantity))
  if (externalQuantity !== toNumber(quantityText)) {
    setQuantityText(externalQuantity === 0 ? '' : String(externalQuantity))
  }

  const [unitCostText, setUnitCostText] = useState(externalUnitCost === 0 ? '' : String(externalUnitCost))
  if (externalUnitCost !== toNumber(unitCostText)) {
    setUnitCostText(externalUnitCost === 0 ? '' : String(externalUnitCost))
  }

  const [expectedWastePercentText, setExpectedWastePercentText] = useState(
    externalExpectedWastePercent === null ? '' : String(externalExpectedWastePercent),
  )
  const externalExpectedWastePercentAsTextNumber =
    expectedWastePercentText === '' ? null : toNumber(expectedWastePercentText)
  if (externalExpectedWastePercent !== externalExpectedWastePercentAsTextNumber) {
    setExpectedWastePercentText(
      externalExpectedWastePercent === null ? '' : String(externalExpectedWastePercent),
    )
  }

  const lineSubtotal = externalQuantity * externalUnitCost

  const costPreview =
    selectedProduct && externalExpectedWastePercent !== null
      ? calculateCostPreview({
          averageCost: selectedProduct.cost,
          wastePercent: externalExpectedWastePercent,
          applyExpectedWasteToCost: true,
        })
      : null

  const hasStandardWasteConfigured = selectedProduct?.applyExpectedWasteToCost ?? false

  const wasteComparison =
    costPreview && selectedProduct && hasStandardWasteConfigured
      ? {
          standardWaste: selectedProduct.expectedWastePercent,
          lotWaste: costPreview.wastePercent,
          diffPoints: Math.round((costPreview.wastePercent - selectedProduct.expectedWastePercent) * 100) / 100,
        }
      : null

  const wasteHistoryAnalysis =
    selectedProduct && wasteHistory
      ? analyzeWasteHistory({
          observedWastePercents: wasteHistory,
          currentStandardWaste: selectedProduct.expectedWastePercent,
        })
      : null

  return (
    <div className="rounded-xl border bg-card transition-colors duration-150 hover:border-brand/30">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          aria-label={isExpanded ? `Contraer línea ${index + 1}` : `Expandir línea ${index + 1}`}
          onClick={onToggleExpand}
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted',
            isExpanded && 'bg-brand/10 text-brand',
          )}
        >
          <ChevronDown className={cn('size-4 transition-transform', isExpanded && 'rotate-180')} />
        </button>

        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          aria-invalid={!!itemErrors?.productId}
          aria-label={`Producto de la linea ${index + 1}`}
          onClick={() => onEditProduct(index)}
          className="h-auto min-h-8 min-w-56 flex-1 basis-56 justify-start py-1 font-normal"
        >
          {selectedProduct ? (
            <span className="flex min-w-0 items-center gap-2 text-left">
              <ProductThumbnail
                imageUrl={selectedProduct.imageUrl}
                title={selectedProduct.name}
                containerClassName="size-7 shrink-0 rounded-full"
                textClassName="text-xs text-brand/45"
              />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium text-foreground">{selectedProduct.name}</span>
                {selectedProduct.sku && (
                  <span className="truncate text-xs text-muted-foreground">Código: {selectedProduct.sku}</span>
                )}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Seleccionar producto</span>
          )}
        </Button>

        {selectedProduct?.requiresBatch && (
          <span title="Este producto requiere trazabilidad de lote">
            <Layers3 className="size-4 shrink-0 text-brand/70" aria-hidden="true" />
          </span>
        )}

        {lastPurchase && lastPurchase.variationPercent !== null && (
          <span
            title={`Última compra: ${formatCurrency(lastPurchase.lastUnitCost)} (${lastPurchase.lastSupplierName}, ${daysAgoLabel(lastPurchase.lastPurchaseDate)})`}
          >
            <Badge
              variant={lastPurchase.variationPercent > 0 ? 'destructive' : 'secondary'}
              className="shrink-0 gap-1"
            >
              {lastPurchase.variationPercent > 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {lastPurchase.variationPercent > 0 ? '+' : ''}
              {lastPurchase.variationPercent}%
            </Badge>
          </span>
        )}

        <Controller
          control={control}
          name={`items.${index}.quantity`}
          render={({ field: quantityField }) => {
            const current = toNumber(quantityText)

            const handleQuantityTextChange = (raw: string) => {
              setQuantityText(raw)
              quantityField.onChange(toNumber(raw))
            }

            const handleStepperChange = (nextNumber: number) => {
              setQuantityText(nextNumber === 0 ? '' : String(nextNumber))
              quantityField.onChange(nextNumber)
            }

            if (selectedProduct?.unitOfMeasure === 'KILOGRAM') {
              return (
                <div className="flex shrink-0 flex-col gap-0.5">
                  <input
                    type="number"
                    step="0.001"
                    min={0.001}
                    placeholder="Peso (kg)"
                    aria-label={`Peso recibido de la linea ${index + 1} en kilogramos`}
                    aria-invalid={!!itemErrors?.quantity}
                    disabled={isSubmitting}
                    value={quantityText}
                    onChange={(event) => handleQuantityTextChange(event.target.value)}
                    className="h-8 w-24 rounded-lg border border-input bg-transparent px-2 text-center text-sm tabular-nums outline-none [appearance:textfield] focus-visible:border-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-center text-[0.6875rem] text-muted-foreground">kg</span>
                </div>
              )
            }

            return (
              <div
                className="inline-flex h-8 shrink-0 items-center rounded-lg border border-input"
                aria-invalid={!!itemErrors?.quantity}
              >
                <button
                  type="button"
                  aria-label={`Restar cantidad de la linea ${index + 1}`}
                  disabled={isSubmitting}
                  onClick={() => handleStepperChange(Math.max(0.01, roundTo2(current - 1)))}
                  className="flex h-full w-7 shrink-0 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  <Minus className="size-3.5" />
                </button>
                <input
                  type="number"
                  step="0.01"
                  aria-label={`Cantidad de la linea ${index + 1}`}
                  disabled={isSubmitting}
                  value={quantityText}
                  onChange={(event) => handleQuantityTextChange(event.target.value)}
                  className="h-full w-10 border-x border-input bg-transparent text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label={`Sumar cantidad de la linea ${index + 1}`}
                  disabled={isSubmitting}
                  onClick={() => handleStepperChange(roundTo2(current + 1))}
                  className="flex h-full w-7 shrink-0 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            )
          }}
        />

        <Controller
          control={control}
          name={`items.${index}.unitCost`}
          render={({ field: unitCostField }) => (
            <Input
              type="number"
              step="0.01"
              placeholder="0"
              aria-label={`Costo unitario de la linea ${index + 1}`}
              disabled={isSubmitting}
              aria-invalid={!!itemErrors?.unitCost}
              value={unitCostText}
              onChange={(event) => {
                setUnitCostText(event.target.value)
                unitCostField.onChange(toNumber(event.target.value))
              }}
              className="h-8 w-24 shrink-0 text-right tabular-nums"
            />
          )}
        />

        <span className="w-24 shrink-0 text-right text-base font-semibold tabular-nums text-foreground">
          {formatCurrency(lineSubtotal)}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Quitar línea ${index + 1}`}
          disabled={isSubmitting || !canRemove}
          onClick={onRemove}
          className="shrink-0 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {(itemErrors?.productId || itemErrors?.quantity || itemErrors?.unitCost) && (
        <div className="flex flex-col gap-0.5 px-4 pb-2 text-xs text-destructive">
          {itemErrors?.productId && <p>{itemErrors.productId.message}</p>}
          {itemErrors?.quantity && <p>{itemErrors.quantity.message}</p>}
          {itemErrors?.unitCost && <p>{itemErrors.unitCost.message}</p>}
        </div>
      )}

      {isExpanded && (
        <div className="grid grid-cols-1 gap-4 border-t bg-muted/20 px-4 py-3 @lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Impuesto de la línea
              </span>
              <Controller
                control={control}
                name={`items.${index}.taxId`}
                render={({ field: taxField }) => (
                  <Select
                    value={taxField.value ?? NO_TAX_VALUE}
                    onValueChange={(value: unknown) => {
                      const taxId = value as string
                      taxField.onChange(taxId === NO_TAX_VALUE ? null : taxId)
                    }}
                  >
                    <SelectTrigger
                      aria-label={`Impuesto de la linea ${index + 1}`}
                      disabled={isSubmitting}
                      aria-invalid={!!itemErrors?.taxId}
                      className="max-w-56"
                    >
                      <SelectValue>
                        {(value: unknown) => {
                          const taxId = value as string
                          if (taxId === NO_TAX_VALUE) return 'Sin impuesto'
                          return taxes.find((tax) => tax.id === taxId)?.name ?? taxId
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TAX_VALUE}>Sin impuesto</SelectItem>
                      {taxes.map((tax) => (
                        <SelectItem key={tax.id} value={tax.id}>
                          {tax.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {itemErrors?.taxId && <p className="text-xs text-destructive">{itemErrors.taxId.message}</p>}
            </div>

            {lastPurchase && (
              <div className="flex flex-col gap-1 rounded-lg border border-dashed p-2.5 text-xs">
                <span className="font-semibold text-muted-foreground uppercase">Última compra de este producto</span>
                <span>
                  {formatCurrency(lastPurchase.lastUnitCost)} — {lastPurchase.lastSupplierName} (
                  {daysAgoLabel(lastPurchase.lastPurchaseDate)})
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Merma esperada (%)
            </span>
            <Controller
              control={control}
              name={`items.${index}.expectedWastePercent`}
              render={({ field: wasteField }) => (
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  placeholder="—"
                  aria-label={`Merma esperada de la linea ${index + 1}`}
                  disabled={isSubmitting}
                  aria-invalid={!!itemErrors?.expectedWastePercent}
                  value={expectedWastePercentText}
                  onChange={(event) => {
                    const raw = event.target.value
                    setExpectedWastePercentText(raw)
                    wasteField.onChange(raw === '' ? null : toNumber(raw))
                  }}
                  className="max-w-32 tabular-nums"
                />
              )}
            />
            {itemErrors?.expectedWastePercent && (
              <p className="text-xs text-destructive">{itemErrors.expectedWastePercent.message}</p>
            )}
            {costPreview && (
              <p
                className="mt-1 flex items-center gap-1 text-xs whitespace-nowrap text-brand"
                title="Estimado del lote — no afecta el costo vigente del producto"
              >
                <span className="text-muted-foreground">Costo efectivo:</span>
                <span className="font-semibold tabular-nums">{formatCurrency(costPreview.effectiveCost)}</span>
              </p>
            )}
            {wasteComparison && (
              <p
                className={cn(
                  'mt-0.5 flex items-center gap-1 text-xs whitespace-nowrap',
                  wasteComparison.diffPoints > 0
                    ? 'text-warning'
                    : wasteComparison.diffPoints < 0
                      ? 'text-success'
                      : 'text-muted-foreground',
                )}
                title="Comparación informativa entre la merma de este lote y la merma estándar del producto — no modifica ningún dato"
              >
                {wasteComparison.diffPoints === 0 && (
                  <span>Igual al estándar ({wasteComparison.standardWaste}%)</span>
                )}
                {wasteComparison.diffPoints > 0 && (
                  <>
                    <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />
                    <span>+{wasteComparison.diffPoints}pp vs. estándar ({wasteComparison.standardWaste}%)</span>
                  </>
                )}
                {wasteComparison.diffPoints < 0 && (
                  <>
                    <TrendingDown className="size-3 shrink-0" aria-hidden="true" />
                    <span>{wasteComparison.diffPoints}pp vs. estándar ({wasteComparison.standardWaste}%)</span>
                  </>
                )}
              </p>
            )}
            {costPreview && !hasStandardWasteConfigured && (
              <p
                className="mt-0.5 text-xs leading-snug text-muted-foreground"
                title="Este producto no usa una merma estándar propia — la simulación es unicamente para este lote"
              >
                Este producto no tiene una merma estándar configurada. La merma ingresada se utilizará
                únicamente para esta simulación del lote.
              </p>
            )}
            {wasteHistoryAnalysis && (
              <p
                className={cn(
                  'mt-0.5 flex items-center gap-1 text-xs whitespace-nowrap',
                  wasteHistoryAnalysis.hasSuggestion ? 'text-warning' : 'text-muted-foreground',
                )}
                title={
                  wasteHistoryAnalysis.hasSuggestion
                    ? 'Sugerencia informativa: el promedio observado en compras pasadas difiere del estándar actual del producto. No modifica ningún dato — la decisión de actualizarlo es suya.'
                    : 'Promedio observado en compras pasadas de este producto, cercano al estándar actual — solo informativo.'
                }
              >
                <History className="size-3 shrink-0" aria-hidden="true" />
                <span>
                  Histórico: {wasteHistoryAnalysis.averageWaste}% prom. ({wasteHistoryAnalysis.sampleSize} compras)
                  {wasteHistoryAnalysis.hasSuggestion && ' — revisar estándar'}
                </span>
              </p>
            )}
          </div>

          {selectedProduct?.requiresBatch && (
            <div className="flex flex-col gap-2 @lg:col-span-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand/70 uppercase">
                <Layers3 className="size-3.5" aria-hidden="true" />
                Trazabilidad de lote
              </span>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-0.5">
                  <label
                    htmlFor={`purchase-item-${index}-supplierLotCode`}
                    className="text-xs text-muted-foreground"
                  >
                    Código de lote del proveedor
                  </label>
                  <Controller
                    control={control}
                    name={`items.${index}.supplierLotCode`}
                    render={({ field }) => (
                      <Input
                        id={`purchase-item-${index}-supplierLotCode`}
                        type="text"
                        placeholder="Opcional"
                        disabled={isSubmitting}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value || null)}
                        className="h-8 w-40 text-sm"
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <label
                    htmlFor={`purchase-item-${index}-productionDate`}
                    className="text-xs text-muted-foreground"
                  >
                    Fecha de producción
                  </label>
                  <Controller
                    control={control}
                    name={`items.${index}.productionDate`}
                    render={({ field }) => (
                      <Input
                        id={`purchase-item-${index}-productionDate`}
                        type="date"
                        disabled={isSubmitting}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value || null)}
                        className="h-8 w-36 text-sm"
                      />
                    )}
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <label htmlFor={`purchase-item-${index}-expiryDate`} className="text-xs text-muted-foreground">
                    Fecha de vencimiento
                  </label>
                  <Controller
                    control={control}
                    name={`items.${index}.expiryDate`}
                    render={({ field }) => (
                      <Input
                        id={`purchase-item-${index}-expiryDate`}
                        type="date"
                        disabled={isSubmitting}
                        aria-invalid={!!itemErrors?.expiryDate}
                        value={field.value ?? ''}
                        onChange={(event) => field.onChange(event.target.value || null)}
                        className="h-8 w-36 text-sm"
                      />
                    )}
                  />
                  {itemErrors?.expiryDate && (
                    <p className="text-xs text-destructive">{itemErrors.expiryDate.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
