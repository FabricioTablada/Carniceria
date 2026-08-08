import type { ReactNode } from 'react'
import { Layers3, Lock } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Can } from '@/components/common/Can'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { PERMISSIONS } from '@/constants/permissions'
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
import { formatQuantity } from '@/utils/formatQuantity'
import { formatBatchDate } from '../utils/batch.utils'
import { useBatch } from '../hooks/useBatch'
import { BatchStatusBadge } from './BatchStatusBadge'

interface BatchDrawerProps {
  /** Id del lote a mostrar. `null` mantiene el panel cerrado — mismo
   * criterio id-como-estado que `InventoryWasteDrawer.tsx`. */
  batchId: string | null
  onOpenChange: (open: boolean) => void
  /** Se dispara al presionar "Ajustar / Bloquear" — navega a la pagina de
   * ajuste (`BatchAdjustPage.tsx`). Opcional: sin `onAdjust`, el Drawer es
   * puramente de consulta. */
  onAdjust?: (batchId: string) => void
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * features/batches/components/BatchDrawer.tsx
 * -----------------------------------------------------------------------------
 * Consulta de detalle de un lote (LOTES-04). Mismo patron `WorkspacePanel`
 * (Drawer) ya usado en `InventoryWasteDrawer.tsx`: mismo `batchId: string |
 * null` como estado de apertura, mismo `useBatch(batchId)`.
 */
export function BatchDrawer({ batchId, onOpenChange, onAdjust }: BatchDrawerProps) {
  const { data: batch, isLoading, isError, error } = useBatch(batchId ?? '')

  return (
    <WorkspacePanel open={Boolean(batchId)} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {isLoading && (
          <div className="p-6">
            <LoadingState message="Cargando detalle del lote..." />
          </div>
        )}

        {isError && (
          <div className="p-6">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el lote.'}</ErrorAlert>
          </div>
        )}

        {batch && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Layers3 className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {batch.code}
                </WorkspacePanelTitle>
                <p className="truncate text-sm text-muted-foreground">{batch.product.name}</p>
              </div>
              <BatchStatusBadge status={batch.status} className="w-fit gap-1.5 py-1" />
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Producto
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Producto" value={batch.product.name} />
                  {batch.product.sku && <InfoRow label="SKU" value={batch.product.sku} />}
                  <InfoRow label="Sucursal" value={batch.sucursal.name} />
                  <InfoRow
                    label="Proveedor"
                    value={batch.supplier ? batch.supplier.name : '—'}
                  />
                  {batch.supplierLotCode && (
                    <InfoRow label="Lote del proveedor" value={batch.supplierLotCode} />
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Cantidades
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Cantidad inicial"
                    value={formatQuantity(batch.initialQuantity, batch.product.unitOfMeasure)}
                  />
                  <InfoRow
                    label="Cantidad disponible"
                    value={formatQuantity(batch.availableQuantity, batch.product.unitOfMeasure)}
                  />
                  <InfoRow label="Costo unitario" value={formatCurrency(batch.unitCost)} />
                  {batch.expectedWastePercent !== null && (
                    <InfoRow
                      label="% de merma esperado"
                      value={`${batch.expectedWastePercent}%`}
                    />
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Fechas
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Recepción" value={formatBatchDate(batch.receivedAt)} />
                  {batch.productionDate && (
                    <InfoRow label="Producción" value={formatBatchDate(batch.productionDate)} />
                  )}
                  <InfoRow label="Vencimiento" value={formatBatchDate(batch.expiryDate)} />
                  {batch.closedAt && (
                    <InfoRow label="Cierre" value={formatBatchDate(batch.closedAt)} />
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Trazabilidad
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Origen"
                    value={
                      batch.purchaseItemId ? (
                        <Badge variant="accent">Compra</Badge>
                      ) : (
                        <Badge variant="muted">Manual</Badge>
                      )
                    }
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Observaciones
                </h3>
                <p className="text-sm text-foreground">{batch.notes ?? 'Sin observaciones.'}</p>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter>
              <WorkspacePanelClose
                render={
                  <Button type="button" variant="outline">
                    Cerrar
                  </Button>
                }
              />
              {onAdjust && (
                <Can permission={PERMISSIONS.BATCHES_ADJUST}>
                  <Button type="button" className="gap-2" onClick={() => onAdjust(batch.id)}>
                    <Lock className="size-4" />
                    Ajustar / Bloquear
                  </Button>
                </Can>
              )}
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
