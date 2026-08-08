import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PosSidebar } from '@/components/common/PosSidebar'
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
import { Badge } from '@/components/common/Badge'
import { formatDateTime } from '@/utils/formatDateTime'
import { useAuthStore } from '@/stores/authStore'
import { useCashSession } from '@/features/cashSession/hooks/useCashSession'
import { useCashSessionStore } from '@/features/cashSession/store/cashSessionStore'
import { CashMovementForm } from '@/features/cashSession/components/CashMovementForm'
import { PosSearchFocusContext } from './PosSearchFocusContext'
import { PosQuickActionsContext, type PosQuickActions } from './PosQuickActionsContext'

/** Mismo par etiqueta/valor local que ya usan `SaleDetailContent.tsx`/
 * `RoleDrawer.tsx`/`CashSessionsPage.tsx` — banda de identidad del Hero. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}

interface PosLayoutProps {
  children: ReactNode
}

/**
 * layouts/PosLayout.tsx
 * -----------------------------------------------------------------------------
 * Layout base del Punto de Venta. Usa `PosSidebar` (exclusivo del POS) en
 * vez de `Sidebar` (oscuro, usado por DashboardLayout) — ninguno de los
 * dos archivos originales (`Sidebar.tsx`, `DashboardLayout.tsx`) fue
 * modificado.
 *
 * Resuelve los datos de usuario aqui (useAuthStore) y los pasa a
 * PosSidebar por props, mismo patron ya usado por DashboardLayout para su
 * propio bloque de usuario, y mismo criterio de "el layout/pagina
 * resuelve datos, el componente los recibe" ya aplicado en PosHeader.
 *
 * Rediseño final del POS (aprobado): el sidebar y el contenido dejan de
 * ser dos rectangulos de borde a borde pegados por una linea recta. Un
 * canvas comun (el mismo tono oscuro de marca del sidebar, `p-2 gap-2`)
 * aloja dos superficies flotantes con radios propios — el sidebar
 * (`PosSidebar.tsx`, ahora `rounded-2xl` en las cuatro esquinas) y el
 * panel de contenido (header + catalogo + carrito, agrupados en un unico
 * contenedor redondeado con `overflow-hidden`). Ambas superficies
 * "flotan" sobre la misma tela en vez de estar unidas por un corte recto
 * — mismo criterio ya usado en `DashboardLayout.tsx` para el Backoffice,
 * adaptado aca con margenes minimos para no sacrificar la densidad del
 * catalogo. Cero cambios de navegacion/logica: mismos datos, mismo
 * `children`.
 *
 * El dialogo de "Movimiento de caja" (antes disparado por un boton en
 * SalesPOSPage.tsx, debajo de "Resumen de venta") vive aca ahora: es la
 * accion que dispara el nuevo item del Sidebar, y este es el unico
 * ancestro comun entre `PosSidebar` y `SalesPOSPage` (via `children`).
 * Mismo estado, mismo formulario (`CashMovementForm`), mismo markup de
 * dialogo — solo cambia quien lo posee.
 *
 * Pulido visual del POS (aprobado, "el diálogo de Movimiento de Caja debe
 * sentirse como una herramienta profesional"): pasa del `DialogPrimitive`
 * armado a mano al mismo `Dialog`/`DialogContent`/`DialogHeader`/
 * `DialogFooter` compartido que ya usan el resto de los diálogos del ERP
 * (`PromotionsActivationDialog.tsx`, `ConfirmDialog.tsx`) — mismo
 * primitivo de base (`@base-ui/react/dialog`) por debajo, cero cambio de
 * comportamiento (Escape/backdrop/foco siguen igual). Se agrega un Hero
 * superior (Caja/Cajero/Hora/Estado) con datos YA disponibles: `user` (ya
 * en este archivo) y `useCashSession(cashSessionId)` — mismo hook/consulta
 * que `SalesPOSPage.tsx` ya pide con la misma `queryKey`, así que React
 * Query la sirve desde caché, sin petición nueva en la práctica. Los
 * tokens de color usados en el Hero son genéricos del Design System
 * (`bg-muted`/`border-brand`/`text-brand`), no `--pos-*`: este diálogo se
 * renderiza en un `Portal` (fuera del `<div className="pos-surface">` de
 * más abajo), donde esos tokens exclusivos del POS no resuelven — mismo
 * criterio que ya regía este archivo antes de este bloque.
 */
export function PosLayout({ children }: PosLayoutProps) {
  const user = useAuthStore((state) => state.user)
  const cashSessionId = useCashSessionStore((state) => state.cashSessionId)
  // Pulido visual del POS: mismo hook/queryKey que `SalesPOSPage.tsx` ya
  // usa para resolver `sucursalId` del catálogo — reutilizado acá
  // únicamente para el Hero del diálogo de Movimiento de caja, sin
  // petición nueva (cacheado). `enabled: Boolean(id)` (ya en el hook) deja
  // la consulta inactiva sin sesión abierta.
  const { data: cashSession } = useCashSession(cashSessionId ?? '')
  const [isCashMovementOpen, setIsCashMovementOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Ver PosQuickActionsContext.ts — `SalesPOSPage.tsx` asigna este `.current`
  // durante su render (mismo criterio que un ref normal, sin efecto), y
  // `PosSidebar.tsx` lo lee al hacer click en "Nueva venta"/"Descuentos"/
  // "Devoluciones". `null` solo en el instante antes del primer render de
  // `SalesPOSPage.tsx` (siempre montado junto al sidebar).
  const quickActionsRef = useRef<PosQuickActions | null>(null)

  const handleCashMovementSuccess = () => {
    setIsCashMovementOpen(false)
  }

  // Unico punto que decide la apertura/cierre del dialogo (Escape, click
  // afuera, "Cancelar" o exito del formulario pasan todos por aca via
  // `onOpenChange`/`handleCashMovementSuccess`): al cerrarse, devuelve el
  // foco al buscador — mismo ref y misma accion que el atajo F2.
  const handleCashMovementOpenChange = (open: boolean) => {
    setIsCashMovementOpen(open)

    if (!open) {
      searchInputRef.current?.focus()
    }
  }

  // Atajo de teclado F4: misma accion que el item "Movimiento de caja"
  // del Sidebar (`onOpenCashMovement`), con la misma condicion de sesion
  // de caja abierta que ya gobierna ese item. El cierre con Esc no
  // requiere codigo propio: `DialogPrimitive.Root` ya lo maneja via
  // `onOpenChange` (mismo comportamiento que SaleReceiptDialog.tsx).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F4') {
        event.preventDefault()

        if (cashSessionId) {
          setIsCashMovementOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cashSessionId])

  return (
    <div className="pos-surface flex h-screen gap-2 bg-[var(--pos-bg)] p-2">
      <PosSidebar
        userFullName={user?.fullName ?? ''}
        userRole={user?.role ?? ''}
        isCashSessionOpen={Boolean(cashSessionId)}
        cashSessionId={cashSessionId}
        onOpenCashMovement={() => setIsCashMovementOpen(true)}
        quickActionsRef={quickActionsRef}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--pos-bg)] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]">
        <PosSearchFocusContext.Provider value={searchInputRef}>
          <PosQuickActionsContext.Provider value={quickActionsRef}>
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
          </PosQuickActionsContext.Provider>
        </PosSearchFocusContext.Provider>
      </div>

      {cashSessionId && (
        <Dialog open={isCashMovementOpen} onOpenChange={handleCashMovementOpenChange}>
          <DialogContent className="max-w-md gap-5">
            <DialogHeader>
              <DialogTitle>Registrar movimiento de efectivo</DialogTitle>
              <DialogDescription>
                Registra un ingreso o egreso de efectivo en la sesión actual.
              </DialogDescription>
            </DialogHeader>

            {/* Hero (aprobado): mismo patrón de banda de identidad ya usado
                en el resto del ERP — Field a la izquierda, estado a la
                derecha. Ningún dato nuevo: `user`/`cashSession` ya
                resueltos arriba. */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3">
              <Field label="Caja" value={cashSession?.sucursal.name ?? '—'} />
              <Field label="Cajero" value={user?.fullName ?? '—'} />
              <Field label="Hora" value={formatDateTime(new Date().toISOString()).split(' ')[1] ?? '—'} />
              <Badge variant="secondary" className="ml-auto gap-1.5">
                <span className="size-2 shrink-0 rounded-full bg-current" />
                Caja abierta
              </Badge>
            </div>

            <CashMovementForm
              open={isCashMovementOpen}
              cashSessionId={cashSessionId}
              onSuccess={handleCashMovementSuccess}
            />

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" size="sm">
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
