import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/utils/formatCurrency'
import { getQuantityStep, getUnitSuffix } from '@/utils/formatQuantity'
import { toNumber } from '@/utils/parseNumber'
import { CartDiscount } from './CartDiscount'
import { PAYMENT_METHOD_OPTIONS } from '../utils/payment'
import { ELECTRONIC_PAYMENT_METHODS } from '../utils/payment'
import { useCorrectSale } from '../hooks/useCorrectSale'
import { getSaleErrorMessage } from '../utils/saleErrors'
import type { PaymentMethod, Sale, SaleDiscountType, SaleItemProductUnitOfMeasure } from '../types/sale.types'

interface EditableItem {
  productId: string
  productName: string
  taxId: string | null
  taxName: string | null
  unitOfMeasure: SaleItemProductUnitOfMeasure
  /** Cantidad/precio/descuento se guardan como STRING mientras el usuario
   * escribe (mismo criterio que `CartDiscount.tsx`/`PurchaseItemRow.tsx`
   * tras el QA de UX de campos monetarios): un input controlado que
   * reconvierte a `Number` en cada `onChange` y usa ese numero como
   * `value` pierde el "." que el usuario acaba de tipear en cuanto lo
   * escribe (`Number("5500.")` es `5500`, sin punto, y React vuelve a
   * mostrar "5500"). Convertir a numero solo ocurre al calcular
   * (`toNumber`, subtotal) o al enviar (`handleSubmit`), nunca en el
   * `onChange`. */
  quantity: string
  unitPrice: string
  discount: string
}

interface SaleCorrectFormProps {
  /** Venta original a corregir. Nunca se edita: sus datos solo sirven para
   * precargar el formulario. */
  sale: Sale
  onCancel: () => void
  /** Se dispara cuando la correccion se registro con exito. */
  onSuccess: () => void
}

/**
 * features/sales/components/SaleCorrectForm.tsx
 * -----------------------------------------------------------------------------
 * Bloque 3 ("Anulacion/Correccion de Venta"). La venta original NUNCA se
 * edita: este formulario recolecta los datos de la venta CORRECTIVA (el
 * backend anula la original y crea esta como una venta nueva enlazada,
 * ver `sales.service.ts`/`correctSale`).
 *
 * Alcance deliberado de esta primera version: permite ajustar cantidad,
 * precio unitario y descuento de las lineas YA existentes en la venta
 * original, o quitarlas — no agregar productos nuevos (eso requeriria el
 * buscador de catalogo completo del POS, `ProductSearchDialog.tsx`, fuera
 * del alcance de este bloque). Se avisa explicitamente en la UI, no se
 * oculta la limitacion.
 */
export function SaleCorrectForm({ sale, onCancel, onSuccess }: SaleCorrectFormProps) {
  const { mutate: correctSale, isPending, error } = useCorrectSale()

  const [items, setItems] = useState<EditableItem[]>(
    sale.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      taxId: item.taxId,
      taxName: item.tax?.name ?? null,
      unitOfMeasure: item.product.unitOfMeasure,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      // "0" se guarda como '' (mismo criterio ya usado antes con el
      // truco `item.discount === 0 ? '' : item.discount`, ahora aplicado
      // sobre el string en vez de sobre el number) — la mayoria de las
      // lineas no tiene descuento, no tiene sentido mostrar "0" de
      // arranque.
      discount: item.discount === 0 ? '' : String(item.discount),
    })),
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(sale.paymentMethod)
  const [paymentReference, setPaymentReference] = useState(sale.paymentReference ?? '')
  const [amountPaid, setAmountPaid] = useState(
    sale.amountPaid === 0 ? '' : String(sale.amountPaid),
  )
  const [discountType, setDiscountType] = useState<SaleDiscountType>(sale.discountType)
  const [discountValue, setDiscountValue] = useState(sale.discountValue)
  const [notes, setNotes] = useState(sale.notes ?? '')
  const [reason, setReason] = useState('')

  const subtotal = items.reduce(
    (sum, item) => sum + (toNumber(item.quantity) * toNumber(item.unitPrice) - toNumber(item.discount)),
    0,
  )

  const requiresReference = ELECTRONIC_PAYMENT_METHODS.includes(paymentMethod)
  const canSubmit =
    items.length > 0 &&
    reason.trim().length > 0 &&
    (!requiresReference || paymentReference.trim().length > 0) &&
    items.every((item) => toNumber(item.quantity) > 0 && toNumber(item.unitPrice) >= 0)

  const handleItemChange = (index: number, patch: Partial<EditableItem>) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  const handleRemoveItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleSubmit = () => {
    if (!canSubmit) {
      return
    }

    const dto = {
      reason: reason.trim(),
      paymentMethod,
      paymentReference: requiresReference ? paymentReference.trim() : null,
      amountPaid: toNumber(amountPaid),
      discountType,
      discountValue,
      notes: notes.trim() || null,
      items: items.map((item) => ({
        productId: item.productId,
        taxId: item.taxId,
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice),
        discount: toNumber(item.discount),
      })),
    }

    correctSale(
      { id: sale.id, dto },
      {
        onSuccess: () => {
          onSuccess()
          // Bloque POS-08: evento puntual de exito, hoy silencioso (solo
          // cerraba este sub-flujo).
          toast.success('Venta corregida correctamente')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Se anulará la venta <span className="font-semibold">{sale.documentNumber}</span> y se
        creará una venta nueva con los datos corregidos, enlazada a la original. Esta corrección
        solo permite ajustar o quitar líneas ya existentes — agregar productos nuevos no está
        disponible aquí.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Productos
        </span>

        <div className="flex flex-col gap-2 rounded-xl border">
          {items.map((item, index) => (
            <div
              key={item.productId}
              className="flex flex-wrap items-end gap-3 border-b p-3 last:border-b-0"
            >
              <div className="flex min-w-40 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">{item.productName}</span>
                <span className="text-xs text-muted-foreground">
                  {item.taxName ?? 'Sin impuesto'}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-[0.6875rem] text-muted-foreground">
                  Cantidad ({getUnitSuffix(item.unitOfMeasure)})
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    step={getQuantityStep(item.unitOfMeasure)}
                    min={0}
                    value={item.quantity}
                    onChange={(event) =>
                      handleItemChange(index, { quantity: event.target.value })
                    }
                    className="h-9 w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    {getUnitSuffix(item.unitOfMeasure)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-[0.6875rem] text-muted-foreground">Precio unitario</Label>
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  value={item.unitPrice}
                  onChange={(event) =>
                    handleItemChange(index, { unitPrice: event.target.value })
                  }
                  className="h-9 w-28"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-[0.6875rem] text-muted-foreground">Descuento</Label>
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  placeholder="0"
                  value={item.discount}
                  onChange={(event) =>
                    handleItemChange(index, { discount: event.target.value })
                  }
                  className="h-9 w-24"
                />
              </div>

              <div className="flex flex-col gap-1 text-right">
                <Label className="text-[0.6875rem] text-muted-foreground">Subtotal</Label>
                <span className="h-9 pt-1.5 text-sm font-semibold tabular-nums">
                  {formatCurrency(toNumber(item.quantity) * toNumber(item.unitPrice) - toNumber(item.discount))}
                </span>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar ${item.productName}`}
                onClick={() => handleRemoveItem(index)}
                className="rounded-lg text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          {items.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No quedan productos en esta corrección.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Método de pago</Label>
          <Select
            value={paymentMethod}
            onValueChange={(value: unknown) => setPaymentMethod(value as PaymentMethod)}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue>
                {(value: unknown) =>
                  PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label ??
                  String(value)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {requiresReference && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Referencia de pago
            </Label>
            <Input
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="Número de autorización, comprobante, etc."
              className="h-10 rounded-xl"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Monto pagado</Label>
          <Input
            type="number"
            step={0.01}
            min={0}
            placeholder="0"
            value={amountPaid}
            onChange={(event) => setAmountPaid(event.target.value)}
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      <CartDiscount
        discountType={discountType}
        discountValue={discountValue}
        onDiscountTypeChange={setDiscountType}
        onDiscountValueChange={setDiscountValue}
        subtotal={subtotal}
      />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold text-muted-foreground">Notas</Label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-4">
        <Label className="text-xs font-semibold text-destructive">
          Motivo de la corrección (obligatorio)
        </Label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          placeholder="Explica por qué se corrige esta venta..."
          aria-invalid={reason.trim().length === 0}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
      </div>

      {error && <ErrorAlert>{getSaleErrorMessage(error)}</ErrorAlert>}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          className="bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
        >
          {isPending ? 'Corrigiendo...' : 'Confirmar corrección'}
        </Button>
      </div>
    </div>
  )
}
