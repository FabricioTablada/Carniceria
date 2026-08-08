import { useEffect, useState, type Ref } from 'react'
import {
  ArrowLeft,
  Circle,
  Clock,
  MoreVertical,
  Receipt,
  ScanBarcode,
  ShoppingBasket,
  Store,
  Tag,
  User,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react'
import { ProductSearch } from './ProductSearch'
import { Badge } from '@/components/common/Badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { RowMenuItem } from '@/components/ui/RowMenu'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'

interface PosHeaderProps {
  /** Nombre completo del usuario autenticado. */
  userFullName: string
  /** Rol del usuario autenticado. */
  userRole: string
  /** Si existe una sesion de caja abierta — dato real (cashSessionId),
   * no un nombre/numero de caja (ese dato no existe en el sistema). */
  isCashSessionOpen: boolean
  /** Nombre de la sucursal de la sesion de caja activa — mismo dato que ya
   * resuelve `SalesPOSPage.tsx` via `useCashSession` (para `sucursalId`
   * del catalogo), ahora tambien mostrado aca. `undefined` sin sesion. */
  sucursalName?: string
  /** Valor actual del buscador — el estado sigue viviendo en
   * SalesPOSPage.tsx, este componente solo lo recibe y lo refleja. */
  searchTerm: string
  onSearchTermChange: (value: string) => void
  /** Ref al input de busqueda, para el atajo de teclado F2 (SalesPOSPage.tsx). */
  searchInputRef?: Ref<HTMLInputElement>
  /** Bloque POS-03: se dispara al presionar Enter en el buscador — ver
   * `ProductSearch.tsx`/`SalesPOSPage.tsx` (el lector de codigo de barras
   * termina cada escaneo con un Enter automatico). Puramente reenviado,
   * sin logica propia aca. */
  onSearchEnter?: () => void
  /** Se dispara al presionar "Volver a Administracion". */
  onBackToAdmin: () => void
  /** Se dispara al presionar "Ventas de la sesión" — abre
   * `SessionSalesDialog.tsx`. Solo se ofrece si `isCashSessionOpen`. */
  onOpenSessionSales: () => void
  /** Se dispara al presionar el boton de escaneo/codigo de barras, junto
   * al buscador. Bloque 9: solo el punto de entrada visual — hoy
   * `SalesPOSPage.tsx` lo resuelve con `handleBarcodeScanner()`, que
   * unicamente enfoca el buscador (mismo gesto que F2); el handler queda
   * separado a proposito para que integrar un lector de codigo de barras
   * real, mas adelante, sea reemplazar SOLO esa funcion, sin tocar este
   * componente. */
  onScanBarcode: () => void
  /** Rediseño del POS ("centro operativo", aprobado): "que la búsqueda sea
   * el centro de la experiencia" — acceso directo a promociones activas
   * junto al buscador, en vez de solo dentro del panel del carrito. Mismo
   * `handleOpenPromotions`/`PromotionsAvailableDialog.tsx` de siempre, sin
   * lógica nueva. Opcional: sin este prop, el botón no se muestra. */
  onOpenPromotions?: () => void
  /** Cantidad de promociones activas, para el badge del botón de arriba —
   * mismo `activePromotions.length` que ya calcula `SalesPOSPage.tsx`. */
  activePromotionsCount?: number
  /** Rediseño del POS (aprobado, "Header Operativo"): cantidad de
   * unidades/líneas del pedido actual — mismo `itemCount` que ya muestra
   * el badge del encabezado del carrito, solo espejado acá. `undefined`
   * (carrito vacío) se muestra como 0. */
  itemCount?: number
  /** Total en vivo del pedido actual — mismo `quoteData.total` que ya
   * alimenta `CartSummary.tsx`. `undefined` se muestra como 0. */
  total?: number
  /** Bloque 8.3: nombre del cliente seleccionado en la venta actual —
   * `undefined`/vacio muestra "Público general" (comportamiento por
   * defecto, sin cambios respecto a antes de este bloque). */
  customerName?: string
  /** Se dispara al presionar el chip "Cliente" — abre
   * `CustomerSearchDialog.tsx` (`SalesPOSPage.tsx`) para elegir un cliente
   * registrado o volver a "Público General". */
  onOpenCustomerPicker: () => void
}

/** Un dato de la linea de estado ("Caja abierta", "María González"...) —
 * ahora un chip propio (antes texto plano separado por "•"). Reemplaza a
 * `HeaderStat` (rediseño "terminal profesional", aprobado: "sin cajas
 * enormes"; pulido visual posterior: "deben verse como chips modernos"). */
function StatusItem({
  icon: Icon,
  value,
  tone = 'default',
  onClick,
}: {
  icon: LucideIcon
  value: string
  tone?: 'default' | 'success'
  /** Bloque 8.3: cuando se pasa, el chip se renderiza como boton
   * interactivo (usado por "Cliente", para abrir el selector) en vez del
   * `<span>` de solo lectura de siempre — mismo look, solo agrega
   * hover/cursor. */
  onClick?: () => void
}) {
  const className = cn(
    'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium',
    tone === 'success'
      ? 'border-success/25 bg-success/10 text-success'
      : 'border-[var(--pos-border)] bg-[var(--pos-bg)] text-[var(--pos-ink-muted)]',
    onClick && 'cursor-pointer transition-colors hover:border-brand/40 hover:text-brand',
  )
  const iconClassName = cn(
    'size-3.5',
    tone === 'success' ? 'text-success' : 'text-[var(--pos-ink-muted)]',
  )
  const valueClassName = tone === 'success' ? 'text-success' : 'text-[var(--pos-ink)]'

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <Icon className={iconClassName} />
        <span className={valueClassName}>{value}</span>
      </button>
    )
  }

  return (
    <span className={className}>
      <Icon className={iconClassName} />
      <span className={valueClassName}>{value}</span>
    </span>
  )
}

/**
 * components/PosHeader.tsx
 * -----------------------------------------------------------------------------
 * Presentacion pura: no lee ningun store ni hook directamente. Toda la
 * informacion (usuario, busqueda, estado de caja, sucursal, navegacion) la
 * resuelve SalesPOSPage.tsx y se pasa via props.
 *
 * La hora/fecha son la unica excepcion: dato puramente de presentacion sin
 * ninguna fuente de datos real, generado localmente con un timer.
 *
 * Rediseño del POS ("terminal profesional", aprobado): "barra superior
 * simplificada — una sola línea, sin tarjetas administrativas". Los 4
 * indicadores (Caja/Cajero/Sucursal/Hora, antes `HeaderStat` — tarjetas
 * con icono/label/valor, mismo lenguaje que los KPI de Caja) pasan a
 * texto plano separado por "•" (`StatusItem`/`StatusSeparator`, arriba) —
 * mismos datos/props de siempre, sin ningún cálculo nuevo. Superficie
 * propia del POS (`--pos-bg`/`--pos-border`/`--pos-ink`, `.pos-surface`
 * en `index.css`), ya no `bg-pos-content` (token compartido con
 * `DashboardLayout.tsx`).
 *
 * El buscador es el elemento mas grande/prominente de la franja (mismo
 * `ProductSearch`, sin cambios de comportamiento) — escaneo y promociones
 * inmediatamente al lado, la linea de estado y las acciones de usuario
 * (notificaciones/"Más opciones") a la derecha.
 *
 * Pulido visual (aprobado, "chips modernos, mas aire, mejor jerarquia"):
 * los 4 indicadores pasan de texto plano con separador "•" a chips
 * individuales (`StatusItem`, con borde/fondo propio); "Promociones" se
 * unifica al mismo lenguaje visual (misma forma de pastilla que los
 * chips de estado, en vez del boton rectangular anterior). Mas espacio
 * entre grupos (`gap-3` -> `gap-2.5` entre chips, `gap-3` -> `gap-4`
 * entre secciones) y altura de franja ligeramente mayor (`py-2` ->
 * `py-2.5`). Mismos props/handlers, cero cambio de comportamiento.
 */
export function PosHeader({
  userFullName,
  isCashSessionOpen,
  sucursalName,
  searchTerm,
  onSearchTermChange,
  searchInputRef,
  onSearchEnter,
  onBackToAdmin,
  onOpenSessionSales,
  onScanBarcode,
  onOpenPromotions,
  activePromotionsCount = 0,
  itemCount = 0,
  total = 0,
  customerName,
  onOpenCustomerPicker,
}: PosHeaderProps) {
  const [now, setNow] = useState(() => new Date())
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 1000 * 30)
    return () => clearInterval(intervalId)
  }, [])

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="flex flex-col border-b border-[var(--pos-border)] bg-[var(--pos-panel)]">
    <div className="flex items-center gap-4 px-4 py-2.5">
      <div className="min-w-40 flex-1">
        <ProductSearch
          value={searchTerm}
          onChange={onSearchTermChange}
          inputRef={searchInputRef}
          onEnter={onSearchEnter}
        />
      </div>

      <button
        type="button"
        onClick={onScanBarcode}
        aria-label="Escanear código de barras"
        className="flex h-11 shrink-0 items-center justify-center rounded-full border border-[var(--pos-border)] bg-[var(--pos-bg)] px-3.5 text-[var(--pos-ink-muted)] transition-colors hover:border-brand/40 hover:text-brand"
      >
        <ScanBarcode className="size-5" />
      </button>

      {onOpenPromotions && (
        <button
          type="button"
          onClick={onOpenPromotions}
          className="relative flex h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--pos-border)] bg-[var(--pos-bg)] px-3.5 text-sm font-semibold text-[var(--pos-ink)] transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Tag className="size-4 shrink-0" />
          Promociones
          {activePromotionsCount > 0 && (
            <Badge variant="accent" className="ml-0.5">
              {activePromotionsCount}
            </Badge>
          )}
        </button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <NotificationBell />

        <Popover open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
          <PopoverTrigger
            aria-label="Más opciones"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--pos-ink-muted)] transition-colors hover:bg-[var(--pos-bg)] hover:text-[var(--pos-ink)]"
          >
            <MoreVertical className="size-4" />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            positionerClassName="z-[60]"
            // Fix: este popover se renderiza en un Portal (fuera del
            // subarbol `.pos-surface`, ver `PosLayout.tsx`), asi que
            // `var(--pos-border)`/`var(--pos-panel)` nunca resuelven ahi —
            // el panel quedaba sin fondo/borde real, transparentandose
            // con el contenido del POS detras. Se usan los tokens
            // genericos del sistema de diseno (`bg-popover`/`border`, ya
            // el default de `PopoverContent` cuando no se sobreescriben)
            // — mismo criterio ya aplicado al dialogo de Movimiento de
            // caja (`PosLayout.tsx`) para el mismo problema.
            className="w-56 p-1.5"
          >
            <div className="flex flex-col gap-0.5">
              {isCashSessionOpen && (
                <RowMenuItem
                  icon={Receipt}
                  onClick={() => {
                    onOpenSessionSales()
                    setIsMoreMenuOpen(false)
                  }}
                >
                  Ventas de la sesión
                </RowMenuItem>
              )}
              <RowMenuItem
                icon={ArrowLeft}
                onClick={() => {
                  onBackToAdmin()
                  setIsMoreMenuOpen(false)
                }}
              >
                Volver a Administración
              </RowMenuItem>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>

    {/* Rediseño del POS (aprobado, "Header Operativo"): segunda franja,
        siempre visible, con los datos que el cajero debe tener a la vista
        en todo momento — mismos datos/props de siempre (Caja/Cajero/
        Sucursal/Hora ya viajaban a este componente; Ítems/Total son
        aditivos, ya calculados en `SalesPOSPage.tsx`). El Total, al final,
        es el elemento con más contraste de la franja — se lee sin mirar
        el carrito.
        Bloque 8.3: "Cliente" deja de ser un chip fijo — ahora es
        interactivo (`StatusItem` con `onClick`), muestra el cliente
        seleccionado o "Público general" por defecto, y abre
        `CustomerSearchDialog.tsx` para cambiarlo o volver a Público
        General. */}
    <div className="flex min-w-0 items-center gap-2.5 overflow-x-auto border-t border-[var(--pos-border)]/70 bg-[var(--pos-bg)] px-4 py-1.5 whitespace-nowrap">
      <StatusItem
        icon={Circle}
        value={isCashSessionOpen ? 'Caja abierta' : 'Caja cerrada'}
        tone={isCashSessionOpen ? 'success' : 'default'}
      />
      <StatusItem icon={User} value={userFullName} />
      {sucursalName && <StatusItem icon={Store} value={sucursalName} />}
      <StatusItem icon={UserCircle2} value={customerName || 'Público general'} onClick={onOpenCustomerPicker} />
      <StatusItem icon={Clock} value={time} />
      <StatusItem icon={ShoppingBasket} value={`${itemCount} ${itemCount === 1 ? 'ítem' : 'ítems'}`} />
      <span className="ml-auto flex shrink-0 items-baseline gap-1.5 pl-2">
        <span className="text-[0.625rem] font-bold tracking-wide text-[var(--pos-ink-muted)] uppercase">
          Total
        </span>
        <span className="font-mono text-base font-extrabold tabular-nums text-brand">
          {formatCurrency(total)}
        </span>
      </span>
    </div>
    </header>
  )
}
