import { Delete } from 'lucide-react'

interface NumericKeypadProps {
  value: string
  onChange: (value: string) => void
  /** `'currency'` (default): mismo teclado de siempre para "Monto
   * recibido" — dígitos + "00" + "0" + borrar, sin ceros a la izquierda
   * repetidos (criterio de caja registradora). `'decimal'`: agrega un
   * separador decimal en vez de "00" — para "Peso (kg)", donde el valor
   * SIEMPRE necesita decimales. */
  variant?: 'currency' | 'decimal'
}

/**
 * features/sales/components/NumericKeypad.tsx
 * -----------------------------------------------------------------------------
 * Rediseño del POS (aprobado, "venta por peso — mismo teclado numérico que
 * el panel de cobro"): extraído tal cual de `CheckoutPanel.tsx` (donde
 * vivía como función local, sin cambiar su comportamiento — `variant`
 * `'currency'` es exactamente ese mismo teclado) para reutilizarse también
 * en `ProductWeightDialog.tsx` (`variant='decimal'`) — un solo componente,
 * dos consumidores, en vez de duplicar el markup. Opera siempre sobre el
 * MISMO string que ya recibía el input nativo correspondiente
 * (`amountPaid`/el peso tipeado) — ningún estado ni lógica nueva, cada
 * tecla solo escribe/borra un carácter, lo mismo que tipearía el usuario.
 */
export function NumericKeypad({ value, onChange, variant = 'currency' }: NumericKeypadProps) {
  const appendDigits = (digits: string) => {
    const next = `${value}${digits}`
    // Sin ceros a la izquierda repetidos (ej. evitar "007") — mismo
    // criterio que cualquier caja registradora real. Para peso ("1.240"),
    // esto solo actua sobre la parte ANTES del separador decimal, que es
    // exactamente el mismo caso ("00" nunca aparece antes de un punto ya
    // escrito).
    onChange(next.replace(/^0+(?=\d)/, ''))
  }

  const appendDecimalSeparator = () => {
    if (value.includes('.')) {
      return
    }
    onChange(value.length === 0 ? '0.' : `${value}.`)
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => appendDigits(digit)}
          className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] py-3 text-lg font-bold text-[var(--pos-ink)] transition-colors hover:border-brand/30 hover:bg-[var(--pos-ink)]/5"
        >
          {digit}
        </button>
      ))}
      {variant === 'currency' ? (
        <button
          type="button"
          onClick={() => appendDigits('00')}
          className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] py-3 text-base font-bold text-[var(--pos-ink)] transition-colors hover:border-brand/30 hover:bg-[var(--pos-ink)]/5"
        >
          00
        </button>
      ) : (
        <button
          type="button"
          onClick={appendDecimalSeparator}
          className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] py-3 text-lg font-bold text-[var(--pos-ink)] transition-colors hover:border-brand/30 hover:bg-[var(--pos-ink)]/5"
        >
          ,
        </button>
      )}
      <button
        type="button"
        onClick={() => appendDigits('0')}
        className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] py-3 text-lg font-bold text-[var(--pos-ink)] transition-colors hover:border-brand/30 hover:bg-[var(--pos-ink)]/5"
      >
        0
      </button>
      <button
        type="button"
        onClick={() => onChange(value.slice(0, -1))}
        aria-label="Borrar último dígito"
        className="flex items-center justify-center rounded-xl border border-[var(--pos-border)] bg-[var(--pos-panel-2)] py-3 text-[var(--pos-ink-muted)] transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
      >
        <Delete className="size-5" />
      </button>
    </div>
  )
}
