import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDownCircle,
  Banknote,
  Coins,
  DoorClosed,
  Scale,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KpiCard } from '@/components/common/KpiCard'
import { PageHeader } from '@/components/common/PageHeader'
import { Toolbar } from '@/components/common/Toolbar'
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
import { Pagination } from '@/components/ui/Pagination'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelContent,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
  WorkspacePanelDescription,
} from '@/components/ui/WorkspacePanel'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { useCashRegisters } from '@/features/cashRegisters/hooks/useCashRegisters'
import { useCashReport } from '@/features/reports/hooks/useCashReport'
import { useCashReportDetail } from '@/features/reports/hooks/useCashReportDetail'
import { useCashReportSummary } from '@/features/reports/hooks/useCashReportSummary'
import { useReportMemoryPagination, useReportMemoryState } from '@/features/reports/hooks/useReportMemoryState'
import { CashSessionFilters } from '@/features/reports/components/CashSessionFilters'
import { useUsers } from '@/features/users/hooks/useUsers'
import { CashMovementForm } from '../components/CashMovementForm'
import { CashSessionDetailDrawer } from '../components/CashSessionDetailDrawer'
import { CashSessionsTable } from '../components/CashSessionsTable'
import { OpenCashSessionForm } from '../components/OpenCashSessionForm'
import { useCashMovements } from '../hooks/useCashMovements'
import { useCashSessions } from '../hooks/useCashSessions'
import { useCashSessionStore } from '../store/cashSessionStore'
import { deriveCashSessionInsights, formatElapsedSince } from '../utils/cashSessionInsights'
import type { CashReportFilters } from '@/features/reports/types/report.types'

/** Mismo par etiqueta/valor que `SaleDetailContent.tsx`/`PurchaseDetailPage.tsx`
 * — banda de identidad del Hero de sesión activa. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

/**
 * features/cashSession/pages/CashSessionsPage.tsx
 * -----------------------------------------------------------------------------
 * Wireframe aprobado "Caja — Centro de Control de efectivo": reemplaza a
 * `OpenCashSessionPage.tsx` como destino de `/cash-session/open` (misma
 * ruta, mismo item de navegación "Caja" — sin cambios de ruteo). Única
 * fuente de verdad para sesiones de caja del ERP: la tabla de historial
 * que antes vivía en Reportes (`CashReportPage.tsx`/`CashSessionCard.tsx`,
 * retirados) ahora vive acá, como la franja principal de este mismo Canvas
 * Workspace — no dos pantallas mostrando lo mismo.
 *
 * Mismo Canvas Workspace que Productos/Compras/Ventas: Hero de sesión
 * activa (solo si hay una) + KPI strip (bare) + Toolbar (`CashSessionFilters`,
 * reutilizado tal cual de Reportes) + `CashSessionsTable` (DataTable con
 * `sortValue`) + paginación. La sesión abierta es una fila más de la
 * tabla — no una pantalla aparte; "Abrir caja"/"Ver sesión" abren paneles
 * (`WorkspacePanel`), nunca reemplazan esta página.
 *
 * `?session=<id>` (query param): si llega con un id, abre el Drawer de esa
 * sesión automáticamente al montar — usado por los redirects de
 * `/reports/cash/:id` y por los links existentes del POS/notificaciones
 * que apuntaban a esa ruta (sin tocar esos `onClick`/`navigate`).
 *
 * Mejoras UX (aprobado, "Hero de Sesión Activa"/"KPI inteligente"):
 *  - Hero: misma banda de identidad (`Field` + caja hero a la derecha) que
 *    `SaleDetailContent.tsx`/`PurchaseDetailPage.tsx` — Caja/Cajero/Hora de
 *    apertura/Tiempo transcurrido (`formatElapsedSince`, movido a
 *    `cashSessionInsights.ts` para compartirse con el Drawer) a la
 *    izquierda, Total vendido/Efectivo esperado a la derecha. "Efectivo
 *    esperado" usa la MISMA fórmula que `CashArqueoPanel.tsx`
 *    (apertura + ventas en efectivo + ingresos − egresos), ningún cálculo
 *    nuevo. Acciones (Ver detalle/Registrar movimiento/Cerrar caja) viven
 *    acá — ya no se repiten en `PageHeader`, que ahora solo conserva "Ir
 *    al POS"/"Abrir caja".
 *  - KPI strip: reemplaza a `CashReportKpiRow.tsx` (retirado junto con
 *    `CashReportPage.tsx`) — mismo `useCashReportSummary` de siempre,
 *    ahora vive acá. Primera tarjeta contextual: "Caja activa" (con el
 *    nombre de la caja en curso) cuando hay una sesión abierta, "Sesiones"
 *    (el conteo del histórico filtrado) cuando no la hay — mismos datos ya
 *    cargados en la página, sin condición de negocio nueva.
 */
export function CashSessionsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const setCashSessionId = useCashSessionStore((state) => state.setCashSessionId)

  // Bloque 7.31: valor inicial por defecto pasa de 'CLOSED' a 'OPEN' — el
  // flujo principal del usuario durante la operacion diaria es ver la caja
  // ABIERTA (turno en curso), no el historico de cerradas. Solo cambia el
  // valor inicial del filtro; `CashSessionFilters.tsx`/`useCashReport` no
  // se tocan, el usuario sigue pudiendo elegir cualquier estado despues.
  const [filters, setFilters] = useReportMemoryState<CashReportFilters>(
    'cash-sessions-page-filters',
    { status: 'OPEN' },
  )
  const { page, setPage, resetPage } = useReportMemoryPagination('cash-sessions-page-page')

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    () => searchParams.get('session'),
  )
  const [isOpenPanelOpen, setIsOpenPanelOpen] = useState(false)
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementDialogType, setMovementDialogType] = useState<'CASH_IN' | 'CASH_OUT' | undefined>(undefined)

  // Consume el query param una sola vez (al entrar desde un link externo,
  // ej. "Ver corte completo" del POS) — no vuelve a sincronizarse en cada
  // render, el Drawer pasa a manejar su propio ciclo de vida con
  // `selectedSessionId` de acá en adelante.
  useEffect(() => {
    if (searchParams.has('session')) {
      const next = new URLSearchParams(searchParams)
      next.delete('session')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: openSessionsResponse, isLoading: isLoadingOpenSession } = useCashSessions({
    status: 'OPEN',
  })
  const openCashSession = openSessionsResponse?.data[0] ?? null

  useEffect(() => {
    if (openCashSession) {
      setCashSessionId(openCashSession.id)
    }
  }, [openCashSession, setCashSessionId])

  const { data: cashRegistersResponse } = useCashRegisters({ active: true })
  const cashRegisters = (cashRegistersResponse?.data ?? []).map((register) => ({
    id: register.id,
    name: register.name,
  }))

  const { data: usersResponse } = useUsers({ active: true })
  const users = (usersResponse?.data ?? []).map((user) => ({
    id: user.id,
    name: user.fullName,
  }))

  const { data: sessionDetailResponse } = useCashReportDetail(openCashSession?.id ?? '', {
    enabled: Boolean(openCashSession),
  })
  const sessionDetail = sessionDetailResponse?.data

  // Hero de sesión activa: mismo hook/util ya usados antes en
  // `OpenCashSessionPage.tsx` para calcular "Efectivo esperado" — sin
  // ningún cálculo nuevo.
  const { data: movementsResponse } = useCashMovements(
    openCashSession ? { cashSessionId: openCashSession.id, limit: 100 } : undefined,
  )
  const insights = deriveCashSessionInsights(movementsResponse?.data ?? [])
  // QA Final 1.0 (End-to-End): `paymentBreakdown.CASH.total` solo suma
  // ventas con `paymentMethod === 'CASH'` puro — una venta `MIXED` (pago
  // mixto) no tiene, en el modelo de datos actual (`Sale`, backend), ningun
  // campo que registre CUANTO de ese pago fue efectivo vs. tarjeta/SINPE
  // (`sales/validation.ts` documenta esto explicitamente: "un pago mixto no
  // tiene una unica referencia bien definida y queda fuera de este
  // alcance"). Riesgo conocido, documentado, NO corregido en este QA
  // (requeriria un campo nuevo en `Sale` + logica de negocio nueva sobre
  // como se registra/valida ese desglose — fuera de alcance de un QA sin
  // cambios de arquitectura): el efectivo esperado de una sesion con ventas
  // mixtas puede quedar por debajo del efectivo real recibido.
  const cashSalesTotal = sessionDetail?.paymentBreakdown.CASH.total ?? 0
  const expectedAmount = openCashSession
    ? openCashSession.openingAmount + cashSalesTotal + insights.totalIngresos - insights.totalEgresos
    : 0

  const { data, isLoading, isFetching, isError, error } = useCashReport({ ...filters, page })
  const { data: summary } = useCashReportSummary(filters)

  const handleFiltersChange = (nextFilters: CashReportFilters) => {
    setFilters(nextFilters)
    resetPage()
  }

  const openMovementDialog = (type?: 'CASH_IN' | 'CASH_OUT') => {
    setMovementDialogType(type)
    setIsMovementDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Caja' }]}
        title="Caja"
        description="Centro de control de sesiones de caja."
        action={
          openCashSession ? (
            // Bloque 7.31: "Ir al POS" era un `variant="outline"` de
            // tamaño default (h-8) — se sentia como una accion secundaria
            // pese a ser LA accion principal de esta pantalla mientras hay
            // una caja abierta (mismo destino/handler de siempre, solo
            // cambia el estilo). Mismo patron de boton primario ya usado
            // en el resto del ERP para la accion principal del header
            // (ej. "Nuevo Producto"/"Nuevo Permiso").
            <Button
              type="button"
              onClick={() => navigate('/sales/pos')}
              className="h-11 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
            >
              <ShoppingCart className="size-4" />
              Ir al POS
            </Button>
          ) : (
            !isLoadingOpenSession && (
              // Mismo patron primario que "Ir al POS" arriba (Bloque
              // 7.31) — ambos ocupan el mismo slot del header, mutuamente
              // excluyentes, y representan por igual "la accion principal
              // de esta pantalla" segun el estado.
              <Button
                type="button"
                onClick={() => setIsOpenPanelOpen(true)}
                className="h-11 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
              >
                <Wallet className="size-4" />
                Abrir caja
              </Button>
            )
          )
        }
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {openCashSession && sessionDetail && (
          <div className="flex flex-col gap-4 border-b border-border/70 p-5 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-6">
              <Field label="Caja" value={sessionDetail.cashRegister.name} />
              <Field label="Cajero" value={sessionDetail.openedBy.fullName} />
              <Field
                label="Hora de apertura"
                value={formatDateTime(openCashSession.openedAt).split(' ')[1] ?? '—'}
              />
              <Field label="Tiempo transcurrido" value={formatElapsedSince(openCashSession.openedAt)} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3">
                <span className="text-xs font-semibold tracking-wide text-brand/80 uppercase">
                  Total vendido
                </span>
                <span className="text-xl leading-tight font-bold tabular-nums text-brand">
                  {formatCurrency(sessionDetail.salesTotal)}
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3">
                <span className="text-xs font-semibold tracking-wide text-brand/80 uppercase">
                  Efectivo esperado
                </span>
                <span className="text-xl leading-tight font-bold tabular-nums text-brand">
                  {formatCurrency(expectedAmount)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSelectedSessionId(openCashSession.id)}
              >
                Ver detalle
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => openMovementDialog()}
              >
                <ArrowDownCircle className="size-3.5" />
                Registrar movimiento
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(`/cash-session/${openCashSession.id}/close`)}
              >
                <DoorClosed className="size-3.5" />
                Cerrar caja
              </Button>
            </div>
          </div>
        )}

        <div className="border-b border-border/70">
          <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-3 lg:grid-cols-5">
            {openCashSession ? (
              <KpiCard
                bare
                size="xs"
                label="Caja activa"
                value={sessionDetail?.cashRegister.name ?? '—'}
                icon={Wallet}
              />
            ) : (
              <KpiCard bare size="xs" label="Sesiones" value={summary?.totalSessions ?? 0} icon={Wallet} />
            )}
            <KpiCard bare size="xs" label="Ventas" value={summary?.totalSales ?? 0} icon={ShoppingCart} />
            <KpiCard
              bare
              size="xs"
              label="Total vendido"
              value={formatCurrency(summary?.totalSalesAmount ?? 0)}
              icon={Banknote}
            />
            <KpiCard
              bare
              size="xs"
              label="Diferencia promedio"
              value={formatCurrency(summary?.averageDifference ?? 0)}
              icon={Scale}
            />
            <KpiCard
              bare
              size="xs"
              label="Apertura total"
              value={formatCurrency(summary?.totalOpeningAmount ?? 0)}
              icon={Coins}
            />
          </div>
        </div>

        <div className="border-b border-border/70 px-4 py-3">
          <Toolbar
            bare
            filters={
              <CashSessionFilters
                filters={filters}
                cashRegisters={cashRegisters}
                users={users}
                onFiltersChange={handleFiltersChange}
              />
            }
          />
        </div>

        {isLoading && (
          <div className="p-4">
            <LoadingState message="Cargando sesiones de caja..." />
          </div>
        )}

        {isError && (
          <div className="p-4">
            <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar las sesiones.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className={cn('transition-opacity duration-200', isFetching && 'opacity-60')}>
            <CashSessionsTable
              sessions={data?.data ?? []}
              onRowClick={(session) => setSelectedSessionId(session.id)}
            />

            {data?.meta && (
              <div className="border-t border-border/70 px-4 py-3">
                <Pagination meta={data.meta} onPageChange={setPage} itemLabel="sesiones" />
              </div>
            )}
          </div>
        )}
      </div>

      <CashSessionDetailDrawer
        sessionId={selectedSessionId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSessionId(null)
          }
        }}
      />

      <WorkspacePanel open={isOpenPanelOpen} onOpenChange={setIsOpenPanelOpen}>
        <WorkspacePanelContent size="md">
          <WorkspacePanelHeader>
            <WorkspacePanelTitle>Abrir caja</WorkspacePanelTitle>
            <WorkspacePanelDescription>
              Inicia una nueva sesión para tu turno.
            </WorkspacePanelDescription>
          </WorkspacePanelHeader>
          <WorkspacePanelBody>
            <OpenCashSessionForm
              onSuccess={() => setIsOpenPanelOpen(false)}
              onCancel={() => setIsOpenPanelOpen(false)}
            />
          </WorkspacePanelBody>
        </WorkspacePanelContent>
      </WorkspacePanel>

      {openCashSession && (
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
              cashSessionId={openCashSession.id}
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
    </div>
  )
}
