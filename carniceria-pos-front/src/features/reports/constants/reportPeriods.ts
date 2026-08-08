/**
 * features/reports/constants/reportPeriods.ts
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado, "mantener sincronizado el selector de
 * período entre el Centro de Análisis y los reportes"): un único rango de
 * fechas (`dateFrom`/`dateTo`, mismo formato `YYYY-MM-DD` que ya aceptan
 * todos los filtros `Fecha desde`/`Fecha hasta` existentes — ver
 * `SalesReportFilters.tsx`) que alimenta los KPIs/gráficos del índice y
 * que, al navegar a un reporte puntual desde el índice, viaja como
 * `location.state` para pre-cargar ese mismo rango en sus filtros — sin
 * persistir nada, sin backend nuevo, sin ningún cálculo de negocio: solo
 * aritmética de fechas en el cliente, el mismo tipo de dato que el usuario
 * ya podía escribir a mano en cualquier filtro "Fecha desde"/"Fecha hasta".
 */
export type ReportPeriodId = 'today' | '7d' | '30d' | 'month' | 'custom'

export interface ReportPeriodRange {
  dateFrom?: string
  dateTo?: string
}

export interface ReportPeriodOption {
  id: ReportPeriodId
  label: string
}

export const REPORT_PERIOD_OPTIONS: ReportPeriodOption[] = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Personalizado' },
]

/**
 * Bloque 7.35: mismo criterio ya usado en `DashboardPage.tsx`
 * (`getTodayInCostaRica`) — el día calendario de HOY debe resolverse en
 * zona horaria de Costa Rica (`America/Costa_Rica`), no en la del
 * sistema/navegador. La versión anterior de este archivo construía "hoy"
 * con `new Date().toISOString().slice(0, 10)`, que convierte a UTC antes
 * de recortar — durante la ventana de las 18:00 a medianoche hora de
 * Costa Rica (UTC-6), el día UTC ya había avanzado al día siguiente, así
 * que los presets "Hoy"/"7 días"/"30 días"/"Este mes" quedaban un día
 * adelantados justo en esa ventana (mismo bug de fondo ya corregido en
 * `SalesReportTable.tsx`, aquí en un cálculo de filtro en vez de en una
 * celda de tabla). Se resuelve la fecha real de Costa Rica una sola vez
 * y toda la aritmética de días corre sobre un ancla UTC pura
 * (`Date.UTC`) que representa ese mismo día calendario — mismo patrón ya
 * usado para fechas puras en `batch.utils.ts`/`PromotionsTable.tsx`
 * (por eso los métodos `UTC*` de abajo, no los locales: el ancla ya
 * "es" el día correcto, reinterpretarla con getters locales del
 * navegador reintroduciría el mismo riesgo de desvío).
 */
function getCostaRicaTodayAnchor(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Resuelve un preset a `{dateFrom, dateTo}` — `'custom'` devuelve `{}`
 * (sin rango propio: quien lo use debe ofrecer sus propios campos de
 * fecha, ya existentes en cada `*Filters.tsx`). */
export function resolveReportPeriod(id: ReportPeriodId): ReportPeriodRange {
  const now = getCostaRicaTodayAnchor()
  const today = toIsoDate(now)

  switch (id) {
    case 'today':
      return { dateFrom: today, dateTo: today }
    case '7d': {
      const from = new Date(now)
      from.setUTCDate(from.getUTCDate() - 6)
      return { dateFrom: toIsoDate(from), dateTo: today }
    }
    case '30d': {
      const from = new Date(now)
      from.setUTCDate(from.getUTCDate() - 29)
      return { dateFrom: toIsoDate(from), dateTo: today }
    }
    case 'month': {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      return { dateFrom: toIsoDate(from), dateTo: today }
    }
    case 'custom':
      return {}
  }
}
