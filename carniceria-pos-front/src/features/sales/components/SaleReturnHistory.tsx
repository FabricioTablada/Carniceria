import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { LoadingState } from '@/components/ui/LoadingState'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatQuantity } from '@/utils/formatQuantity'
import { useSaleReturns } from '@/features/returns/hooks/useSaleReturns'
import { sumReturnedQuantityByItemId } from '@/features/returns/utils/returnedQuantity'
import { PAYMENT_METHOD_OPTIONS } from '../utils/payment'
import type { Sale } from '../types/sale.types'

interface SaleReturnHistoryProps {
  sale: Sale
}

type ReturnStatus = 'NONE' | 'PARTIAL' | 'FULL'

const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  NONE: 'Sin devoluciones',
  PARTIAL: 'Parcialmente devuelta',
  FULL: 'Totalmente devuelta',
}

const RETURN_STATUS_VARIANTS: Record<ReturnStatus, BadgeVariant> = {
  NONE: 'muted',
  PARTIAL: 'secondary',
  FULL: 'accent',
}

/**
 * features/sales/components/SaleReturnHistory.tsx
 * -----------------------------------------------------------------------------
 * Bloque 4.4 ("hacer visibles las devoluciones ya registradas"). Puramente
 * informativo: no crea ni modifica ninguna devolución — solo lee, con
 * `useSaleReturns` (Bloque 4.4, reutiliza `GET /returns` ya construido en
 * el Bloque 4.2, filtrado por `saleId`).
 *
 * El estado (Sin/Parcialmente/Totalmente devuelta) se calcula en el
 * cliente comparando, por línea, la cantidad devuelta acumulada (sumada
 * de todas las devoluciones ya traídas) contra `sale.items[].quantity`
 * original — sin ningún cálculo nuevo en el backend.
 */
export function SaleReturnHistory({ sale }: SaleReturnHistoryProps) {
  const { data, isLoading, isError } = useSaleReturns(sale.id)
  const returns = data?.data ?? []

  if (isLoading) {
    return <LoadingState message="Cargando historial de devoluciones..." />
  }

  if (isError) {
    return null
  }

  const returnedQuantityByItemId = sumReturnedQuantityByItemId(returns)

  const status: ReturnStatus =
    returns.length === 0
      ? 'NONE'
      : sale.items.every(
            (item) => (returnedQuantityByItemId.get(item.id) ?? 0) >= item.quantity,
          )
        ? 'FULL'
        : 'PARTIAL'

  const productNameBySaleItemId = new Map(
    sale.items.map((item) => [item.id, { name: item.product.name, unitOfMeasure: item.product.unitOfMeasure }]),
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Devoluciones
        </span>
        <Badge variant={RETURN_STATUS_VARIANTS[status]}>{RETURN_STATUS_LABELS[status]}</Badge>
      </div>

      {returns.length > 0 && (
        <div className="flex flex-col gap-2">
          {returns.map((saleReturn) => {
            const [date, time] = formatDateTime(saleReturn.createdAt).split(' ')
            const refundMethodLabel =
              PAYMENT_METHOD_OPTIONS.find((option) => option.value === saleReturn.refundMethod)
                ?.label ?? saleReturn.refundMethod

            return (
              <div key={saleReturn.id} className="flex flex-col gap-2 rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-semibold">
                      {date} · {time}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Procesada por {saleReturn.user.fullName}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-brand tabular-nums">
                      {formatCurrency(saleReturn.totalAmount)}
                    </span>
                    <span className="text-xs text-muted-foreground">{refundMethodLabel}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Motivo: <span className="text-foreground">{saleReturn.reason}</span>
                </p>

                <ul className="flex flex-col gap-1">
                  {saleReturn.items.map((item) => {
                    const product = productNameBySaleItemId.get(item.saleItemId)

                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate">
                          {product?.name ?? 'Producto'} —{' '}
                          {formatQuantity(item.quantity, product?.unitOfMeasure ?? 'UNIT')}
                        </span>
                        <Badge variant={item.restock ? 'secondary' : 'muted'}>
                          {item.restock ? 'Inventario' : 'Merma'}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
