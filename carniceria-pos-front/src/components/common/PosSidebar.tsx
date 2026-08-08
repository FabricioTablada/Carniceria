import { useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  DoorClosed,
  PackageSearch,
  Percent,
  ReceiptText,
  ShoppingCart,
  Tag,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { KbdHint } from '@/components/ui/KbdHint'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/constants/permissions'
import { cn } from '@/lib/utils'
import type { PosQuickActions } from '@/layouts/PosQuickActionsContext'
import { CashSessionSummaryPanel } from '@/features/sales/components/CashSessionSummaryPanel'

interface PosSidebarProps {
  /** Nombre completo del usuario autenticado, resuelto por PosLayout.tsx. */
  userFullName: string
  /** Rol del usuario, resuelto por PosLayout.tsx. */
  userRole: string
  /** Si existe una sesion de caja abierta. */
  isCashSessionOpen: boolean
  /** Id de la sesion de caja abierta — necesario para navegar a
   * "Cerrar caja" (`/cash-session/:id/close`). `null` si no hay sesion. */
  cashSessionId: string | null
  /** Abre el dialogo de movimiento de caja (dueno: PosLayout.tsx). */
  onOpenCashMovement: () => void
  /** Ver `PosQuickActionsContext.ts` — acciones de "Nueva venta"/
   * "Descuento rápido"/"Devoluciones", que vive `SalesPOSPage.tsx` (fuera
   * del arbol de este componente) y escribe aca via el mismo `RefObject`
   * que posee `PosLayout.tsx`. */
  quickActionsRef: RefObject<PosQuickActions | null>
}

/**
 * components/common/PosSidebar.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de layout del POS (aprobado, alcance layout principal): deja de
 * reflejar la navegacion administrativa (`NAV_ITEMS`, Principal/
 * Administración) y pasa a ser una barra EXCLUSIVA de acciones operativas
 * del cajero, agrupada en 3 secciones — VENTA / CAJA / REPORTES RÁPIDOS —
 * ninguna inventada: cada accion dispara exactamente la misma logica que ya
 * existia en otro lugar de la pantalla (ver el detalle de cada grupo mas
 * abajo). Se retiraron deliberadamente los items sin funcionalidad real
 * detras hoy (Clientes, Notas por venta, Cotización como accion aparte —
 * ya es parte automatica del flujo de venta, sin UI propia que abrir) —
 * decision explicita: "el POS debe reflejar unicamente las capacidades
 * existentes del sistema".
 *
 * VENTA:
 *  - "Nueva venta": vacia el carrito (mismos setters que `SalesPOSPage.tsx`
 *    ya usaba en el `onSuccess` de confirmar una venta), permanentemente
 *    resaltada como la accion "hogar" de esta pantalla (mismo lenguaje
 *    visual que antes usaba el item activo de `NavLink`, ahora sin
 *    depender de una ruta — el POS no tiene sub-rutas propias).
 *  - "Buscar producto" (F2): enfoca el mismo input que ya enfocaba ese
 *    atajo (`PosSearchFocusContext.ts`, sin cambios).
 *  - "Descuento rápido": abre `CartDiscountDialog.tsx` (descuento manual), sin
 *    depender de si hay promociones activas (QA: no muta `discountType` —
 *    eso sigue siendo exclusivo de `CartDiscount.tsx` via
 *    `onDiscountTypeChange`, sin tocar).
 *  - "Devoluciones": abre `SessionSalesDialog.tsx` — mismo dialogo que ya
 *    abria "Ventas de la sesión" en el header (unico camino existente
 *    hoy hacia anular/corregir/devolver una venta).
 *
 * CAJA:
 *  - "Movimiento de caja" (F4): mismo dialogo que ya vive en
 *    `PosLayout.tsx`, sin cambios.
 *  - "Cerrar caja": navega a `/cash-session/:id/close`, misma ruta que ya
 *    existe (antes solo alcanzable desde `OpenCashSessionPage.tsx`). "Abrir
 *    caja" no aplica dentro del POS — `RequireCashSession` ya garantiza que
 *    esta pantalla solo se renderiza con una sesion abierta.
 *
 * REPORTES RÁPIDOS: "Ventas del día"/"Productos vendidos" (antes "Ventas
 * por producto" — pulido visual final del POS, "textos más claros y
 * profesionales") siguen siendo atajos a paginas de Reportes YA existentes
 * (`SalesReportPage`/`TopProductsPage`) — se sale del POS al usarlos,
 * mismo criterio que "Volver a Administración" (son reportes de TODA la
 * tienda, multi-sesion, con filtros/graficos propios, fuera del alcance de
 * un panel liviano).
 *
 * Bloque POS-07 ("Resumen de mi sesión"): "Corte de caja" deja de navegar
 * a `/reports/cash` (el historial completo de sesiones) y en su lugar
 * abre `CashSessionSummaryPanel.tsx` directamente con la sesion activa —
 * el POS ya conoce `cashSessionId`, asi que ya no hace falta que el
 * cajero busque su propia sesion entre todas las del sistema. Ese panel
 * sigue ofreciendo "Ver corte completo" hacia la pagina administrativa,
 * sin perder ninguna capacidad existente.
 *
 * Cero logica nueva: cada `onClick` reutiliza un handler/estado que ya
 * existia en otro archivo (ver comentarios de cada grupo); lo unico nuevo
 * es el punto de entrada visual.
 *
 * Rediseño del POS ("centro operativo", aprobado): "riel lateral compacto
 * de iconos" en vez de una barra con etiquetas — mismo componente, mismas
 * acciones/handlers, se agrega `collapsed` (estado local, `true` por
 * defecto: "preferir colapsado antes que ocupar espacio innecesario").
 * Colapsado, cada `SidebarAction` muestra solo el icono (con `title` como
 * tooltip nativo, sin componente nuevo) y el ancho del `<aside>` baja de
 * `w-64` a `w-16` — libera ese espacio para el carrito, que pasa a ser el
 * protagonista.
 *
 * Rediseño final del POS (aprobado, "terminal profesional"): se elimina
 * por completo el bloque de branding (logo + "Sistema POS", zona blanca
 * de borde a borde) — el riel ahora inicia directamente con las
 * acciones; y el pie "Terminal de venta" (texto puramente decorativo).
 * Se elimina tambien el boton de flecha para expandir/colapsar: el riel
 * pasa a expandirse automaticamente con el hover (`onMouseEnter`/
 * `onMouseLeave` sobre el `<aside>`) y vuelve a colapsarse al retirar el
 * cursor — mismo estado `collapsed`, mismas acciones/handlers, sin
 * ningun cambio de comportamiento salvo el disparador.
 *
 * Pulido visual (aprobado, "dock moderno, no sidebar administrativo"):
 * superficie oscura -> tokens claros del POS (`--pos-panel`/`--pos-border`/
 * `--pos-ink`), botones mas espaciados y con iconos mas grandes (size-4 ->
 * size-[1.15rem], contenedor size-7 -> size-10), estado activo con el
 * color de marca solido (antes una "pastilla" clara sobre fondo oscuro,
 * imitando el patron ya usado en `Sidebar.tsx`/`DashboardLayout.tsx` —
 * ahora un fondo `bg-brand` propio, mas parecido a un dock de acciones que
 * a un menu de navegacion) y hover mas notorio (`hover:bg-brand/10`).
 * Mismas acciones/handlers/props, cero cambio de comportamiento.
 *
 * Pulido visual final del POS (aprobado, corregido: "copiar la ESTRUCTURA
 * FLEX del Sidebar del Backoffice, no sus medidas"): ningún tamaño/padding
 * propio del POS se toca (siguen siendo los de siempre, en ambos estados)
 * — lo único que se copia 1:1 de `Sidebar.tsx` es la composición de
 * layout: `<aside>` gana `h-full` explícito, `<nav>` pasa a
 * `min-h-0 flex-1 flex-col justify-between` (mismo mecanismo que ya usa
 * `Sidebar.tsx`: con `justify-between` como distribución y el `gap-6`/
 * `pt-5`/`pb-3` de siempre como separación MÍNIMA entre grupos, el espacio
 * sobrante se reparte parejo entre los 3 grupos en vez de acumularse como
 * un hueco vacío al final) — "Reportes rápidos" queda anclado contra el
 * borde inferior exactamente igual que "Sistema" en el Backoffice, sin
 * ningún margen artificial (`mt-auto` o similar). Mismo ancho, misma
 * expansión por hover, mismas animaciones, cero cambio de comportamiento.
 */
// Pulido visual final del POS (aprobado, "textos más claros y
// profesionales"): "Ventas por producto" -> "Productos vendidos" — mismo
// destino (`/reports/top-products`), nombre más directo para un cajero
// que no administra reportes a diario.
const REPORT_SHORTCUTS: { key: string; label: string; icon: LucideIcon; path: string }[] = [
  { key: 'sales-today', label: 'Ventas del día', icon: ReceiptText, path: '/reports/sales' },
  { key: 'sales-by-product', label: 'Productos vendidos', icon: BarChart3, path: '/reports/top-products' },
]

function SidebarGroupLabel({ children }: { children: string }) {
  return (
    <p className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-[var(--pos-ink-muted)] uppercase">
      <span className="h-3 w-0.5 shrink-0 rounded-full bg-brand/50" />
      {children}
    </p>
  )
}

function SidebarAction({
  label,
  icon: Icon,
  shortcut,
  active = false,
  disabled = false,
  collapsed = false,
  onClick,
}: {
  label: string
  icon: LucideIcon
  shortcut?: string
  active?: boolean
  disabled?: boolean
  /** Riel colapsado (aprobado): solo el icono, con `label`/`shortcut`
   * relegados a `title` (tooltip nativo) — sin componente de tooltip
   * nuevo. */
  collapsed?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={collapsed ? (shortcut ? `${label} (${shortcut})` : label) : undefined}
      aria-label={label}
      className={cn(
        'group flex items-center gap-3 rounded-xl transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-40',
        collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2.5 text-[0.875rem]',
        active
          ? 'bg-brand font-semibold text-brand-foreground shadow-[0_8px_20px_-8px_var(--brand)]'
          : 'font-medium text-[var(--pos-ink-muted)] hover:bg-brand/10 hover:text-[var(--pos-ink)]',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
          active ? 'bg-brand-foreground/15' : 'bg-[var(--pos-bg)] group-hover:bg-brand/10',
        )}
      >
        <Icon
          className={cn(
            'size-[1.15rem] shrink-0 transition-colors duration-200',
            active ? 'text-brand-foreground' : 'text-[var(--pos-ink-muted)] group-hover:text-brand',
          )}
        />
      </span>
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {shortcut && (
            <KbdHint
              className={cn(
                'ml-auto',
                active
                  ? 'border-brand-foreground/25 bg-brand-foreground/10 text-brand-foreground'
                  : 'border-[var(--pos-border)] bg-[var(--pos-bg)] text-[var(--pos-ink-muted)]',
              )}
            >
              {shortcut}
            </KbdHint>
          )}
        </>
      )}
    </button>
  )
}

export function PosSidebar({
  isCashSessionOpen,
  cashSessionId,
  onOpenCashMovement,
  quickActionsRef,
}: PosSidebarProps) {
  const navigate = useNavigate()
  const [isCashSummaryOpen, setIsCashSummaryOpen] = useState(false)
  // Rediseño del POS (aprobado): riel colapsado por defecto — "preferir un
  // comportamiento colapsable antes que ocupar espacio innecesario".
  const [collapsed, setCollapsed] = useState(true)

  return (
    <>
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={cn(
          'relative flex h-full shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-panel)] text-[var(--pos-ink)] shadow-[0_18px_45px_-24px_rgba(0,0,0,0.2)] transition-[width] duration-200',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <nav
          className={cn(
            'flex min-h-0 flex-1 flex-col justify-between gap-6 overflow-y-auto pt-5 pb-3',
            collapsed ? 'px-2.5' : 'px-4',
          )}
        >
          <div className="flex flex-col gap-1.5">
            {!collapsed && <SidebarGroupLabel>Venta</SidebarGroupLabel>}

            <SidebarAction
              label="Nueva venta"
              icon={ShoppingCart}
              active
              collapsed={collapsed}
              onClick={() => quickActionsRef.current?.onNewSale()}
            />
            <SidebarAction
              label="Buscar producto"
              icon={PackageSearch}
              shortcut="F2"
              collapsed={collapsed}
              onClick={() => document.getElementById('pos-product-search')?.focus()}
            />
            <SidebarAction
              label="Descuento rápido"
              icon={Percent}
              collapsed={collapsed}
              onClick={() => quickActionsRef.current?.onFocusDiscount()}
            />
            {/* Bloque POS-05: abre `PromotionsActivationDialog.tsx` (catalogo
                completo de promociones, activar/desactivar) — distinto del
                boton "Promociones" del panel del carrito (solo lectura, solo
                activas), que sigue existiendo sin cambios. Gateado por el
                mismo permiso que ya exige el backend para ver el modulo
                administrativo de Promociones. */}
            <Can permission={PERMISSIONS.PROMOTIONS_VIEW}>
              <SidebarAction
                label="Promociones"
                icon={Tag}
                collapsed={collapsed}
                onClick={() => quickActionsRef.current?.onOpenPromotionsCatalog()}
              />
            </Can>
            <SidebarAction
              label="Devoluciones"
              icon={Undo2}
              disabled={!isCashSessionOpen}
              collapsed={collapsed}
              onClick={() => quickActionsRef.current?.onOpenSessionSales()}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {!collapsed && <SidebarGroupLabel>Caja</SidebarGroupLabel>}

            <SidebarAction
              label="Movimiento de caja"
              icon={ArrowLeftRight}
              shortcut="F4"
              disabled={!isCashSessionOpen}
              collapsed={collapsed}
              onClick={onOpenCashMovement}
            />
            <SidebarAction
              label="Cerrar caja"
              icon={DoorClosed}
              disabled={!cashSessionId}
              collapsed={collapsed}
              onClick={() => cashSessionId && navigate(`/cash-session/${cashSessionId}/close`)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {!collapsed && <SidebarGroupLabel>Reportes rápidos</SidebarGroupLabel>}

            <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg)] p-1.5">
              <SidebarAction
                label="Corte de caja"
                icon={Wallet}
                disabled={!cashSessionId}
                collapsed={collapsed}
                onClick={() => setIsCashSummaryOpen(true)}
              />
              {REPORT_SHORTCUTS.map((report) => (
                <SidebarAction
                  key={report.key}
                  label={report.label}
                  icon={report.icon}
                  collapsed={collapsed}
                  onClick={() => navigate(report.path)}
                />
              ))}
            </div>
          </div>
        </nav>
      </aside>

      <CashSessionSummaryPanel
        open={isCashSummaryOpen}
        onOpenChange={setIsCashSummaryOpen}
        cashSessionId={cashSessionId}
      />
    </>
  )
}
