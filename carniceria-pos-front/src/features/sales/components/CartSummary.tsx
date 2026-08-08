import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'

interface CartSummaryProps {
  /** Subtotal de la venta antes de impuestos (Bloque P.8.2: ya incorpora
   * el efecto de las promociones automaticas de linea/categoria, tal como
   * lo devuelve `POST /sales/quote` — no es un subtotal "bruto"). */
  subtotal: number
  /** Total de impuestos de la venta. */
  taxTotal: number
  /** Suma de TODOS los descuentos automaticos (linea + carrito, Bloque
   * P.8.2, `quote.data.automaticDiscountTotal`) — cifra informativa, ya
   * incorporada en `subtotal`/`total`, no se resta de nuevo aca. Distinta
   * de `discountAmount` (el descuento MANUAL que si escribe el cajero). */
  automaticDiscountTotal: number
  /** Monto del descuento MANUAL de carrito ya calculado (0 si no hay
   * descuento) — `quote.data.discountTotal`. */
  discountAmount: number
  /** Total final de la venta (subtotal + impuestos - descuento manual). */
  total: number
  /** Bloque P.8.2: `true` mientras `POST /sales/quote` recalcula en
   * segundo plano (debounce pendiente o `isFetching`) — indicador
   * discreto, nunca bloquea la edicion del carrito ni reemplaza los
   * numeros ya visibles (`useSaleQuote` los mantiene via
   * `keepPreviousData`). */
  isUpdating?: boolean
}

/**
 * features/sales/components/CartSummary.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del POS (aprobado): deja de ser una `Card` con header `text-xs`
 * — es una seccion mas de la composicion unica del carrito. El TOTAL pasa
 * a ser el elemento tipografico mas grande de toda la columna derecha
 * (mayor que el reloj del header), como corresponde al dato mas
 * importante de la pantalla.
 *
 * Bloque P.8.2: presentacion pura — TODOS los numeros que recibe vienen
 * ya calculados por `POST /sales/quote` (via `useSaleQuote()` en
 * `SalesPOSPage.tsx`); este componente no suma ni resta nada, solo
 * formatea y muestra.
 *
 * Pulido de layout (aprobado, "compactar el bloque de totales"): se quito
 * la fila "Cantidad de productos" — mismo numero (`itemCount`) que ya
 * muestra el badge del encabezado del carrito, quedaba duplicado. Padding
 * `px-4 py-3` -> `px-3 py-2`, TOTAL `text-4xl` -> `text-3xl` (sigue siendo
 * el elemento tipografico mas grande del panel, solo un poco mas
 * compacto). `itemCount` se mantiene como prop (lo sigue usando
 * `SalesPOSPage.tsx` en otros calculos) aunque ya no se pinte aca.
 *
 * Rediseño del POS ("centro operativo", aprobado): "el TOTAL debe ser el
 * elemento visual mas importante de toda la pantalla" — vuelve a crecer
 * (`text-3xl` -> `text-4xl`), con mas contraste de fondo
 * (`bg-brand/5` -> `bg-brand/10`) y una transicion suave al cambiar de
 * valor (`transition-colors`, puramente visual). Mismos numeros, misma
 * fuente de datos (`POST /sales/quote`), sin ningun calculo nuevo.
 *
 * Rediseño del POS ("terminal profesional", aprobado): "el total debe
 * tener todavía mayor protagonismo visual" — crece una vez mas
 * (`text-4xl` -> `text-5xl`) sobre un bloque con degradado sutil
 * (`bg-gradient-to-br from-brand/15`) en vez de un fondo plano. Filas
 * secundarias (Subtotal/Impuestos/Promociones/Descuento) usan la
 * superficie EXCLUSIVA del POS (`--pos-ink-muted`/`--pos-ink`) — este
 * componente solo se usa dentro del POS (`SalesPOSPage.tsx`), asi que no
 * hay riesgo de afectar ninguna pantalla del Backoffice.
 *
 * Pulido visual (aprobado, "el TOTAL debe destacar mucho más, mejor
 * separación"): un divisor propio (`border-t`) separa visualmente las
 * filas secundarias del bloque TOTAL (antes solo un `mt-1.5`, sin
 * quiebre real); el bloque TOTAL gana borde propio con el color de marca
 * (`border-brand/20`) ademas del degradado, para que se lea como una
 * tarjeta propia dentro del panel en vez de una franja mas.
 */
export function CartSummary({
  subtotal,
  taxTotal,
  automaticDiscountTotal,
  discountAmount,
  total,
  isUpdating = false,
}: CartSummaryProps) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 text-sm">
      <div className="flex flex-col gap-1 border-b border-[var(--pos-border)] pb-2">
        <div className="flex items-center justify-between">
          <span className="text-[var(--pos-ink-muted)]">Subtotal</span>
          <span className="font-medium tabular-nums text-[var(--pos-ink)]">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[var(--pos-ink-muted)]">Impuestos</span>
          <span className="font-medium tabular-nums text-[var(--pos-ink)]">{formatCurrency(taxTotal)}</span>
        </div>

        {automaticDiscountTotal > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[var(--pos-ink-muted)]">Promociones</span>
            <span className="font-medium tabular-nums text-accent-amber">
              -{formatCurrency(automaticDiscountTotal)}
            </span>
          </div>
        )}

        {discountAmount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[var(--pos-ink-muted)]">Descuento</span>
            <span className="font-medium tabular-nums text-destructive">
              -{formatCurrency(discountAmount)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-1 flex flex-col items-center gap-0.5 rounded-xl border border-brand/20 bg-gradient-to-br from-brand/20 via-brand/10 to-transparent px-3 py-3.5 text-center shadow-[0_10px_24px_-16px_var(--brand)] transition-colors duration-200">
        <span className="flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-brand uppercase">
          Total
          {isUpdating && (
            <Loader2
              className="size-3.5 animate-spin text-[var(--pos-ink-muted)]"
              aria-label="Actualizando cotización"
            />
          )}
        </span>
        <span className="text-5xl leading-none font-extrabold tracking-tight tabular-nums text-[var(--pos-ink)] transition-all duration-200">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}
