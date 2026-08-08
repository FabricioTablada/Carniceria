import type { ReactNode } from 'react'
import { Receipt } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Button } from '@/components/ui/button'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelFooter,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { PAYMENT_METHOD_OPTIONS } from '../utils/payment'
import type { Sale } from '../types/sale.types'

interface SaleMiniDetailPanelProps {
  /** Venta a mostrar, ya cargada por quien lo use (`SessionSalesDialog.tsx`
   * la resuelve de `visibleSales`, sin ninguna peticion nueva). `null`
   * cierra el panel — mismo criterio que `ProductDrawer.tsx`
   * (`open={product !== null}`). */
  sale: Sale | null
  onOpenChange: (open: boolean) => void
}

/** Local a este archivo — mismo criterio ya usado en el resto de los
 * Drawers/paneles de vista rapida del proyecto (`ProductDrawer.tsx`,
 * `PromotionsAvailableDialog.tsx`): cada consumidor declara su propia
 * fila label/valor, no existe un `InfoRow` compartido. */
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completada',
  CANCELLED: 'Anulada',
  REFUNDED: 'Reembolsada',
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  REFUNDED: 'muted',
}

/**
 * features/sales/components/SaleMiniDetailPanel.tsx
 * -----------------------------------------------------------------------------
 * Bloque POS-06: vista rapida de una venta, puramente presentacional — NO
 * hace ninguna peticion propia (a diferencia de `SaleDetailContent.tsx`,
 * que se autoalimenta con `useSale(saleId)`). Recibe el `Sale` COMPLETO ya
 * cargado por quien lo use, mismo criterio que `ProductDrawer.tsx` recibe
 * `Product` ya cargado por `ProductsPage.tsx`/`ProductsTable.tsx`.
 *
 * Funcionalidad ADICIONAL, no un reemplazo: el flujo existente ("Ver" en
 * `SalesTable.tsx` -> `SaleDetailContent.tsx` completo, con Anular/
 * Corregir/Devolver) sigue exactamente igual, sin tocarse. Este panel no
 * ofrece ninguna de esas acciones — es solo un vistazo rapido (folio,
 * fecha, cajero, metodo de pago, items, promociones aplicadas, total),
 * mismo lenguaje visual (`WorkspacePanel`/`InfoRow`) que ya usan
 * Productos/Inventario/Promociones.
 */
export function SaleMiniDetailPanel({ sale, onOpenChange }: SaleMiniDetailPanelProps) {
  return (
    <WorkspacePanel open={sale !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {sale && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Receipt className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {sale.documentNumber ?? 'Sin número de documento'}
                </WorkspacePanelTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {formatDateTime(sale.saleDate)}
                </p>
              </div>
              <Badge
                variant={STATUS_VARIANTS[sale.status] ?? 'muted'}
                className="w-24 min-w-24 shrink-0 justify-center gap-1.5 py-1"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-current" />
                {STATUS_LABELS[sale.status] ?? sale.status}
              </Badge>
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section className="rounded-xl border border-brand/15 bg-brand/5 p-4">
                <p className="text-xs font-semibold tracking-wide text-brand/70 uppercase">Total</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-brand">
                  {formatCurrency(sale.total)}
                </p>
                <div className="mt-3 flex items-center gap-4 border-t border-brand/15 pt-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(sale.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Impuestos</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(sale.taxTotal)}
                    </span>
                  </div>
                  {sale.discountTotal > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatCurrency(sale.discountTotal)}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Información general
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Cajero" value={sale.user.fullName} />
                  <InfoRow label="Sucursal" value={sale.sucursal.name} />
                  <InfoRow
                    label="Método de pago"
                    value={
                      PAYMENT_METHOD_OPTIONS.find((option) => option.value === sale.paymentMethod)
                        ?.label ?? sale.paymentMethod
                    }
                  />
                  {sale.paymentReference && (
                    <InfoRow label="Referencia de pago" value={sale.paymentReference} />
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Productos ({sale.items.length})
                </h3>
                <div className="divide-y divide-border">
                  {sale.items.map((item) => (
                    <InfoRow
                      key={item.id}
                      label={`${item.quantity} × ${item.product.name}`}
                      value={formatCurrency(item.lineTotal)}
                    />
                  ))}
                </div>
              </section>

              {sale.appliedPromotions.length > 0 && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Promociones aplicadas
                  </h3>
                  <div className="divide-y divide-border">
                    {sale.appliedPromotions.map((promotion) => (
                      <InfoRow
                        key={promotion.id}
                        label={promotion.promotionNameSnapshot}
                        value={formatCurrency(promotion.amountApplied)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </WorkspacePanelBody>

            <WorkspacePanelFooter>
              <WorkspacePanelClose
                render={
                  <Button type="button" variant="outline">
                    Cerrar
                  </Button>
                }
              />
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
