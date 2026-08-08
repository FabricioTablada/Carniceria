import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Eye, Wallet } from 'lucide-react'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelDescription,
  WorkspacePanelFooter,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { useCashReportDetail } from '@/features/reports/hooks/useCashReportDetail'
import { CashSessionSummaryKpis } from '@/features/reports/components/CashSessionSummaryKpis'
import { useSales } from '../hooks/useSales'
import { PAYMENT_METHOD_OPTIONS } from '../utils/payment'
import { SaleMiniDetailPanel } from './SaleMiniDetailPanel'
import type { Sale } from '../types/sale.types'

/** Mismo criterio ya usado en `SessionSalesDialog.tsx`: un vistazo, no un
 * historial — solo las mas recientes, sin paginacion. */
const RECENT_SALES_LIMIT = 5

interface CashSessionSummaryPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sesion de caja activa. `null` deja las consultas deshabilitadas
   * (defensivo — no deberia abrirse sin sesion). */
  cashSessionId: string | null
}

/**
 * features/sales/components/CashSessionSummaryPanel.tsx
 * -----------------------------------------------------------------------------
 * Bloque POS-07 ("Resumen de mi sesión"): unico punto del POS que muestra
 * el estado de la caja activa SIN salir de la pantalla — antes, el atajo
 * "Corte de caja" del sidebar (`PosSidebar.tsx`) navegaba directo al
 * historial administrativo completo (`/reports/cash`), obligando al
 * cajero a buscar su propia sesion entre todas las del sistema.
 *
 * Cero logica de agregacion nueva: `useCashReportDetail` (mismo hook que
 * ya usa `CashSessionDetailPage.tsx`) sigue siendo la UNICA fuente de los
 * totales/desglose por metodo de pago — este panel no sabe calcular nada
 * de eso, solo lo presenta, vía `CashSessionSummaryKpis` (`variant="full"`,
 * el mismo componente que el modulo administrativo, sin duplicar esa
 * lista de tarjetas en dos archivos).
 *
 * "Ultimas ventas de la sesión": lista simple (no `SalesTable`/`DataTable`)
 * — a proposito, para evitar la estetica de tabla administrativa que pide
 * este bloque; los datos vienen de `useSales({ cashSessionId, limit: 5 })`,
 * el MISMO hook/endpoint que ya usan `SessionSalesDialog.tsx`/
 * `CashSessionDetailPage.tsx`. "Vista rapida" reutiliza `SaleMiniDetailPanel.tsx`
 * (Bloque POS-06) tal cual, con la venta ya cargada en esta misma lista —
 * sin peticion nueva al abrirla.
 *
 * "Ver corte completo" navega a `/reports/cash/:id` (la pagina
 * administrativa existente, sin cambios) — mismo criterio de "escape
 * hatch" ya usado en `SaleMiniDetailPanel`/POS-06: este panel nunca
 * reemplaza esa pantalla, solo evita que sea el UNICO camino para un
 * vistazo rapido.
 *
 * Bloque 7.33 (paridad visual con el resto del ERP, presentación
 * únicamente): "Resumen general" + "Últimas ventas de la sesión" pasan a
 * vivir dentro de un único Canvas Workspace (`rounded-2xl border bg-card
 * shadow-sm`, misma superficie que Productos/Permisos/Dashboard/Caja) en
 * vez de dos `<section>` sueltas. `CashSessionSummaryKpis` sigue
 * recibiendo `variant="full"` (mismos 5-8 KPIs de siempre, sin cambios de
 * datos/cálculo) pero ahora TAMBIÉN `bare` — prop ya existente en ese
 * componente (agregada para `SalesKpiRow.tsx`, nunca antes combinada con
 * `variant="full"`) que fuerza `size="xs"` sin descripción, la misma
 * franja plana `divide-x/divide-y` que ya usa el resto del ERP en vez de
 * 8 tarjetas con borde propio y números de `size="default"` (28px).
 */
export function CashSessionSummaryPanel({
  open,
  onOpenChange,
  cashSessionId,
}: CashSessionSummaryPanelProps) {
  const navigate = useNavigate()
  const [quickViewSale, setQuickViewSale] = useState<Sale | null>(null)

  const { data, isLoading, isError, error } = useCashReportDetail(cashSessionId ?? '', {
    enabled: open && Boolean(cashSessionId),
  })
  const session = data?.data

  const { data: salesResponse, isLoading: isLoadingSales } = useSales(
    { cashSessionId: cashSessionId ?? undefined, limit: RECENT_SALES_LIMIT },
    { enabled: open && Boolean(cashSessionId) },
  )
  const recentSales = salesResponse?.data ?? []

  return (
    <>
      <WorkspacePanel open={open} onOpenChange={onOpenChange}>
        <WorkspacePanelContent size="xl">
          <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Wallet className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <WorkspacePanelTitle className="text-xl font-bold">
                Resumen de mi sesión
              </WorkspacePanelTitle>
              <WorkspacePanelDescription>
                Consulta el estado actual de tu caja
              </WorkspacePanelDescription>
            </div>
          </WorkspacePanelHeader>

          <WorkspacePanelBody className="flex flex-col gap-5">
            {isLoading && <LoadingState message="Cargando resumen de la sesión..." />}

            {isError && (
              <ErrorAlert>
                {error?.message ?? 'Ocurrió un error al cargar el resumen de la sesión.'}
              </ErrorAlert>
            )}

            {!isLoading && !isError && session && (
              <div className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border/70 px-4 py-3">
                  <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Resumen general
                  </h3>
                  <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4">
                    <CashSessionSummaryKpis session={session} variant="full" bare />
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Últimas ventas de la sesión
                  </h3>

                  {isLoadingSales && <LoadingState message="Cargando ventas..." />}

                  {!isLoadingSales && recentSales.length === 0 && (
                    <EmptyState
                      icon={Wallet}
                      title="Todavía no hay ventas"
                      description="Las ventas de esta sesión van a aparecer aquí."
                    />
                  )}

                  {!isLoadingSales && recentSales.length > 0 && (
                    <div className="flex flex-col divide-y divide-border rounded-xl border border-border/60">
                      {recentSales.map((sale) => {
                        const time = formatDateTime(sale.saleDate).split(' ')[1] ?? '—'
                        const paymentLabel =
                          PAYMENT_METHOD_OPTIONS.find((option) => option.value === sale.paymentMethod)
                            ?.label ?? sale.paymentMethod

                        return (
                          <div
                            key={sale.id}
                            className="flex items-center gap-4 px-4 py-3 text-sm"
                          >
                            <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                              {time}
                            </span>
                            <span className="w-24 shrink-0 truncate font-mono text-xs text-muted-foreground">
                              {sale.documentNumber ?? '—'}
                            </span>
                            <span className="flex-1 truncate text-muted-foreground">
                              {paymentLabel}
                            </span>
                            <span className="shrink-0 font-bold tabular-nums text-foreground">
                              {formatCurrency(sale.total)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Vista rápida de la venta ${sale.documentNumber ?? sale.id}`}
                              onClick={() => setQuickViewSale(sale)}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </WorkspacePanelBody>

          <WorkspacePanelFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={!cashSessionId}
              onClick={() => cashSessionId && navigate(`/reports/cash/${cashSessionId}`)}
              className="gap-2"
            >
              Ver corte completo
              <ArrowUpRight className="size-3.5" />
            </Button>

            <WorkspacePanelClose
              render={
                <Button type="button" className="bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active">
                  Cerrar
                </Button>
              }
            />
          </WorkspacePanelFooter>
        </WorkspacePanelContent>
      </WorkspacePanel>

      {/* Hermano del `WorkspacePanel` de arriba, no anidado — mismo
          criterio ya usado en `SessionSalesDialog.tsx` (Bloque POS-06)
          para apilar `SaleMiniDetailPanel` encima de un panel existente. */}
      <SaleMiniDetailPanel
        sale={quickViewSale}
        onOpenChange={(open) => {
          if (!open) {
            setQuickViewSale(null)
          }
        }}
      />
    </>
  )
}
