import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  Layers3,
  Package,
  PackageMinus,
  Scale,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelFooter,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { StockStatusBadge } from '@/components/common/StockStatusBadge'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatQuantity, roundToUnitPrecision } from '@/utils/formatQuantity'
import { useProductLastPurchase } from '@/features/purchases/hooks/useProductLastPurchase'
import { useProductLastSale } from '@/features/products/hooks/useProductLastSale'
import { InventoryAdjustForm } from './InventoryAdjustForm'
import { InventoryContextPanel } from './InventoryContextPanel'
import { useInventoryWastes } from '../hooks/useInventoryWastes'
import type { Inventory, UpdateInventoryDto } from '../types/inventory.types'

interface InventoryAdjustDrawerProps {
  /** Fila de inventario a ajustar. `null` cierra el panel — mismo criterio
   * `id-como-estado` ya usado en `BatchDrawer.tsx`/`InventoryWasteDrawer.tsx`. */
  item: Inventory | null
  onOpenChange: (open: boolean) => void
  isSubmitting?: boolean
  onSubmit: (values: UpdateInventoryDto) => void
  /** Acción rápida "Crear merma" — el Drawer no abre su propio diálogo de
   * merma (esa lógica ya vive en `InventoryPage.tsx`, `InventoryWasteForm`
   * + mutación); solo pide que se abra para esta misma fila. Flujo de
   * conciliación (aprobado): acepta una cantidad opcional para prellenar
   * el formulario de merma con la diferencia detectada — mismo criterio
   * aditivo, la llamada de "Crear merma" (botón directo) sigue sin pasar
   * segundo argumento y se comporta exactamente igual que antes. */
  onRegisterWaste: (item: Inventory, prefillQuantity?: number) => void
}

/** Flujo de conciliación de inventario (aprobado): estado pendiente de
 * decisión mientras el diálogo de conciliación está abierto. */
interface PendingReconciliation {
  values: UpdateInventoryDto
  /** Diferencia YA REDONDEADA a la precisión que el usuario ve en
   * pantalla (`roundToUnitPrecision`, misma utilidad ya usada por
   * `InventoryWasteForm.tsx` para el mismo propósito: evitar que un
   * residuo de punto flotante dispare el diálogo quando el usuario no
   * cambió nada realmente). Positiva = sobra stock; negativa = falta. */
  diff: number
}

interface TimelineEntry {
  label: string
  date: string | null
  icon: typeof Truck
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const Icon = entry.icon
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-sm">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-muted-foreground">{entry.label}</span>
      <span className="font-medium text-foreground">{entry.date ? formatDateTime(entry.date) : '—'}</span>
    </div>
  )
}

/**
 * features/inventory/components/InventoryAdjustDrawer.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Inventario — reemplaza la navegación a
 * `/inventory/:id/adjust` (`InventoryAdjustPage.tsx`, página completa para
 * 2 campos) por un panel: mismo `InventoryAdjustForm.tsx` de siempre
 * (embebido tal cual, sin tocar su lógica/validación), más
 * `InventoryContextPanel.tsx` (contexto del producto) y una línea de
 * tiempo (última compra/venta/merma/ajuste) — todo reutilizando datos ya
 * existentes. La ruta `/inventory/:id/adjust` sigue existiendo (no se
 * elimina ninguna funcionalidad), simplemente deja de ser el camino
 * principal desde la tabla.
 *
 * "Último ajuste" de la línea de tiempo usa el mismo proxy honesto que
 * "Último movimiento" del panel de contexto (`Inventory.updatedAt` — no
 * existe un endpoint de movimientos consultable, ver hallazgo del bloque
 * de análisis).
 *
 * Centro de Control de Inventario (aprobado): "¿qué está pasando con este
 * producto?" se responde en el Hero — Existencia actual (protagonista,
 * mismo patrón que "Total comprado" en `SupplierCommercialCard.tsx`),
 * Punto de reorden, Estado (chip) y Último movimiento (el primer elemento
 * de la línea de tiempo ya calculada, la más reciente entre compra/venta/
 * merma/ajuste). Debajo: Actividad reciente (línea de tiempo completa),
 * y `InventoryContextPanel` (Lotes activos/Historial de mermas/
 * Información general).
 *
 * Flujo de conciliación de inventario (aprobado): reutiliza EXACTAMENTE
 * `InventoryAdjustForm`/`useUpdateInventory` (Ajuste) e
 * `InventoryWasteForm`/`POST /inventory/waste` (Merma) — no crea ningún
 * flujo nuevo, ninguna entidad de "conteo físico", ningún endpoint. Lo
 * único agregado es un paso de decisión ANTES de guardar: si la cantidad
 * que el usuario tipeó en "Cantidad y punto de reorden" difiere de
 * `item.quantity` (la existencia teórica, ya en memoria — comparación en
 * cliente, sin cálculo de negocio nuevo), `handleFormSubmit` intercepta
 * el submit y abre un diálogo de conciliación en vez de guardar de una:
 *  - "Registrar como Merma" → cierra este Drawer y delega en
 *    `onRegisterWaste(item, Math.abs(diff))` — el mismo callback/diálogo
 *    de merma de siempre, solo con la cantidad prellenada.
 *  - "Registrar como Ajuste" → continúa el submit real (`onSubmit`),
 *    exactamente como funcionaba antes de este bloque.
 *  - "Cancelar" → cierra el diálogo sin llamar a `onSubmit` ni a
 *    `onRegisterWaste`; no se muta nada.
 * Si la cantidad coincide (o el usuario solo cambió el punto de reorden),
 * `handleFormSubmit` llama a `onSubmit` directo — cero cambio de
 * comportamiento para ese caso.
 */
export function InventoryAdjustDrawer({
  item,
  onOpenChange,
  isSubmitting = false,
  onSubmit,
  onRegisterWaste,
}: InventoryAdjustDrawerProps) {
  const navigate = useNavigate()

  const [pendingReconciliation, setPendingReconciliation] = useState<PendingReconciliation | null>(null)

  const { data: lastPurchase } = useProductLastPurchase(item?.productId ?? '')
  const { data: lastSale } = useProductLastSale(item?.productId ?? '')
  const { data: wastesResponse } = useInventoryWastes(
    { productId: item?.productId ?? '', limit: 100 },
    { enabled: item !== null },
  )
  const lastWaste = [...(wastesResponse?.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0]

  const timeline: TimelineEntry[] = [
    { label: 'Última compra', date: lastPurchase?.lastPurchaseDate ?? null, icon: Truck },
    { label: 'Última venta', date: lastSale?.saleDate ?? null, icon: ShoppingCart },
    { label: 'Última merma', date: lastWaste?.createdAt ?? null, icon: PackageMinus },
    { label: 'Último ajuste', date: item?.updatedAt ?? null, icon: SlidersHorizontal },
  ].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  const handleViewBatches = () => {
    if (!item) return
    navigate(`/inventory/batches?productId=${item.productId}`)
  }

  const handleViewProduct = () => {
    if (!item) return
    navigate(`/products/${item.productId}/edit`)
  }

  const handleViewMovements = () => {
    toast.info('Todavía no existe un historial de movimientos consultable en el sistema.')
  }

  // Flujo de conciliación (aprobado): ver doc del componente arriba.
  const handleFormSubmit = (values: UpdateInventoryDto) => {
    if (!item || values.quantity === undefined) {
      onSubmit(values)
      return
    }

    const diff = roundToUnitPrecision(values.quantity - item.quantity, item.product.unitOfMeasure)
    if (diff === 0) {
      onSubmit(values)
      return
    }

    setPendingReconciliation({ values, diff })
  }

  const handleConfirmAsWaste = () => {
    if (!item || !pendingReconciliation) return
    onRegisterWaste(item, Math.abs(pendingReconciliation.diff))
    setPendingReconciliation(null)
  }

  const handleConfirmAsAdjustment = () => {
    if (!pendingReconciliation) return
    onSubmit(pendingReconciliation.values)
    setPendingReconciliation(null)
  }

  return (
    <>
    <WorkspacePanel open={item !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {item && (
          <>
            <WorkspacePanelHeader className="bg-muted/40 py-6">
              <WorkspacePanelTitle className="text-xl font-bold">Ajustar existencia</WorkspacePanelTitle>
              <p className="text-sm text-muted-foreground">
                {item.product.name} · {item.sucursal.name}
              </p>
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              {/* Hero — "¿qué está pasando con este producto?", ver doc arriba. */}
              <div className="flex flex-col gap-3 rounded-xl border border-brand/15 bg-brand/5 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/15">
                    <Boxes className="size-4" />
                  </div>
                  <span className="text-xs font-semibold tracking-wide text-brand/80 uppercase">
                    Existencia actual
                  </span>
                </div>
                <div className="text-3xl leading-tight font-bold tracking-tight text-brand tabular-nums sm:text-4xl">
                  {formatQuantity(item.quantity, item.product.unitOfMeasure)}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-brand/15 pt-3">
                  <div>
                    <p className="text-[0.6875rem] text-muted-foreground">Punto de reorden</p>
                    <p className="text-sm font-semibold text-foreground">
                      {item.reorderPoint !== null ? formatQuantity(item.reorderPoint, item.product.unitOfMeasure) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.6875rem] text-muted-foreground">Estado</p>
                    <StockStatusBadge
                      variant="chip"
                      quantity={item.quantity}
                      unitOfMeasure={item.product.unitOfMeasure}
                      reorderPoint={item.reorderPoint}
                      className="mt-0.5"
                    />
                  </div>
                  <div>
                    <p className="text-[0.6875rem] text-muted-foreground">Último movimiento</p>
                    <p className="text-sm font-semibold text-foreground">
                      {timeline[0]?.date ? formatDateTime(timeline[0].date) : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onRegisterWaste(item)} className="gap-2">
                  <PackageMinus className="size-4" />
                  Crear merma
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleViewBatches} className="gap-2">
                  <Layers3 className="size-4" />
                  Ver lotes
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleViewMovements} className="gap-2">
                  <CalendarClock className="size-4" />
                  Ver movimientos
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleViewProduct} className="gap-2">
                  <Package className="size-4" />
                  Ver producto
                </Button>
              </div>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Cantidad y punto de reorden
                </h3>
                <InventoryAdjustForm
                  product={item.product}
                  defaultValues={{ quantity: item.quantity, reorderPoint: item.reorderPoint }}
                  isSubmitting={isSubmitting}
                  onSubmit={handleFormSubmit}
                />
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Actividad reciente
                </h3>
                <div className="divide-y divide-border">
                  {timeline.map((entry) => (
                    <TimelineRow key={entry.label} entry={entry} />
                  ))}
                </div>
              </section>

              <InventoryContextPanel item={item} />
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

    {/* Diálogo de conciliación (aprobado) — ver doc del componente arriba. */}
    <Dialog open={pendingReconciliation !== null} onOpenChange={(open) => !open && setPendingReconciliation(null)}>
      <DialogContent>
        {item && pendingReconciliation && (
          <>
            <DialogHeader>
              <DialogTitle>Diferencia detectada</DialogTitle>
              <DialogDescription>
                El conteo físico de <span className="font-semibold text-foreground">{item.product.name}</span> no
                coincide con la existencia del sistema. Elegí cómo registrar la diferencia.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <div>
                <p className="text-[0.6875rem] text-muted-foreground">Sistema</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatQuantity(item.quantity, item.product.unitOfMeasure)}
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-muted-foreground">Conteo físico</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatQuantity(pendingReconciliation.values.quantity ?? item.quantity, item.product.unitOfMeasure)}
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-muted-foreground">Diferencia</p>
                <p
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    pendingReconciliation.diff < 0 ? 'text-destructive' : 'text-success',
                  )}
                >
                  {pendingReconciliation.diff > 0 ? '+' : ''}
                  {formatQuantity(pendingReconciliation.diff, item.product.unitOfMeasure)}
                  {item.quantity > 0 && (
                    <span className="ml-1 font-medium">
                      ({pendingReconciliation.diff > 0 ? '+' : ''}
                      {((pendingReconciliation.diff / item.quantity) * 100).toFixed(1)}%)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConfirmAsWaste}
                disabled={pendingReconciliation.diff > 0}
                className="flex items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors duration-150 hover:border-destructive/40 hover:bg-destructive/5 disabled:pointer-events-none disabled:opacity-50"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <PackageMinus className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Registrar como Merma</p>
                  <p className="text-xs text-muted-foreground">
                    {pendingReconciliation.diff > 0
                      ? 'No aplica: hay más stock del esperado, no una pérdida.'
                      : 'Producto vencido, deshidratado, dañado o pérdida real.'}
                  </p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={handleConfirmAsAdjustment}
                disabled={isSubmitting}
                className="flex items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors duration-150 hover:border-brand/40 hover:bg-brand/5 disabled:pointer-events-none disabled:opacity-50"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Scale className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {isSubmitting ? 'Guardando...' : 'Registrar como Ajuste'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Corrección administrativa, error de conteo o ajuste de inventario.
                  </p>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => setPendingReconciliation(null)}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
