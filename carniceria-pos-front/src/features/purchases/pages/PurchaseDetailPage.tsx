import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Download, History, Layers3, Pencil, PackageCheck, Printer, ShieldAlert, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/common/EmptyState'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { useAuthStore } from '@/stores/authStore'
import { DocumentRenderer } from '@/features/documents/components/DocumentRenderer'
import { useDocumentDefinition } from '@/features/documents/hooks/useDocumentDefinition'
import { useAuditLogs } from '@/features/audit/hooks/useAuditLogs'
import { usePurchase } from '../hooks/usePurchase'
import { useUpdatePurchase } from '../hooks/useUpdatePurchase'
import { usePurchaseBatches } from '../hooks/usePurchaseBatches'
import { usePurchaseDocumentActions } from '../hooks/usePurchaseDocumentActions'
import { getPurchaseErrorMessage } from '../utils/purchaseErrors'
import { formatPurchaseDate } from '../utils/purchase.utils'
import { PurchaseStatusBadge } from '../components/PurchaseStatusBadge'
import { ReceivePurchaseDialog } from '../components/ReceivePurchaseDialog'
import type { Batch } from '@/features/batches/types/batch.types'
import type { AuditLog } from '@/features/audit/types/audit.types'
import type { PurchaseItem } from '../types/purchase.types'

/**
 * features/purchases/pages/PurchaseDetailPage.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Compras — detalle con pestañas de contexto (Resumen/
 * Productos/Lotes/Documento/Auditoría), en vez de una única tabla de solo
 * lectura. Sigue siendo una ruta dedicada (`/purchases/:id`), embebida en
 * `DashboardLayout`.
 *
 * Acciones nuevas: "Recibir compra" (visible solo en DRAFT, con vista
 * previa de consecuencias — `ReceivePurchaseDialog.tsx`) y "Cancelar
 * compra" (visible salvo en CANCELLED, `ConfirmDialog` compartido) — ambas
 * reutilizan el mismo `useUpdatePurchase`/`PATCH /purchases/:id` de
 * siempre, solo cambia `status`. Ninguna acción nueva de backend.
 *
 * Canvas Workspace (aprobado): identidad (Proveedor/Fecha/Estado) +
 * pestañas pasan a vivir dentro de UNA sola superficie
 * (`rounded-2xl border bg-card shadow-sm`), en vez de dos tarjetas
 * `bg-muted/25` sueltas — mismo contenedor que el resto del ERP. El
 * "TOTAL" (el indicador económico más importante de la compra) sube a un
 * bloque hero propio en la identidad, mismo tratamiento visual que
 * "Total comprado" en `SupplierCommercialCard.tsx`/"Existencia actual" en
 * `InventoryAdjustDrawer.tsx` — la pestaña Resumen mantiene el resto
 * exactamente igual (Subtotal/Impuestos/Documento/Notas), sin duplicar el
 * Total ahí. Ruta y lógica sin cambios; sigue siendo página, no Drawer
 * (ver docstring de `PurchasesPage.tsx`).
 */
export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const { data: purchase, isLoading, isError, error } = usePurchase(id ?? '')
  const { mutate: updatePurchase, isPending: isUpdating } = useUpdatePurchase()

  const { data: batches, isLoading: isLoadingBatches } = usePurchaseBatches(purchase)

  const { documentData, isDownloadingPdf, handlePrint, handleDownloadPdf } =
    usePurchaseDocumentActions(purchase)
  const { data: documentDefinition } = useDocumentDefinition('PURCHASE_ORDER')
  const capabilities = documentDefinition?.capabilities

  const isAdmin = user?.role === 'ADMIN'
  const { data: auditResponse, isLoading: isLoadingAudit } = useAuditLogs(
    isAdmin && id ? { entity: 'Purchase', entityId: id, limit: 50 } : { entityId: undefined },
  )

  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)

  const handleBack = () => navigate('/purchases')

  if (isLoading) {
    return <LoadingState message="Cargando compra..." />
  }

  if (isError) {
    return <ErrorAlert>{getPurchaseErrorMessage(error)}</ErrorAlert>
  }

  if (!purchase) {
    return <p className="text-sm text-muted-foreground">La compra no existe.</p>
  }

  const handleReceive = () => {
    updatePurchase(
      { id: purchase.id, dto: { status: 'RECEIVED' } },
      {
        onSuccess: () => {
          toast.success('Compra recibida correctamente.')
          setIsReceiveDialogOpen(false)
        },
        onError: (mutationError) => {
          toast.error(getPurchaseErrorMessage(mutationError))
        },
      },
    )
  }

  const handleCancel = () => {
    updatePurchase(
      { id: purchase.id, dto: { status: 'CANCELLED' } },
      {
        onSuccess: () => {
          toast.success('Compra cancelada.')
          setIsCancelDialogOpen(false)
        },
        onError: (mutationError) => {
          toast.error(getPurchaseErrorMessage(mutationError))
        },
      },
    )
  }

  const itemColumns: DataTableColumn<PurchaseItem>[] = [
    { header: 'Producto', render: (item) => item.product.name, className: 'font-medium' },
    {
      header: 'Cantidad',
      render: (item) => item.quantity,
      className: 'text-muted-foreground tabular-nums',
    },
    {
      header: 'Costo unitario',
      render: (item) => formatCurrency(item.unitCost),
      className: 'text-muted-foreground tabular-nums',
    },
    {
      header: 'Impuesto',
      render: (item) => (item.tax ? `${item.tax.name} (${item.taxRate}%)` : 'Sin impuesto'),
      className: 'text-muted-foreground tabular-nums',
    },
    {
      header: 'Subtotal',
      render: (item) => formatCurrency(item.lineSubtotal),
      className: 'text-muted-foreground tabular-nums',
    },
    {
      header: 'Total',
      render: (item) => formatCurrency(item.lineTotal),
      className: 'text-base font-bold tabular-nums text-brand',
    },
  ]

  const batchColumns: DataTableColumn<Batch>[] = [
    { header: 'Código', render: (batch) => batch.code, className: 'font-mono text-xs font-semibold' },
    { header: 'Producto', render: (batch) => batch.product.name, className: 'font-medium' },
    {
      header: 'Cantidad recibida',
      render: (batch) => batch.initialQuantity,
      className: 'text-muted-foreground tabular-nums',
    },
    {
      header: 'Disponible',
      render: (batch) => batch.availableQuantity,
      className: 'text-muted-foreground tabular-nums',
    },
    {
      header: 'Vence',
      render: (batch) => (batch.expiryDate ? formatPurchaseDate(batch.expiryDate) : '—'),
      className: 'text-muted-foreground',
    },
  ]

  const auditColumns: DataTableColumn<AuditLog>[] = [
    { header: 'Fecha', render: (log) => formatDateTime(log.createdAt), className: 'text-muted-foreground' },
    { header: 'Acción', render: (log) => log.action, className: 'font-medium' },
    { header: 'Usuario', render: (log) => log.user?.fullName ?? '—', className: 'text-muted-foreground' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Compras', href: '/purchases' },
          { label: purchase.documentNumber ?? purchase.id },
        ]}
        title={`Compra ${purchase.documentNumber ?? purchase.id}`}
        description="Detalle de la compra registrada en el sistema."
        action={
          <div className="flex items-center gap-2">
            {purchase.status === 'DRAFT' && (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsReceiveDialogOpen(true)}
                className="gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
              >
                <PackageCheck className="size-4" />
                Recibir compra
              </Button>
            )}
            {purchase.status !== 'CANCELLED' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCancelDialogOpen(true)}
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
              >
                <XCircle className="size-4" />
                Cancelar
              </Button>
            )}
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                className="gap-2"
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Volver a compras"
              className="rounded-xl"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Proveedor</span>
              <span className="text-sm">{purchase.supplier.name}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Fecha</span>
              <span className="text-sm">{formatPurchaseDate(purchase.purchaseDate)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Estado</span>
              <PurchaseStatusBadge status={purchase.status} className="w-fit gap-1.5 py-1" />
            </div>
          </div>

          {/* Hero "TOTAL" — mismo tratamiento visual que "Total comprado"
              (SupplierCommercialCard.tsx) / "Existencia actual"
              (InventoryAdjustDrawer.tsx): el indicador económico más
              importante de la compra, protagonista, no una línea más. */}
          <div className="flex flex-col gap-1 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3 sm:min-w-52">
            <span className="text-xs font-semibold tracking-wide text-brand/80 uppercase">Total</span>
            <span className="text-2xl leading-tight font-bold tracking-tight text-brand tabular-nums sm:text-3xl">
              {formatCurrency(purchase.total)}
            </span>
          </div>
        </div>

        <div className="p-5">
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTab value="summary">Resumen</TabsTab>
              <TabsTab value="products">Productos ({purchase.items.length})</TabsTab>
              <TabsTab value="batches">Lotes {batches.length > 0 ? `(${batches.length})` : ''}</TabsTab>
              <TabsTab value="document">Documento</TabsTab>
              <TabsTab value="audit">Auditoría</TabsTab>
            </TabsList>

            <TabsPanel value="summary" className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4 md:grid-cols-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Documento</span>
                  <span className="text-sm">{purchase.documentNumber ?? '—'}</span>
                </div>
                <div className="col-span-2 flex flex-col gap-1 md:col-span-3">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Notas</span>
                  <span className="text-sm text-muted-foreground">{purchase.notes ?? '—'}</span>
                </div>
              </div>

              <div className="ml-auto flex w-full max-w-xs flex-col gap-1.5 rounded-xl bg-muted/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(purchase.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Impuestos</span>
                  <span className="tabular-nums">{formatCurrency(purchase.taxTotal)}</span>
                </div>
              </div>
            </TabsPanel>

            <TabsPanel value="products">
              <DataTable
                columns={itemColumns}
                data={purchase.items}
                getRowKey={(item) => item.id}
                emptyMessage="Esta compra no tiene productos."
                tableClassName="border-border/60 shadow-sm"
                headerClassName="px-5 py-4 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
                cellClassName="px-5 py-4"
              />
            </TabsPanel>

            <TabsPanel value="batches">
              {isLoadingBatches && <p className="text-sm text-muted-foreground">Cargando lotes...</p>}
              {!isLoadingBatches && batches.length === 0 && (
                <EmptyState
                  icon={Layers3}
                  title="Sin lotes generados"
                  description="Esta compra todavía no generó lotes — ya sea porque ninguno de sus productos requiere trazabilidad de lote, o porque la compra todavía no fue recibida."
                />
              )}
              {!isLoadingBatches && batches.length > 0 && (
                <DataTable
                  columns={batchColumns}
                  data={batches}
                  getRowKey={(batch) => batch.id}
                  emptyMessage="Sin lotes."
                  tableClassName="border-border/60 shadow-sm"
                  headerClassName="px-5 py-4 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
                  cellClassName="px-5 py-4"
                />
              )}
            </TabsPanel>

            <TabsPanel value="document" className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handlePrint} disabled={!capabilities?.print}>
                  <Printer className="size-4" />
                  Imprimir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={!capabilities?.pdf || isDownloadingPdf}
                >
                  <Download className="size-4" />
                  {isDownloadingPdf ? 'Descargando...' : 'Descargar PDF'}
                </Button>
              </div>
              {documentData && <DocumentRenderer data={documentData} />}
            </TabsPanel>

            <TabsPanel value="audit">
              {!isAdmin && (
                <EmptyState
                  icon={ShieldAlert}
                  title="Solo para administradores"
                  description="El historial de auditoría está restringido a usuarios con rol de administrador."
                />
              )}
              {isAdmin && isLoadingAudit && <p className="text-sm text-muted-foreground">Cargando auditoría...</p>}
              {isAdmin && !isLoadingAudit && (auditResponse?.data.length ?? 0) === 0 && (
                <EmptyState
                  icon={History}
                  title="Sin registros de auditoría"
                  description="Todavía no hay eventos de auditoría asociados a esta compra."
                />
              )}
              {isAdmin && !isLoadingAudit && (auditResponse?.data.length ?? 0) > 0 && (
                <DataTable
                  columns={auditColumns}
                  data={auditResponse?.data ?? []}
                  getRowKey={(log) => log.id}
                  emptyMessage="Sin registros."
                  tableClassName="border-border/60 shadow-sm"
                  headerClassName="px-5 py-4 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
                  cellClassName="px-5 py-4"
                />
              )}
            </TabsPanel>
          </Tabs>
        </div>
      </div>

      <ReceivePurchaseDialog
        open={isReceiveDialogOpen}
        onOpenChange={setIsReceiveDialogOpen}
        purchase={purchase}
        onConfirm={handleReceive}
        isSubmitting={isUpdating}
      />

      <ConfirmDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        title="¿Cancelar esta compra?"
        description={
          purchase.status === 'RECEIVED'
            ? 'La compra pasará a estado Cancelada y se revertirá el stock/lotes que había acreditado. Esta acción no se puede deshacer desde aquí.'
            : 'La compra pasará a estado Cancelada. Esta acción no se puede deshacer desde aquí.'
        }
        confirmText="Sí, cancelar compra"
        cancelText="Volver"
        onConfirm={handleCancel}
        loading={isUpdating}
      />
    </div>
  )
}
