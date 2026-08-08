import { ClipboardList, Layers3, TrendingUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatCurrency } from '@/utils/formatCurrency'
import { PurchaseStatusTrack } from './PurchaseStatusTrack'
import type { PurchaseStatus } from '../types/purchase.types'

interface PurchaseSummaryProps {
  /** Suma de `quantity * unitCost` de todas las lineas, antes de impuestos. */
  subtotal: number
  /** Suma de impuesto de todas las lineas (segun el impuesto elegido en cada una). */
  taxTotal: number
  /** `subtotal + taxTotal`. El backend recalcula este mismo total al
   * confirmar la compra; esta vista es solo un preview en vivo, igual que
   * `CartSummary.tsx` en Sales. */
  total: number
  /** Sufijo descriptivo opcional para la fila "Impuestos", ej. "(IVA 13%)"
   * — solo se arma cuando todas las lineas comparten el mismo impuesto
   * (`PurchaseForm.tsx` decide cuando pasarlo). Puramente informativo: no
   * cambia `taxTotal` ni ningun otro numero, solo el texto del label. */
  taxLabel?: string
  /** Rediseño de Compras — panel lateral inteligente: nombre del proveedor
   * elegido, o `undefined` si todavía no se eligió ninguno. */
  supplierName?: string
  status: PurchaseStatus | undefined
  lineCount: number
  /** Cantidad de líneas cuyo producto tiene `Product.requiresBatch` — ya
   * resuelto por `PurchaseForm.tsx` cruzando `items` con los productos ya
   * cargados (`useProducts`), sin ninguna consulta nueva. */
  batchCount: number
  /** Cantidad de líneas cuyo costo unitario actual difiere del de la
   * última compra conocida de ese producto (`useProductLastPurchase.ts`,
   * misma ventana de datos que ya usa el resto del módulo). `undefined`
   * mientras no hay líneas o no hay datos suficientes todavía. */
  costWarningCount?: number
}

/**
 * features/purchases/components/PurchaseSummary.tsx
 * -----------------------------------------------------------------------------
 * Panel lateral inteligente del rediseño de Compras: además del resumen de
 * totales de siempre (Subtotal/Impuestos/Total), muestra en todo momento
 * proveedor/estado/líneas/lotes a crear/indicador de costo — la información
 * que antes solo se veía completando el formulario entero o abriendo el
 * diálogo de confirmación. Se actualiza en cada render porque
 * `PurchaseForm.tsx` ya recalcula todo esto desde `items` con `useWatch`,
 * sin ningún estado ni fetch propio de este componente — sigue siendo
 * puramente de presentación.
 */
export function PurchaseSummary({
  subtotal,
  taxTotal,
  total,
  taxLabel,
  supplierName,
  status,
  lineCount,
  batchCount,
  costWarningCount,
}: PurchaseSummaryProps) {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-brand" />
          Resumen de compra
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-4 pt-0 pb-4">
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Proveedor</span>
            <span className="max-w-40 truncate text-right font-medium">{supplierName ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estado</span>
            <PurchaseStatusTrack status={status} className="text-xs" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Líneas</span>
            <span className="font-medium tabular-nums">{lineCount}</span>
          </div>
          {batchCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Layers3 className="size-3.5" />
                Lotes a crear al recibir
              </span>
              <span className="font-medium tabular-nums">{batchCount}</span>
            </div>
          )}
          {!!costWarningCount && costWarningCount > 0 && (
            <div className="flex items-center justify-between text-warning">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="size-3.5" />
                Costo distinto a la última compra
              </span>
              <span className="font-medium tabular-nums">{costWarningCount}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Impuestos{taxLabel ? ` (${taxLabel})` : ''}
          </span>
          <span className="font-medium tabular-nums">{formatCurrency(taxTotal)}</span>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-base font-semibold">TOTAL</span>
          <span className="text-2xl font-bold tabular-nums text-brand">
            {formatCurrency(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
