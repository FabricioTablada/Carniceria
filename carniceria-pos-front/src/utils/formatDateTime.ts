/**
 * utils/formatDateTime.ts
 * -----------------------------------------------------------------------------
 * Formatea un timestamp (fecha y hora) en zona horaria de Costa Rica
 * (`America/Costa_Rica`), sin depender de la zona horaria del
 * sistema/navegador donde corra el codigo. Dia, mes, anio y hora se
 * calculan todos desde la misma conversion (`Intl.DateTimeFormat`), para
 * que nunca queden inconsistentes entre si.
 */

const dateTimeFormatter = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Formatea `value` (ISO string) como `"DD/MM/YYYY HH:mm"` en hora de
 * Costa Rica. Devuelve `'—'` si `value` es `null`, `undefined`, o no
 * representa una fecha valida.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  const parts = dateTimeFormatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}