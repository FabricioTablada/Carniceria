import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  type LucideIcon,
  Package,
  ShoppingCart,
  Truck,
  Undo2,
  Wallet,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useDashboard } from '@/features/reports/hooks/useDashboard'
import { useSalesByCashierSummary } from '@/features/reports/hooks/useSalesByCashierSummary'
import { useLowStock } from '@/features/reports/hooks/useLowStock'
import { useCashReportDetail } from '@/features/reports/hooks/useCashReportDetail'
import { DashboardTodayKpis } from '@/features/reports/components/DashboardTodayKpis'
import { DashboardLowStockPanel } from '@/features/reports/components/DashboardLowStockPanel'
import {
  DashboardRecentActivity,
  type RecentActivityEntry,
} from '@/features/reports/components/DashboardRecentActivity'
import { DashboardPromotionsPanel } from '@/features/reports/components/DashboardPromotionsPanel'
import { DashboardContextPanel } from '@/features/reports/components/DashboardContextPanel'
import {
  QuickActions,
  type QuickAction,
} from '@/features/reports/components/QuickActions'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { NotificationPanel } from '@/features/notifications/components/NotificationPanel'
import { usePromotions } from '@/features/promotions/hooks/usePromotions'
import { useCashSessions } from '@/features/cashSession/hooks/useCashSessions'
import { useCashMovements } from '@/features/cashSession/hooks/useCashMovements'
import { useCashRegisters } from '@/features/cashRegisters/hooks/useCashRegisters'
import { useSales } from '@/features/sales/hooks/useSales'
import { deriveCashSessionInsights } from '@/features/cashSession/utils/cashSessionInsights'
import type { CashMovement, CashMovementType } from '@/features/cashSession/types/cashSession.types'

/**
 * QA.14 (Dashboard): fecha de HOY en zona horaria de Costa Rica
 * (`America/Costa_Rica`), no en UTC. `new Date().toISOString().slice(0, 10)`
 * (lo que este archivo usaba antes) devuelve el dia calendario en UTC —
 * durante la ventana de las 6pm a medianoche hora de Costa Rica (UTC-6),
 * el dia UTC ya avanzo al dia siguiente mientras en Costa Rica todavia es
 * "hoy", asi que ese string quedaba un dia adelantado justo en esa
 * ventana. Ese valor alimenta `useSalesByCashierSummary({dateFrom,
 * dateTo})`, que via `reports.repository.ts::buildDateRange` (QA.13, ya
 * corregido) SI interpreta correctamente el dia calendario de Costa Rica
 * que se le pida — pero solo si el string que recibe es el dia correcto.
 * Mismo mecanismo (`Intl.DateTimeFormat` con `timeZone:
 * 'America/Costa_Rica'`) ya usado en `utils/formatDateTime.ts`.
 */
function getTodayInCostaRica(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

const TODAY_ISO = getTodayInCostaRica()

// Referencia estable para cuando `useCashMovements` todavia no resolvio
// datos — evita que el arreglo vacio `?? []` cree una referencia nueva en
// cada render, lo que invalidaria innecesariamente el `useMemo` de
// `recentActivityEntries` (que depende de `sessionMovements`) en cada
// renderizado, no solo cuando los datos realmente cambian.
const EMPTY_MOVEMENTS: CashMovement[] = []

// Version 1.0.3, Bloque 3: antes un ternario binario (`CASH_IN` vs. todo lo
// demas etiquetado "Egreso de caja") — mostraba mal tanto `REFUND` como
// `CHANGE` (ninguno de los dos es un egreso manual real). `Record<CashMovementType, ...>`
// a proposito, mismo criterio que `CashMovementsTable.tsx`: agregar un
// valor al enum sin actualizar este mapa es un error de compilacion, no un
// titulo incorrecto descubierto en produccion.
const MOVEMENT_ACTIVITY_CONFIG: Record<CashMovementType, { icon: LucideIcon; title: string }> = {
  CASH_IN: { icon: ArrowUpCircle, title: 'Ingreso de caja' },
  CASH_OUT: { icon: ArrowDownCircle, title: 'Egreso de caja' },
  REFUND: { icon: Undo2, title: 'Reembolso' },
  CHANGE: { icon: Coins, title: 'Vuelto entregado' },
}

/**
 * pages/DashboardPage.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.29C.1 (rediseño, wireframe aprobado): el Dashboard pasa a ser un
 * "Centro de Operación" — deliberadamente SIN gráficos, comparativas
 * históricas ni pestañas de análisis (eso sigue siendo exclusivo de
 * `/reports`, el "Centro de Análisis"). Se elimina la pestaña "Analítica"
 * (los 2 gráficos de recharts + indicadores históricos que hacían que esta
 * pantalla se sintiera una copia de Reportes) y la navegación por pestañas
 * en general — todo el contenido operativo se ve en una sola pantalla, sin
 * clicks extra. `useSalesByCategory`/`useSalesByDate` (que solo alimentaban
 * esos gráficos) se dejan de pedir aca; ambos hooks siguen usandose sin
 * cambios en `ReportsIndexPage.tsx`/sus paginas dedicadas.
 *
 * Orden de la pantalla (aprobado explícitamente): KPIs de hoy → Necesita
 * atención (protagonista, primer bloque operativo real) → Actividad
 * reciente → Mi turno/Estado operativo → Acciones rápidas. Cada sección
 * reutiliza el mismo Canvas Workspace (`rounded-2xl border bg-card
 * shadow-sm`) ya usado por Productos/Reportes — antes eran `Card` sueltas
 * sin superficie compartida. `NotificationPanel` (Alertas) ya no se
 * renderiza duplicado (antes aparecía en 2 pestañas distintas).
 *
 * Ningún hook/mutación nuevo: mismos datos que ya se pedían antes de este
 * bloque, solo reorganizados. `DashboardContextPanel.tsx`/
 * `DashboardRecentActivity.tsx`/`DashboardLowStockPanel.tsx`/
 * `DashboardPromotionsPanel.tsx` mantienen su lógica intacta (rol
 * Cajero/Administrador, orden de actividad, etc.) — solo cambia el
 * contenedor visual que los envuelve en esta página.
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { hasPermission } = usePermissions()

  const { data, isLoading, isError, error } = useDashboard()

  const { data: todayCashierSummary, isLoading: isTodayCashierSummaryLoading } =
    useSalesByCashierSummary({ dateFrom: TODAY_ISO, dateTo: TODAY_ISO })

  const { data: notifications, isLoading: isNotificationsLoading, isError: isNotificationsError } =
    useNotifications()
  const activeAlerts = notifications ?? []
  const criticalAlertsCount = activeAlerts.filter((item) => item.severity === 'critical').length

  const { data: lowStockItems, isLoading: isLowStockLoading } = useLowStock()

  const { data: activePromotionsResponse, isLoading: isPromotionsLoading } = usePromotions({
    active: true,
    limit: 5,
  })

  // Mismo criterio ya usado en `OpenCashSessionPage.tsx`: la sesión de caja
  // pertenece a la caja registradora, no al usuario — se consulta contra el
  // backend (`useCashSessions({status:'OPEN'})`), no contra
  // `cashSessionStore`. Se prefiere la sesión abierta por el usuario actual
  // (si la tiene) para el panel "Mi turno"; si no encuentra una propia, cae
  // a la primera sesión abierta (mismo comportamiento que ya tenía
  // `OpenCashSessionPage.tsx` para el caso de una sola caja registradora).
  const { data: openSessionsResponse, isLoading: isCashSessionsLoading } = useCashSessions({
    status: 'OPEN',
  })
  const openSessions = openSessionsResponse?.data ?? []
  const myOpenSession =
    openSessions.find((session) => session.openedByUserId === user?.id) ?? openSessions[0] ?? null

  const { data: cashRegistersResponse } = useCashRegisters({ active: true })
  const cashRegisterName = cashRegistersResponse?.data.find(
    (cashRegister) => cashRegister.id === myOpenSession?.cashRegisterId,
  )?.name

  const { data: sessionDetailResponse } = useCashReportDetail(myOpenSession?.id ?? '', {
    enabled: Boolean(myOpenSession),
  })
  // QA Final 1.0 (End-to-End): mismo riesgo conocido documentado en
  // `CashSessionsPage.tsx` — `paymentBreakdown.CASH.total` no incluye la
  // porcion en efectivo de una venta con `paymentMethod: 'MIXED'` (el
  // modelo de datos actual no la registra por separado). No corregido en
  // este QA (requeriria un cambio de esquema/reglas de negocio).
  const cashSalesTotal = sessionDetailResponse?.data.paymentBreakdown.CASH.total ?? 0

  const { data: sessionMovementsResponse } = useCashMovements(
    myOpenSession ? { cashSessionId: myOpenSession.id, limit: 100 } : undefined,
  )
  const sessionMovements = sessionMovementsResponse?.data ?? EMPTY_MOVEMENTS
  const sessionInsights = deriveCashSessionInsights(sessionMovements)

  // Ventas: sin sesión (Administrador) trae recientes de toda la sucursal;
  // con sesión propia (Cajero) las de esa sesión — mismo hook (`useSales`)
  // en ambos casos, solo cambia el filtro.
  const { data: recentSalesResponse } = useSales(
    myOpenSession ? { cashSessionId: myOpenSession.id, limit: 100 } : { limit: 20 },
  )
  const recentSales = [...(recentSalesResponse?.data ?? [])].sort(
    (a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime(),
  )
  const lastSaleAt = recentSales[0]?.saleDate ?? null

  // Rediseño ("centro de control", aprobado): el panel lateral y la
  // "actividad reciente" cambian según el rol — `USERS_MANAGE` es el mismo
  // permiso que ya distingue ADMIN/MANAGER de CASHIER en el seed del
  // backend (CASHIER nunca lo tiene); no se compara contra un literal de
  // rol porque ningún otro archivo del frontend lo hace (`user.role` solo
  // se compara contra `'ADMIN'`, ver `CashSessionAuditSection.tsx`).
  const isCashierView = !hasPermission(PERMISSIONS.USERS_MANAGE)

  const recentActivityEntries: RecentActivityEntry[] = useMemo(() => {
    const saleEntries: RecentActivityEntry[] = recentSales.map((sale) => ({
      id: `sale-${sale.id}`,
      icon: ShoppingCart,
      title: sale.documentNumber ? `Venta ${sale.documentNumber}` : 'Venta',
      detail: `${sale.user.fullName} · ${sale.total.toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}`,
      timestamp: sale.saleDate,
    }))

    // Los movimientos de caja solo se incluyen en la vista de Cajero: fuera
    // de una sesión puntual, `useCashMovements` no dispara (requiere
    // `cashSessionId`, ver docstring del hook) — no se modifica ese hook
    // para esta vista de solo lectura del Dashboard.
    const movementEntries: RecentActivityEntry[] = isCashierView
      ? sessionMovements.map((movement) => {
          const config = MOVEMENT_ACTIVITY_CONFIG[movement.type]
          return {
            id: `movement-${movement.id}`,
            icon: config.icon,
            title: config.title,
            detail: `${movement.user.fullName} · ${movement.reason}`,
            timestamp: movement.createdAt,
          }
        })
      : []

    return [...saleEntries, ...movementEntries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
  }, [recentSales, sessionMovements, isCashierView])

  // Bloque 7.29C.1: orden por frecuencia de uso real esperada en la
  // operación diaria de una carnicería (criterio, no telemetría medida —
  // no existe ningún dato de uso real de estos botones en el sistema):
  // "Nueva venta" ocurre constantemente durante todo el turno; ir a la
  // caja/abrir caja se revisa varias veces por turno; una compra es un
  // evento puntual (unas pocas veces por semana); crear un producto nuevo
  // es el menos frecuente de los cuatro (el catálogo cambia rara vez).
  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        id: 'new-sale',
        label: 'Nueva venta',
        icon: ShoppingCart,
        permission: PERMISSIONS.SALES_CREATE,
        onClick: () => navigate('/sales/pos'),
      },
      {
        // Mejora aprobada: el acceso de caja cambia según exista o no una
        // sesión abierta para el usuario actual — misma ruta en ambos
        // casos (`/cash-session/open` ya resuelve las dos ramas), solo
        // cambia la etiqueta/ícono.
        id: 'cash-session',
        label: myOpenSession ? 'Ir a caja' : 'Abrir caja',
        icon: Wallet,
        permission: PERMISSIONS.CASH_OPEN,
        onClick: () => navigate('/cash-session/open'),
      },
      {
        id: 'new-purchase',
        label: 'Nueva compra',
        icon: Truck,
        permission: PERMISSIONS.PURCHASES_CREATE,
        onClick: () => navigate('/purchases/new'),
      },
      {
        id: 'new-product',
        label: 'Nuevo producto',
        icon: Package,
        permission: PERMISSIONS.PRODUCTS_CREATE,
        onClick: () => navigate('/products/new'),
      },
    ],
    [navigate, myOpenSession],
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Dashboard' }]}
        title="Dashboard"
        description="Centro de operación del negocio — cómo está hoy, qué necesita atención y qué pasó recientemente."
      />

      {isLoading && <LoadingState message="Cargando reporte..." />}

      {isError && (
        <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el reporte.'}</ErrorAlert>
      )}

      {!isLoading && !isError && data && (
        <>
          <DashboardTodayKpis
            todaySalesAmount={
              isTodayCashierSummaryLoading ? null : todayCashierSummary?.totalSalesAmount ?? 0
            }
            todayProfit={data.totalProfitToday}
            todayMargin={data.averageMarginToday}
            todayAverageTicket={
              isTodayCashierSummaryLoading ? null : todayCashierSummary?.averageTicket ?? 0
            }
            activeAlertsCount={activeAlerts.length}
            criticalAlertsCount={criticalAlertsCount}
            isLoading={isTodayCashierSummaryLoading || isNotificationsLoading}
          />

          {/* "Necesita atención" — protagonista operativo, primer bloque
              después de los KPIs. Alertas (`NotificationPanel`, una sola
              vez) + Bajo stock/Promociones dentro del mismo Workspace. */}
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border/70 px-4 py-3">
              <p className="text-sm font-semibold">Necesita atención</p>
              <p className="text-xs text-muted-foreground">
                Stock negativo, bajo stock, compras pendientes y cajas abiertas por mucho tiempo.
              </p>
            </div>

            <div className="border-b border-border/70 p-4">
              <NotificationPanel
                notifications={activeAlerts}
                isLoading={isNotificationsLoading}
                isError={isNotificationsError}
                showHeader={false}
                className="max-h-none w-full"
              />
            </div>

            <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <div className="p-4">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Bajo stock
                </p>
                <DashboardLowStockPanel
                  items={lowStockItems ?? []}
                  isLoading={isLowStockLoading}
                  onViewMore={() => navigate('/reports/low-stock')}
                />
              </div>

              <div className="p-4">
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Promociones activas
                </p>
                <DashboardPromotionsPanel
                  promotions={activePromotionsResponse?.data ?? []}
                  isLoading={isPromotionsLoading}
                  onViewMore={() => navigate('/promotions')}
                />
              </div>
            </div>
          </div>

          {/* "Actividad reciente" — mismo componente/lógica de siempre
              (role-aware Cajero/Administrador), ahora en su propio
              Workspace en vez de dentro de una pestaña. */}
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border/70 px-4 py-3">
              <p className="text-sm font-semibold">Actividad reciente</p>
              <p className="text-xs text-muted-foreground">
                {isCashierView
                  ? 'Ventas y movimientos de tu sesión de caja.'
                  : 'Últimas ventas de la sucursal.'}
              </p>
            </div>
            <div className="p-4">
              <DashboardRecentActivity
                entries={recentActivityEntries}
                isLoading={isCashSessionsLoading}
                onViewMore={() => navigate(isCashierView ? '/cash-session/open' : '/sales')}
              />
            </div>
          </div>

          {/* "Mi turno"/"Estado operativo" — mismo `DashboardContextPanel`
              de siempre, ahora en su propio Workspace (antes era un panel
              lateral de 320px). Bloque 7.29C.1: se agrega un indicador
              visual de "Caja abierta"/"Caja cerrada" (mismo `Badge`
              genérico ya usado en el resto del ERP, mismo patrón visual
              que `ActiveStatusBadge.tsx` — punto de color + texto) junto
              al título, solo para la vista de Cajero (la vista de
              Administrador no gira alrededor de una única sesión de
              caja). */}
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{isCashierView ? 'Mi turno' : 'Estado operativo'}</p>
                <p className="text-xs text-muted-foreground">
                  {isCashierView ? 'Tu sesión de caja actual.' : 'Métricas administrativas y de catálogo.'}
                </p>
              </div>
              {isCashierView && (
                <Badge variant={myOpenSession ? 'secondary' : 'muted'} className="shrink-0 gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  {myOpenSession ? 'Caja abierta' : 'Caja cerrada'}
                </Badge>
              )}
            </div>
            <div className="p-4">
              <DashboardContextPanel
                isCashierView={isCashierView}
                cashierSession={
                  myOpenSession
                    ? {
                        session: myOpenSession,
                        cashRegisterName,
                        insights: sessionInsights,
                        cashSalesTotal,
                        lastSaleAt,
                      }
                    : null
                }
                operationalData={data}
                isLoading={isCashSessionsLoading}
                onOpenCashSession={() => navigate('/cash-session/open')}
                onGoToCashSession={() => navigate('/cash-session/open')}
              />
            </div>
          </div>

          {/* "Acciones rápidas" — mismo componente `QuickActions` de
              siempre, ahora al final del flujo (antes era lo segundo en
              la pantalla). */}
          <div className="flex flex-col gap-2.5">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Zap className="size-3.5 text-brand" />
              Acciones rápidas
            </p>
            <QuickActions actions={quickActions} />
          </div>
        </>
      )}
    </div>
  )
}
