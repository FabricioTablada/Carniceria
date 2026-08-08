import { useState } from 'react'
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
import { formatQuantity, getQuantityStep } from '@/utils/formatQuantity'
import { useCashSessions } from '@/features/cashSession/hooks/useCashSessions'
import { useCreateReturn } from '@/features/returns/hooks/useCreateReturn'
import { useSaleReturns } from '@/features/returns/hooks/useSaleReturns'
import { sumReturnedQuantityByItemId } from '@/features/returns/utils/returnedQuantity'
import { getReturnErrorMessage } from '@/features/returns/utils/returnErrors'
import type { PaymentMethod as ReturnPaymentMethod } from '@/features/returns/types/return.types'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import { PAYMENT_METHOD_OPTIONS } from '../utils/payment'
import type { Sale } from '../types/sale.types'

interface ReturnableLine {
  saleItemId: string
  productName: string
  unitOfMeasure: 'KILOGRAM' | 'UNIT'
  /** Cantidad originalmente vendida en esta línea — solo para mostrar
   * contexto ("Vendido: X"). El tope real de cantidad devolvible es el
   * REMANENTE (ver `remainingByItemId`), no este valor. */
  originalQuantity: number
  unitPrice: number
  selected: boolean
  quantity: number
  restock: boolean
}

interface SaleReturnFormProps {
  sale: Sale
  onCancel: () => void
  /** Se dispara cuando la devolución se registró con éxito. */
  onSuccess: () => void
}

/**
 * features/sales/components/SaleReturnForm.tsx
 * -----------------------------------------------------------------------------
 * Bloque 4.3 ("Integración de Devoluciones con el frontend"). La venta
 * original nunca se edita: este formulario recolecta los datos de la
 * devolución (`useCreateReturn`, `POST /returns`, Bloque 4.2) — selección
 * de líneas, cantidad por línea, si cada una vuelve a inventario o se
 * marca como merma (`restock`, decisión de negocio todavía no cerrada, ver
 * `modules/returns/types.ts` del backend), motivo y método de reembolso.
 *
 * `cashSessionId` (la sesión que EMITE el reembolso): se resuelve con
 * `useCashSessions({status:'OPEN'})`, el MISMO hook ya usado en
 * `SalesPage.tsx`/`OpenCashSessionPage.tsx` — sin lógica nueva de sesión de
 * caja. Sin sesión abierta, la devolución no puede registrarse (el
 * reembolso necesita una caja activa que lo reciba/entregue).
 *
 * Sprint QA 1 (fix de un límite conocido del Bloque 4.3): el tope de
 * cantidad por línea ya NO es la cantidad original vendida — es el
 * REMANENTE real (original menos lo ya devuelto en devoluciones previas),
 * calculado con `useSaleReturns(sale.id)` (mismo hook y mismo cache de
 * React Query que ya usa `SaleReturnHistory.tsx` para el mismo listado —
 * sin una segunda petición de red) + `sumReturnedQuantityByItemId`
 * (utilidad compartida, extraída de `SaleReturnHistory.tsx` para no
 * duplicar ese cálculo). Antes de este fix, una línea ya totalmente
 * devuelta seguía mostrando su cantidad original como máximo, y el envío
 * fallaba recién contra la validación del backend sin que el usuario
 * supiera de antemano que no quedaba nada disponible.
 *
 * Sprint QA 3.1 (correccion de autorizacion): marcar una línea como "Merma
 * (no reingresa)" (`restock: false`) es, en la práctica, equivalente a
 * registrar una merma — por eso exige el mismo permiso `inventory.waste`
 * que gobierna esa acción desde Inventario, además de `returns.create`. El
 * backend es la autoridad final (`returns/controller.ts` rechaza la
 * petición si falta el permiso); aquí solo se oculta la opción para no
 * ofrecer una acción que el backend rechazaría.
 */
export function SaleReturnForm({ sale, onCancel, onSuccess }: SaleReturnFormProps) {
  const { mutate: createReturn, isPending, error } = useCreateReturn()
  const { hasPermission } = usePermissions()
  const canRegisterWaste = hasPermission(PERMISSIONS.INVENTORY_WASTE)

  const { data: openSessionsResponse, isLoading: isLoadingSession } = useCashSessions({
    status: 'OPEN',
  })
  const openCashSession = openSessionsResponse?.data[0] ?? null

  const { data: returnsResponse, isLoading: isLoadingReturns } = useSaleReturns(sale.id)
  const remainingByItemId = new Map(
    sale.items.map((item) => {
      const alreadyReturned = returnsResponse
        ? (sumReturnedQuantityByItemId(returnsResponse.data).get(item.id) ?? 0)
        : 0
      return [item.id, Math.max(0, item.quantity - alreadyReturned)]
    }),
  )

  const [lines, setLines] = useState<ReturnableLine[]>(
    sale.items.map((item) => ({
      saleItemId: item.id,
      productName: item.product.name,
      unitOfMeasure: item.product.unitOfMeasure,
      originalQuantity: item.quantity,
      unitPrice: item.unitPrice,
      selected: false,
      quantity: item.quantity,
      restock: true,
    })),
  )
  const [refundMethod, setRefundMethod] = useState<ReturnPaymentMethod>(sale.paymentMethod)
  const [reason, setReason] = useState('')

  const selectedLines = lines.filter((line) => line.selected)
  const total = selectedLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)

  const canSubmit =
    Boolean(openCashSession) &&
    !isLoadingReturns &&
    reason.trim().length > 0 &&
    selectedLines.length > 0 &&
    selectedLines.every(
      (line) => line.quantity > 0 && line.quantity <= (remainingByItemId.get(line.saleItemId) ?? 0),
    )

  const handleLineChange = (saleItemId: string, patch: Partial<ReturnableLine>) => {
    setLines((current) =>
      current.map((line) => (line.saleItemId === saleItemId ? { ...line, ...patch } : line)),
    )
  }

  const handleSubmit = () => {
    if (!canSubmit || !openCashSession) {
      return
    }

    createReturn(
      {
        saleId: sale.id,
        cashSessionId: openCashSession.id,
        reason: reason.trim(),
        refundMethod,
        items: selectedLines.map((line) => ({
          saleItemId: line.saleItemId,
          quantity: line.quantity,
          restock: line.restock,
        })),
      },
      {
        onSuccess: () => {
          onSuccess()
          // Bloque POS-08: evento puntual de exito, hoy silencioso (solo
          // cerraba este sub-flujo).
          toast.success('Devolución registrada correctamente')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Selecciona los productos a devolver de la venta{' '}
        <span className="font-semibold">{sale.documentNumber}</span>. La venta original no se
        modifica.
      </p>

      {!isLoadingSession && !openCashSession && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No hay una caja abierta. Es necesario abrir una caja para registrar el reembolso.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Productos
        </span>

        <div className="flex flex-col gap-2 rounded-xl border">
          {lines.map((line) => {
            const remaining = remainingByItemId.get(line.saleItemId) ?? 0
            const fullyReturned = !isLoadingReturns && remaining <= 0

            return (
              <div
                key={line.saleItemId}
                className="flex flex-wrap items-end gap-3 border-b p-3 last:border-b-0"
              >
                <div className="flex items-center gap-2.5 pb-1.5">
                  {/* Sin componente `Checkbox` compartido en el Design
                      System (confirmado, no existe) — input nativo con
                      estilo consistente, mismo criterio que el resto de
                      controles del formulario, sin crear un componente
                      compartido nuevo para un solo uso. */}
                  <input
                    type="checkbox"
                    checked={line.selected}
                    disabled={fullyReturned}
                    onChange={(event) =>
                      handleLineChange(line.saleItemId, {
                        selected: event.target.checked,
                        quantity: Math.min(line.quantity, remaining),
                      })
                    }
                    aria-label={`Devolver ${line.productName}`}
                    className="size-4 rounded border-input text-brand accent-brand"
                  />
                </div>

                <div className="flex min-w-40 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{line.productName}</span>
                  <span className="text-xs text-muted-foreground">
                    {fullyReturned
                      ? 'Ya devuelta en su totalidad'
                      : `Disponible para devolver: ${formatQuantity(remaining, line.unitOfMeasure)} de ${formatQuantity(line.originalQuantity, line.unitOfMeasure)} vendidas`}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[0.6875rem] text-muted-foreground">Cantidad</Label>
                  <Input
                    type="number"
                    step={getQuantityStep(line.unitOfMeasure)}
                    min={0}
                    max={remaining}
                    disabled={!line.selected || fullyReturned}
                    value={line.quantity}
                    onChange={(event) =>
                      handleLineChange(line.saleItemId, {
                        quantity: Number(event.target.value) || 0,
                      })
                    }
                    className="h-9 w-24"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[0.6875rem] text-muted-foreground">Destino</Label>
                  <Select
                    value={line.restock ? 'restock' : 'discard'}
                    onValueChange={(value: unknown) =>
                      handleLineChange(line.saleItemId, { restock: value === 'restock' })
                    }
                  >
                    <SelectTrigger
                      disabled={!line.selected || fullyReturned || !canRegisterWaste}
                      title={
                        canRegisterWaste
                          ? undefined
                          : 'Se requiere el permiso de mermas para marcar un producto como no reingresado.'
                      }
                      className="h-9 w-40 rounded-lg"
                    >
                      <SelectValue>
                        {(value: unknown) =>
                          value === 'restock' ? 'Vuelve a inventario' : 'Merma (no reingresa)'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restock">Vuelve a inventario</SelectItem>
                      {canRegisterWaste && (
                        <SelectItem value="discard">Merma (no reingresa)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1 text-right">
                  <Label className="text-[0.6875rem] text-muted-foreground">Subtotal</Label>
                  <span className="h-9 pt-1.5 text-sm font-semibold tabular-nums">
                    {formatCurrency(line.selected ? line.quantity * line.unitPrice : 0)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">
            Método de reembolso
          </Label>
          <Select
            value={refundMethod}
            onValueChange={(value: unknown) => setRefundMethod(value as ReturnPaymentMethod)}
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

        <div className="flex flex-col gap-1.5 text-right">
          <Label className="text-xs font-semibold text-muted-foreground">Total a devolver</Label>
          <span className="text-lg font-bold text-brand tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-4">
        <Label className="text-xs font-semibold text-destructive">
          Motivo de la devolución (obligatorio)
        </Label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          placeholder="Explica por qué se devuelve este producto..."
          aria-invalid={reason.trim().length === 0}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
      </div>

      {error && <ErrorAlert>{getReturnErrorMessage(error)}</ErrorAlert>}

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
          {isPending ? 'Registrando...' : 'Confirmar devolución'}
        </Button>
      </div>
    </div>
  )
}
