import { useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CircleDollarSign,
  DoorClosed,
  DoorOpen,
  History,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/Tabs'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelContent,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { useCashReportDetail } from '@/features/reports/hooks/useCashReportDetail'
import { CashSessionSummaryKpis } from '@/features/reports/components/CashSessionSummaryKpis'
import { useSales } from '@/features/sales/hooks/useSales'
import { SalesTable } from '@/features/sales/components/SalesTable'
import { SalesTableSkeleton } from '@/features/sales/components/SalesTableSkeleton'
import { SaleDetailDialog } from '@/features/sales/components/SaleDetailDialog'
import { CashArqueoPanel } from './CashArqueoPanel'
import { CashMovementForm } from './CashMovementForm'
import { CashMovementsTable } from './CashMovementsTable'
import { CashSessionAuditSection } from './CashSessionAuditSection'
import { useCashMovements } from '../hooks/useCashMovements'
import { deriveCashSessionInsights, formatElapsedSince, getArqueoResult } from '../utils/cashSessionInsights'

/** Ventas de una sesion de caja individual — mismo limite defensivo ya
 * usado en `CashSessionDetailPage.tsx` (retirado, ver `ROADMAP.md`). */
const SESSION_SALES_LIMIT = 500

/** Mismo par etiqueta/valor que `SaleDetailContent.tsx`/`PurchaseDetailPage.tsx`
 * — banda de identidad del detalle. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

interface TimelineStep {
  icon: typeof DoorOpen
  title: string
  subtitle: string
  date: string | null
  done: boolean
}

/**
 * Mejoras UX de Caja (aprobado, "Timeline de la sesión"): mismo lenguaje
 * visual que `SaleTimeline.tsx` (círculo + línea conectora + fecha/título/
 * subtítulo) — acá con 4 pasos FIJOS en vez de una lista dinámica de
 * eventos, porque el ciclo de una sesión de caja siempre es el mismo:
 * Apertura → Movimientos → Cierre → Arqueo. Ningún dato nuevo: los 4 pasos
 * se arman con `session`/`movementsCount`, ya cargados por
 * `CashSessionDetailContent`. Un paso todavía no alcanzado (sesión
 * abierta) se dibuja atenuado en vez de omitirse — el usuario ve de un
 * vistazo qué falta, no solo qué ya pasó.
 */
function CashSessionTimeline({
  session,
  movementsCount,
}: {
  session: { status: string; openedAt: string; openedBy: { fullName: string }; closedAt: string | null; closedBy: { fullName: string } | null; difference: number | null }
  movementsCount: number
}) {
  const isClosed = session.status !== 'OPEN'

  const steps: TimelineStep[] = [
    {
      icon: DoorOpen,
      title: 'Apertura',
      subtitle: session.openedBy.fullName,
      date: session.openedAt,
      done: true,
    },
    {
      icon: History,
      title: 'Movimientos',
      subtitle:
        movementsCount > 0
          ? `${movementsCount} movimiento${movementsCount === 1 ? '' : 's'}`
          : 'Sin movimientos',
      date: null,
      done: movementsCount > 0,
    },
    {
      icon: DoorClosed,
      title: 'Cierre',
      subtitle: isClosed ? (session.closedBy?.fullName ?? '—') : 'Pendiente',
      date: session.closedAt,
      done: isClosed,
    },
    {
      icon: CircleDollarSign,
      title: 'Arqueo',
      subtitle: isClosed ? getArqueoResult(session.difference).label : 'Pendiente',
      date: isClosed ? session.closedAt : null,
      done: isClosed && session.difference !== null,
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Línea de tiempo
      </span>
      <div className="flex flex-col rounded-xl border border-border/70 p-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <div key={step.title} className="relative flex gap-3 pb-4 pl-1 last:pb-0">
              {index < steps.length - 1 && (
                <span className="absolute top-6 left-[11px] h-full w-px bg-border" aria-hidden="true" />
              )}
              <span
                className={cn(
                  'z-10 flex size-6 shrink-0 items-center justify-center rounded-full',
                  step.done ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="flex flex-col gap-0.5 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold', !step.done && 'text-muted-foreground')}>
                    {step.title}
                  </span>
                  {step.date && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDateTime(step.date)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{step.subtitle}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface CashSessionDetailDrawerProps {
  /** Id de la sesión a mostrar. `null` mantiene el panel cerrado — mismo
   * criterio que `SaleDetailDialog.tsx`. */
  sessionId: string | null
  onOpenChange: (open: boolean) => void
}

/**
 * features/cashSession/components/CashSessionDetailDrawer.tsx
 * -----------------------------------------------------------------------------
 * Wireframe aprobado "Caja — Centro de Control": Drawer de detalle de una
 * sesión (abierta o cerrada) — mismo `WorkspacePanel` que Productos/Lotes,
 * mismo patrón de banda de identidad + hero + `Tabs` que
 * `SaleDetailContent.tsx`. Reemplaza a `CashSessionDetailPage.tsx`
 * (retirada, Reportes) sin duplicar ninguno de sus datos/hooks: mismo
 * `useCashReportDetail`, mismo `useSales`/`SalesTable`, mismo
 * `CashSessionAuditSection`.
 *
 * Único agregado real respecto a lo que existía: la pestaña "Movimientos"
 * y el panel de "Arqueo" (`CashArqueoPanel`, sin modificar) ahora también
 * se muestran para sesiones YA CERRADAS — antes solo eran visibles en vivo
 * durante el cierre (`OpenCashSessionPage.tsx`). Ambos datos ya existían
 * en el backend (`GET /cash/movements` acepta cualquier estado;
 * `CashReportItem.closingAmount/expectedAmount/difference` ya vienen en
 * la respuesta) — sin ningún endpoint ni cálculo nuevo. Para una sesión
 * cerrada, `countedAmount` pasa a ser `session.closingAmount` (ya fijo, no
 * editable) en vez de `null` — el mismo componente calcula la misma
 * diferencia que ya expone el backend, sin duplicarla a mano.
 */
export function CashSessionDetailDrawer({ sessionId, onOpenChange }: CashSessionDetailDrawerProps) {
  return (
    <WorkspacePanel open={Boolean(sessionId)} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="xl">
        {sessionId && <CashSessionDetailContent sessionId={sessionId} />}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}

function CashSessionDetailContent({ sessionId }: { sessionId: string }) {
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementDialogType, setMovementDialogType] = useState<'CASH_IN' | 'CASH_OUT' | undefined>(undefined)

  const { data, isLoading, isError, error } = useCashReportDetail(sessionId)
  const session = data?.data

  const { data: salesResponse, isLoading: isLoadingSales } = useSales(
    { cashSessionId: sessionId, limit: SESSION_SALES_LIMIT },
    { enabled: Boolean(sessionId) },
  )

  const { data: movementsResponse } = useCashMovements({ cashSessionId: sessionId, limit: 100 })
  const movements = movementsResponse?.data ?? []
  const insights = deriveCashSessionInsights(movements)

  if (isLoading) {
    return (
      <WorkspacePanelBody>
        <LoadingState message="Cargando sesión de caja..." />
      </WorkspacePanelBody>
    )
  }

  if (isError || !session) {
    return (
      <WorkspacePanelBody>
        <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar la sesión.'}</ErrorAlert>
      </WorkspacePanelBody>
    )
  }

  const isOpen = session.status === 'OPEN'
  const [openedDate, openedTime] = formatDateTime(session.openedAt).split(' ')
  const closedTime = session.closedAt ? formatDateTime(session.closedAt).split(' ')[1] : '—'
  const cashSalesTotal = session.paymentBreakdown.CASH.total
  const salesCount = salesResponse?.data.length ?? 0

  return (
    <>
      <WorkspacePanelHeader>
        <div className="flex items-center gap-2.5">
          <WorkspacePanelTitle>
            {session.cashRegister.name} — {session.sucursal.name}
          </WorkspacePanelTitle>
          <Badge variant={isOpen ? 'secondary' : 'muted'}>{isOpen ? 'Abierta' : 'Cerrada'}</Badge>
        </div>
      </WorkspacePanelHeader>

      <WorkspacePanelBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-6">
            <Field label="Caja" value={session.cashRegister.name} />
            <Field label="Sucursal" value={session.sucursal.name} />
            <Field label="Fecha" value={openedDate ?? '—'} />
            <Field label="Apertura" value={openedTime ?? '—'} />
            <Field label="Cierre" value={closedTime ?? '—'} />
            <Field label="Responsable" value={session.openedBy.fullName} />
          </div>

          {/* Mejoras UX de Caja (aprobado, "Hero dinámico del Drawer"): se
              adapta automáticamente al estado de la sesión — sin ningún
              cálculo nuevo, `formatElapsedSince`/`getArqueoResult` ya
              existían (compartidos con el Hero de `CashSessionsPage.tsx`
              y `CashSessionsTable.tsx` respectivamente). */}
          <div className="flex flex-col gap-1 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3 sm:min-w-52">
            {isOpen ? (
              <>
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand/80 uppercase">
                  <DoorOpen className="size-3.5" />
                  Caja abierta
                </span>
                <span className="text-2xl leading-tight font-bold tabular-nums text-brand sm:text-3xl">
                  {formatElapsedSince(session.openedAt)}
                </span>
                <span className="text-xs text-muted-foreground">Tiempo transcurrido</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand/80 uppercase">
                  <DoorClosed className="size-3.5" />
                  Caja cerrada
                </span>
                <span
                  className={cn(
                    'text-2xl leading-tight font-bold tabular-nums sm:text-3xl',
                    session.difference === 0
                      ? 'text-success'
                      : session.difference !== null && session.difference > 0
                        ? 'text-info'
                        : 'text-destructive',
                  )}
                >
                  {session.difference !== null
                    ? `${session.difference > 0 ? '+' : ''}${formatCurrency(session.difference)}`
                    : getArqueoResult(session.difference).label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getArqueoResult(session.difference).label} · Duración{' '}
                  {session.closedAt ? formatElapsedSince(session.openedAt, session.closedAt) : '—'}
                </span>
              </>
            )}
          </div>
        </div>

        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTab value="summary">Resumen</TabsTab>
            <TabsTab value="sales">Ventas{salesCount > 0 ? ` (${salesCount})` : ''}</TabsTab>
            <TabsTab value="movements">
              Movimientos{movements.length > 0 ? ` (${movements.length})` : ''}
            </TabsTab>
            <TabsTab value="audit">Auditoría</TabsTab>
          </TabsList>

          <TabsPanel value="summary" className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 divide-x divide-border rounded-xl border border-border/70 sm:grid-cols-3 lg:grid-cols-5">
              <CashSessionSummaryKpis session={session} bare />
            </div>
            <CashArqueoPanel
              openingAmount={session.openingAmount}
              cashSalesTotal={cashSalesTotal}
              totalIngresos={insights.totalIngresos}
              totalEgresos={insights.totalEgresos}
              countedAmount={isOpen ? null : session.closingAmount}
            />

            <CashSessionTimeline session={session} movementsCount={movements.length} />
          </TabsPanel>

          <TabsPanel value="sales" className="pt-4">
            {isLoadingSales ? (
              <SalesTableSkeleton />
            ) : (
              <SalesTable sales={salesResponse?.data ?? []} onSelectSale={setSelectedSaleId} />
            )}
          </TabsPanel>

          <TabsPanel value="movements" className="flex flex-col gap-3 pt-4">
            {isOpen && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setMovementDialogType('CASH_IN')
                    setIsMovementDialogOpen(true)
                  }}
                >
                  <ArrowDownCircle className="size-3.5" />
                  Registrar ingreso
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setMovementDialogType('CASH_OUT')
                    setIsMovementDialogOpen(true)
                  }}
                >
                  <ArrowUpCircle className="size-3.5" />
                  Registrar egreso
                </Button>
              </div>
            )}
            <CashMovementsTable movements={movements} />
          </TabsPanel>

          <TabsPanel value="audit" className="pt-4">
            <CashSessionAuditSection cashSessionId={sessionId} />
          </TabsPanel>
        </Tabs>
      </WorkspacePanelBody>

      <SaleDetailDialog
        saleId={selectedSaleId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSaleId(null)
          }
        }}
      />

      {isOpen && (
        <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Movimiento de caja</DialogTitle>
              <DialogDescription>
                Registra un ingreso o egreso de efectivo en la sesión actual.
              </DialogDescription>
            </DialogHeader>

            <CashMovementForm
              open={isMovementDialogOpen}
              cashSessionId={sessionId}
              initialType={movementDialogType}
              onSuccess={() => setIsMovementDialogOpen(false)}
            />

            <DialogFooter className="border-t pt-4">
              <DialogClose
                render={
                  <Button type="button" variant="ghost" size="sm">
                    Cancelar
                  </Button>
                }
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
