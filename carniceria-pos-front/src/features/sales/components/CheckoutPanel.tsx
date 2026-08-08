import { useEffect, useRef } from 'react'
import { ArrowLeft, Banknote, CreditCard, Landmark, Layers, Smartphone, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KbdHint } from '@/components/ui/KbdHint'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { ELECTRONIC_PAYMENT_METHODS, PAYMENT_METHOD_OPTIONS, getQuickCashAmounts } from '../utils/payment'
import type { PaymentMethod } from '../types/sale.types'
import { CartSummary } from './CartSummary'
import { NumericKeypad } from './NumericKeypad'

// Icono de cada tarjeta (rediseño del POS): local a este archivo, NO
// exportado — `PAYMENT_METHOD_OPTIONS` (valor+etiqueta, sin icono) vive en
// `utils/payment.ts` para que este archivo solo exporte el componente
// `CheckoutPanel` (`react-refresh/only-export-components`).
const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  SINPE_MOVIL: Smartphone,
  TRANSFER: Landmark,
  MIXED: Layers,
}

/** Métodos que admiten "monto recibido" (para calcular vuelto) — CASH
 * siempre, MIXED porque suele incluir una porción en efectivo. Los 100%
 * electrónicos (`ELECTRONIC_PAYMENT_METHODS`) no lo necesitan: se asume
 * pago exacto, igual que hoy. */
const CASH_TENDER_METHODS: PaymentMethod[] = ['CASH', 'MIXED']

interface CheckoutPanelProps {
  /** Metodo de pago seleccionado. Estado y valor inicial decididos por el padre. */
  paymentMethod: PaymentMethod
  /** Se dispara al cambiar el metodo de pago seleccionado. */
  onPaymentMethodChange: (value: PaymentMethod) => void
  /** Referencia del pago electronico (numero de autorizacion/voucher,
   * comprobante SINPE o numero de transferencia). Solo se pide/muestra
   * cuando `paymentMethod` esta en `ELECTRONIC_PAYMENT_METHODS`. */
  paymentReference: string
  /** Se dispara al cambiar el texto de la referencia. */
  onPaymentReferenceChange: (value: string) => void
  /** Se dispara al presionar "Confirmar cobro" — registra la venta
   * directamente (Rediseño del POS, aprobado: el panel de cobro ya no es
   * un `Dialog` intermedio, es el propio paso de confirmación). */
  onConfirmSale: () => void
  /** Controla si el boton de confirmar esta deshabilitado. Decidido por el padre. */
  confirmDisabled: boolean
  /** Rediseño del POS ("centro operativo", aprobado): total ya calculado
   * por `POST /sales/quote` (mismo dato que `CartSummary.tsx`) — necesario
   * aca para calcular el vuelto en vivo. */
  total: number
  /** Pulido visual (aprobado, "Resumen del cobro"): mismos valores que ya
   * calcula/pasa `SalesPOSPage.tsx` a `CartSummary.tsx` en la columna del
   * pedido — se reutilizan tal cual (mismo componente `CartSummary`, sin
   * duplicar el calculo) para mostrar el mismo resumen dentro del panel
   * de cobro. */
  subtotal: number
  taxTotal: number
  automaticDiscountTotal: number
  discountAmount: number
  /** Cantidad total de unidades del pedido (`cart.reduce(...)`, mismo
   * valor que ya muestra el badge del encabezado "Pedido") — se agrega
   * como fila propia aca porque `CartSummary.tsx` deliberadamente no la
   * muestra (ver su propio comentario "Pulido de layout"). */
  itemCount: number
  /** Monto recibido, como texto (mismo criterio que `paymentReference`:
   * estado del padre, este componente no lo interpreta más que para
   * mostrar el vuelto). Reutiliza `CreateSaleDto.amountPaid`, ya
   * soportado por el backend — antes nunca se enviaba. */
  amountPaid: string
  onAmountPaidChange: (value: string) => void
  /** Vuelve al carrito (Modo Vender) sin registrar nada — mismo criterio
   * que "Cancelar" del `SaleConfirmDialog.tsx` que este panel reemplaza. */
  onBack: () => void
  isConfirming?: boolean
  /** Rediseño del POS (aprobado, "autofocus en Monto recibido"): `true`
   * mientras el panel es el que realmente se ve (`posMode === 'charge'` en
   * `SalesPOSPage.tsx`) — este componente sigue montado siempre (panel
   * deslizante animado por ancho, nunca desmontado), así que un simple
   * `useEffect` al montar no alcanza para detectar "recién se entró a
   * Modo Cobrar"; se necesita esta transición explícita. `true` por
   * defecto para no romper ningún otro uso futuro que no la pase. */
  active?: boolean
}

/**
 * features/sales/components/CheckoutPanel.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del POS ("centro operativo", aprobado): deja de ser la franja
 * de pago siempre visible al pie del carrito — ahora es el contenido del
 * panel de cobro ACOPLADO (Modo Cobrar), que `SalesPOSPage.tsx` monta al
 * lado del carrito (nunca como modal) solo mientras se está cobrando. El
 * pedido permanece visible en todo momento junto a este panel — ver
 * `SalesPOSPage.tsx`.
 *
 * Reemplaza a `SaleConfirmDialog.tsx` como paso de confirmación: antes,
 * "Cobrar" abría un `Dialog` con el resumen + "Confirmar venta"; ahora
 * ESTE panel (ya visible, con el pedido al lado) es esa confirmación —
 * `onConfirmSale` es la misma `handleConfirmSale` de siempre.
 * `SaleConfirmDialog.tsx` no se eliminó (sigue existiendo como componente
 * reutilizable), solo se dejó de usar en este flujo.
 *
 * Nuevo: "Monto recibido" + montos rápidos + vuelto en vivo, solo para
 * CASH/MIXED — reutiliza `CreateSaleDto.amountPaid` (ya soportado por el
 * backend, `sales.service.ts` ya calcula `changeGiven` a partir de él);
 * el POS simplemente nunca lo enviaba. Sin cálculo nuevo del lado del
 * servidor: el vuelto que se ve acá es el mismo `amountPaid - total` que
 * el backend recalculará al guardar.
 *
 * Métodos de pago: mismos 5, misma grilla de tarjetas (`PAYMENT_METHOD_ICONS`
 * local, sin cambios) — solo se reordena el layout general del panel.
 *
 * Rediseño final del POS (aprobado, "terminal de pago profesional"):
 * colores restyleados de tokens compartidos con el Backoffice (`bg-card`,
 * `border`, `text-foreground`/`text-muted-foreground`) a los tokens
 * exclusivos del POS (`--pos-*`, `.pos-surface` en `index.css`) — mismo
 * markup, mismos handlers, cero cambios de comportamiento.
 *
 * Pulido visual (aprobado, "Modo Cobrar" — mismo flujo, sin cambios de
 * logica): el panel ahora ocupa TODO el ancho que `SalesPOSPage.tsx` le
 * cede (antes una franja fija de 384px dejaba el resto de la pantalla en
 * blanco).
 *
 * Rehecho (aprobado, "NO APROBADO — parecía un formulario centrado, no la
 * pantalla de cobro de un POS profesional"): la primera version centraba
 * todo en una columna angosta (`max-w-xl`) con tres tarjetas apiladas —
 * el resto del ancho quedaba vacio. Ahora es un verdadero workspace de
 * dos niveles, sin ninguna columna centrada:
 *  1. Metodos de pago: una fila que ocupa TODO el ancho del panel
 *     (`grid-cols-5`, uno por metodo).
 *  2. Debajo, una grilla de 2 columnas que se reparte el resto del alto
 *     disponible (`flex-1`, columnas `h-full`): a la izquierda "Resumen
 *     del cobro" (reutiliza `CartSummary.tsx` + `itemCount`, sin ningun
 *     calculo nuevo); a la derecha "Monto recibido" + montos rapidos +
 *     "Vuelto" (CASH/MIXED) o "Referencia de pago" (metodos electronicos)
 *     — nunca ambos a la vez, los 5 metodos son mutuamente excluyentes
 *     entre `CASH_TENDER_METHODS`/`ELECTRONIC_PAYMENT_METHODS`.
 * "Confirmar cobro" queda fijo al final, ancho completo, fuera de la
 * grilla (mismo boton/handler de siempre). Mismos props, mismo estado,
 * mismos handlers — unicamente cambia la distribucion visual.
 *
 * Implementacion de la maqueta aprobada (bloque "Modo Cobrar", sin
 * cambios de logica de negocio):
 *  - Montos rapidos YA NO son fijos — `getQuickCashAmounts(total)`
 *    (`utils/payment.ts`) calcula 3 sugerencias de billetes reales de
 *    colones a partir del total, mas "Exacto" (sin cambios). Mismo
 *    `onAmountPaidChange` de siempre.
 *  - Numpad tactil (`NumericKeypad`, arriba) para cargar "Monto recibido"
 *    sin depender del teclado fisico — escribe sobre el mismo string
 *    `amountPaid`, cero estado/logica nueva.
 *  - "Confirmar cobro" queda FIJO fuera del area con scroll: el resto del
 *    panel (metodos de pago + grilla de resumen/cobro) vive en un
 *    contenedor `overflow-y-auto` propio; el boton es un hermano
 *    `shrink-0` fuera de ese contenedor, nunca se desplaza con el scroll.
 */
export function CheckoutPanel({
  paymentMethod,
  onPaymentMethodChange,
  paymentReference,
  onPaymentReferenceChange,
  onConfirmSale,
  confirmDisabled,
  total,
  subtotal,
  taxTotal,
  automaticDiscountTotal,
  discountAmount,
  itemCount,
  amountPaid,
  onAmountPaidChange,
  onBack,
  isConfirming = false,
  active = true,
}: CheckoutPanelProps) {
  const requiresPaymentReference = ELECTRONIC_PAYMENT_METHODS.includes(paymentMethod)
  const requiresCashTender = CASH_TENDER_METHODS.includes(paymentMethod)
  const parsedAmountPaid = Number(amountPaid) || 0
  const changeDue = requiresCashTender && parsedAmountPaid > total ? parsedAmountPaid - total : 0
  const hasExactPayment = requiresCashTender && parsedAmountPaid > 0 && changeDue === 0
  const quickCashAmounts = getQuickCashAmounts(total)

  // Rediseño del POS (aprobado, "autofocus en Monto recibido"): al entrar
  // a Modo Cobrar con un método que pide monto (Efectivo/Mixto), el campo
  // ya queda listo para tipear sin un click previo — mismo criterio ya
  // aplicado al buscador del catálogo (foco automático al entrar al POS).
  const amountInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (active && requiresCashTender) {
      amountInputRef.current?.focus()
    }
  }, [active, requiresCashTender])

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <div className="flex shrink-0 items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 gap-1.5 text-[var(--pos-ink-muted)] hover:bg-[var(--pos-ink)]/10 hover:text-[var(--pos-ink)]"
          >
            <ArrowLeft className="size-4" />
            Volver al pedido
          </Button>
          <KbdHint className="border-[var(--pos-border)] bg-[var(--pos-ink)]/5 text-[var(--pos-ink-muted)]">ESC</KbdHint>
        </div>

        {/* Nivel 1: metodos de pago, fila completa (todo el ancho del panel). */}
        <div className="flex shrink-0 flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-[var(--pos-ink-muted)] uppercase">
            Método de pago
          </span>
          <div className="grid grid-cols-5 gap-3">
            {PAYMENT_METHOD_OPTIONS.map((option) => {
              const isActive = paymentMethod === option.value
              const Icon = PAYMENT_METHOD_ICONS[option.value]

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onPaymentMethodChange(option.value)}
                  aria-pressed={isActive}
                  className={cn(
                    'flex flex-col items-center gap-2.5 rounded-2xl border bg-[var(--pos-panel)] px-2 py-5 text-center transition-all duration-150 ease-out',
                    isActive
                      ? 'border-brand shadow-[0_8px_20px_-10px_var(--brand)] ring-1 ring-brand'
                      : 'border-[var(--pos-border)] hover:border-brand/30 hover:bg-[var(--pos-ink)]/5',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
                      isActive ? 'bg-brand text-brand-foreground' : 'bg-[var(--pos-ink)]/10 text-[var(--pos-ink-muted)]',
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span
                    className={cn(
                      'text-xs leading-tight font-semibold',
                      isActive ? 'text-brand' : 'text-[var(--pos-ink)]',
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Nivel 2: grilla de 2 columnas que reparte TODO el ancho/alto
            restante — nunca una columna centrada. Izquierda: resumen.
            Derecha: monto recibido + numpad + vuelto (CASH/MIXED) o
            referencia de pago (metodos electronicos) — mutuamente
            excluyentes: la zona nunca queda vacia. */}
        <div className="grid flex-1 grid-cols-2 gap-4">
          {/* "Resumen del cobro": mismos datos que `CartSummary.tsx` ya
              muestra en la columna del pedido — se reutiliza el mismo
              componente tal cual, sin duplicar ningun calculo (incluye
              Subtotal/Impuestos/Promociones automaticas/Descuento manual/
              Total), mas la fila de cantidad de productos (dato que
              `CartSummary` omite a proposito, ver su propio comentario). */}
          <div className="flex h-full flex-col gap-2 rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-1 shadow-[0_20px_48px_-28px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between px-4 pt-3 text-sm">
              <span className="text-xs font-semibold tracking-wide text-[var(--pos-ink-muted)] uppercase">
                Resumen del cobro
              </span>
              <span className="text-[var(--pos-ink-muted)]">
                {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <CartSummary
                subtotal={subtotal}
                taxTotal={taxTotal}
                automaticDiscountTotal={automaticDiscountTotal}
                discountAmount={discountAmount}
                total={total}
              />
            </div>
          </div>

          <div className="flex h-full flex-col gap-3 rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-panel)] p-5 shadow-[0_20px_48px_-28px_rgba(0,0,0,0.25)]">
            {requiresCashTender && (
              <>
                {/* "Monto recibido" es el foco visual principal del panel
                    de cobro (aprobado) — input centrado, tipografia mucho
                    mas grande que el resto del formulario. */}
                <div className="flex flex-col items-center gap-2">
                  <Label
                    htmlFor="pos-amount-paid"
                    className="text-xs font-semibold tracking-wide text-[var(--pos-ink-muted)] uppercase"
                  >
                    Monto recibido
                  </Label>
                  <Input
                    id="pos-amount-paid"
                    ref={amountInputRef}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={formatCurrency(total)}
                    value={amountPaid}
                    onChange={(event) => onAmountPaidChange(event.target.value)}
                    className="h-16 w-full rounded-2xl border-[var(--pos-border)] bg-[var(--pos-panel-2)] text-center text-3xl font-extrabold tabular-nums text-[var(--pos-ink)]"
                  />
                </div>

                {/* Montos rapidos (aprobado, "ya no deben ser fijos"):
                    `getQuickCashAmounts(total)` calcula 3 billetes reales
                    a partir del total — "Exacto" se mantiene sin cambios. */}
                <div className="grid grid-cols-4 gap-2">
                  {quickCashAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => onAmountPaidChange(String(amount))}
                      className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] px-1 py-3 text-xs font-bold text-[var(--pos-ink)] transition-colors hover:border-brand/30 hover:bg-[var(--pos-ink)]/5"
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onAmountPaidChange(String(total))}
                    className="rounded-xl border border-brand/40 bg-brand/10 px-1 py-3 text-xs font-bold text-brand transition-colors hover:bg-brand/15"
                  >
                    Exacto
                  </button>
                </div>

                {/* Numpad tactil (aprobado, "mantén el numpad tactil para
                    el ingreso del monto recibido"). */}
                <div className="flex-1">
                  <NumericKeypad value={amountPaid} onChange={onAmountPaidChange} />
                </div>

                <div
                  className={cn(
                    'flex items-center justify-between rounded-2xl px-4 py-4',
                    changeDue > 0 ? 'bg-success/15' : 'bg-[var(--pos-panel-2)]',
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-bold tracking-wide uppercase',
                      changeDue > 0 ? 'text-success' : 'text-[var(--pos-ink-muted)]',
                    )}
                  >
                    {hasExactPayment ? 'Pago exacto' : 'Vuelto'}
                  </span>
                  <span
                    className={cn(
                      'text-3xl font-extrabold tabular-nums',
                      changeDue > 0 ? 'text-success' : 'text-[var(--pos-ink)]',
                    )}
                  >
                    {formatCurrency(changeDue)}
                  </span>
                </div>
              </>
            )}

            {requiresPaymentReference && (
              <div className="flex flex-1 flex-col justify-center gap-2">
                <Label
                  htmlFor="pos-payment-reference"
                  className="text-xs font-semibold tracking-wide text-[var(--pos-ink-muted)] uppercase"
                >
                  Referencia de pago
                </Label>
                <Input
                  id="pos-payment-reference"
                  placeholder="N.º de autorización, comprobante SINPE o transferencia"
                  value={paymentReference}
                  onChange={(event) => onPaymentReferenceChange(event.target.value)}
                  aria-invalid={paymentReference.trim().length === 0}
                  className="h-14 rounded-xl border-[var(--pos-border)] bg-[var(--pos-panel-2)] text-lg text-[var(--pos-ink)]"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* "Confirmar cobro" fijo (aprobado, "debe permanecer fijo en la
          parte inferior durante todo el proceso, aunque exista scroll") —
          hermano FUERA del contenedor `overflow-y-auto` de arriba, nunca
          se desplaza con el scroll del resto del panel. */}
      <div className="shrink-0 border-t border-[var(--pos-border)] bg-[var(--pos-bg)] px-6 py-4">
        <Button
          type="button"
          onClick={onConfirmSale}
          disabled={confirmDisabled}
          className="h-[4.5rem] w-full rounded-[1.25rem] bg-brand text-xl font-extrabold text-brand-foreground shadow-[0_14px_32px_-10px_oklch(0.4708_0.1367_24_/_0.6)] transition-transform duration-150 hover:bg-brand-hover active:scale-[0.99] active:bg-brand-active"
        >
          <span className="flex w-full items-center justify-between px-2">
            {isConfirming ? 'Confirmando...' : 'Confirmar cobro'}
            <KbdHint className="border-brand-foreground/30 bg-brand-foreground/15 text-brand-foreground">
              F8
            </KbdHint>
          </span>
        </Button>
      </div>
    </div>
  )
}
