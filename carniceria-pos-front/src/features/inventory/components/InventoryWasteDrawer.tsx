import { useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelFooter,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatQuantity } from '@/utils/formatQuantity'
import { WASTE_REASON_OPTIONS } from '../constants/wasteReason.constants'
import { useDeleteInventoryWaste } from '../hooks/useDeleteInventoryWaste'
import { useInventoryWaste } from '../hooks/useInventoryWaste'

interface InventoryWasteDrawerProps {
  /** Id de la merma a mostrar. `null` mantiene el panel cerrado — mismo
   * criterio id-como-estado que ya usaba `InventoryWasteDetailDialog.tsx`. */
  wasteId: string | null
  onOpenChange: (open: boolean) => void
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
 * features/inventory/components/InventoryWasteDrawer.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — reemplaza a `InventoryWasteDetailDialog.tsx`
 * (`Dialog` genérico) por el mismo patrón `WorkspacePanel` (Drawer) ya
 * usado en Proveedores/Promociones, sin tocar la lógica: mismo
 * `useInventoryWaste(wasteId)`, mismos campos mostrados, mismo criterio
 * `wasteId: string | null` como estado de apertura.
 *
 * Bloque "Eliminación de Mermas" (aprobado): "Eliminar merma" en el
 * footer, gateado por `user?.role === 'ADMIN'` (mismo criterio de chequeo
 * por rol que `InventoryWasteTable.tsx`/`PurchaseDetailPage.tsx`). Al
 * confirmar, cierra el Drawer (`onOpenChange(false)`) — el registro ya no
 * existe, no tiene sentido dejarlo abierto mostrando datos borrados.
 */
export function InventoryWasteDrawer({ wasteId, onOpenChange }: InventoryWasteDrawerProps) {
  const { data: waste, isLoading, isError, error } = useInventoryWaste(wasteId ?? '')

  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'ADMIN'
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const { mutate: deleteWaste, isPending: isDeleting } = useDeleteInventoryWaste()

  const handleConfirmDelete = () => {
    if (!wasteId) return

    deleteWaste(wasteId, {
      onSuccess: () => {
        toast.success('Registro de merma eliminado correctamente.')
        setConfirmingDelete(false)
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error(error.message ?? 'Ocurrió un error al eliminar la merma.')
      },
    })
  }

  const reasonLabel = waste
    ? (WASTE_REASON_OPTIONS.find((option) => option.value === waste.reason)?.label ?? waste.reason)
    : ''

  return (
    <WorkspacePanel open={Boolean(wasteId)} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {isLoading && (
          <div className="p-6">
            <LoadingState message="Cargando detalle de la merma..." />
          </div>
        )}

        {isError && (
          <div className="p-6">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar la merma.'}</ErrorAlert>
          </div>
        )}

        {waste && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Trash2 className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {waste.product.name}
                </WorkspacePanelTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {formatDateTime(waste.createdAt)}
                </p>
              </div>
              <Badge variant="muted">{reasonLabel}</Badge>
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section className="rounded-xl border border-destructive/15 bg-destructive/5 p-4">
                <p className="mb-1 text-xs font-semibold tracking-wide text-destructive/70 uppercase">
                  Resumen
                </p>
                <p className="text-sm text-foreground">
                  Se dieron de baja {formatQuantity(waste.quantity, waste.product.unitOfMeasure)} de{' '}
                  {waste.product.name} — {reasonLabel.toLowerCase()}.
                </p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Cantidad"
                    value={formatQuantity(waste.quantity, waste.product.unitOfMeasure)}
                  />
                  <InfoRow label="Costo unitario" value={formatCurrency(waste.unitValue)} />
                  <InfoRow label="Valor total" value={formatCurrency(waste.totalValue)} />
                  {waste.product.sku && <InfoRow label="SKU" value={waste.product.sku} />}
                  <InfoRow label="Usuario" value={waste.user.fullName} />
                  <InfoRow label="Sucursal" value={waste.sucursal.name} />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Origen y trazabilidad
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Tipo"
                    value={
                      waste.sourceReturnItemId ? (
                        <Badge variant="accent">Devolución de venta</Badge>
                      ) : (
                        <Badge variant="muted">Registro manual</Badge>
                      )
                    }
                  />
                  {waste.sourceReturnItemId && (
                    <InfoRow
                      label="Línea de devolución"
                      value={<span className="font-mono text-xs">{waste.sourceReturnItemId}</span>}
                    />
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Observaciones
                </h3>
                <p className="text-sm text-foreground">{waste.notes ?? 'Sin observaciones.'}</p>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter className="items-center justify-between">
              {isAdmin ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmingDelete(true)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Eliminar merma
                </Button>
              ) : (
                <span />
              )}
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

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Eliminar registro de merma"
        description="Esta acción eliminará permanentemente este registro de merma. Utilizá esta opción únicamente cuando la merma haya sido registrada por error. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </WorkspacePanel>
  )
}
