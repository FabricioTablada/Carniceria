/**
 * shared/utils/date.ts
 * -----------------------------------------------------------------------------
 * Utilidades de fecha/hora. Se centraliza aqui para mantener consistencia
 * (p.ej. marcas de tiempo para respaldos y auditoria).
 */
export function now(): Date {
  return new Date();
}

/** Devuelve una marca de tiempo apta para nombres de archivo: 2025-01-15_14-30-05. */
export function timestampForFilename(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

export function toIso(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Bloque COST-04.2 (correccion de zona horaria del Dashboard): zona
 * horaria del negocio. Costa Rica usa UTC-6 fijo, sin horario de verano
 * (mismo hecho ya documentado en
 * `shared/services/promotionEngine/conditions.ts`, que usa esta misma
 * zona para evaluar dia de la semana/hora de promociones).
 */
const COSTA_RICA_TIME_ZONE = 'America/Costa_Rica';
const COSTA_RICA_UTC_OFFSET_HOURS = 6;

/** Resuelve el año/mes/dia CALENDARIO de `date` en la zona horaria de
 * Costa Rica (via `Intl.DateTimeFormat`, no un offset fijo aplicado a
 * mano) — asi el resultado es correcto sin importar en que zona horaria
 * corra el proceso de Node. */
function resolveCostaRicaDateOnlyParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: COSTA_RICA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '1970');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '1');
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '1');

  return { year, month, day };
}

/**
 * Bloque COST-04.2: rango `[start, end)` del dia CALENDARIO de Costa Rica
 * que contiene `date` (por defecto, ahora) — `start` es la medianoche
 * local de ese dia, `end` es la medianoche local del dia siguiente, ambos
 * expresados como instantes UTC reales (aptos para comparar contra
 * columnas `DateTime` de Prisma/Postgres, que se almacenan en UTC).
 *
 * Reutilizable por cualquier modulo que necesite "el dia de hoy segun el
 * negocio" (hasta ahora, unicamente `reports.service.ts` para la utilidad
 * diaria del Dashboard) — evita que cada consumidor reimplemente su propio
 * calculo de zona horaria.
 */
export function getCostaRicaDayRange(date: Date = new Date()): { start: Date; end: Date } {
  const { year, month, day } = resolveCostaRicaDateOnlyParts(date);
  const start = new Date(Date.UTC(year, month - 1, day, COSTA_RICA_UTC_OFFSET_HOURS, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

/**
 * QA.13 (Reportes): a diferencia de `getCostaRicaDayRange` (que recibe un
 * instante real y resuelve QUE dia calendario de Costa Rica lo contiene),
 * estas dos funciones reciben un `Date` que ya CODIFICA el dia calendario
 * elegido por el usuario como medianoche UTC de ese dia — exactamente lo
 * que produce `z.coerce.date()` sobre el string "YYYY-MM-DD" que envia
 * cualquier `<input type="date">` de un filtro de reporte
 * (`dateFrom`/`dateTo`, `reports.validation.ts`). Mismo mecanismo de
 * codificacion ya documentado en `promotionTime.utils.ts`/
 * `promotionEngine/conditions.ts` para el caso analogo de Promociones.
 *
 * Interpretar esa medianoche UTC como un instante real (lo que hacia
 * `reports.repository.ts::buildDateRange` antes de esta correccion,
 * comparando `gte`/`lte` directamente contra ella) es incorrecto: en
 * Costa Rica (UTC-6), esa medianoche UTC corresponde a las 6pm del dia
 * ANTERIOR — filtrar un reporte por "Hoy" (`dateFrom === dateTo ===` la
 * fecha de hoy) producia un rango de ancho CERO (`gte`/`lte` exactamente
 * iguales), y cualquier filtro de rango excluia sistematicamente las
 * primeras 6 horas del dia real de Costa Rica en su extremo inferior y
 * las ultimas ~18 horas en su extremo superior. Confirmado empiricamente
 * contra datos reales: con `dateFrom=dateTo=hoy`, `/reports/sales/summary`
 * devolvia 0 ventas pese a haber ventas reales ese mismo dia.
 *
 * Estas funciones recuperan el dia calendario "querido" con los getters
 * UTC (nunca con `Intl`/zona horaria, que interpretaria mal esa misma
 * medianoche) y devuelven el instante UTC real de la medianoche de Costa
 * Rica de ESE dia -- mismo calculo que `getCostaRicaDayRange`, aplicado a
 * un `Date` ya codificado en vez de a un instante real.
 */
export function costaRicaDayStartFromDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), COSTA_RICA_UTC_OFFSET_HOURS, 0, 0, 0),
  );
}

/** Limite superior EXCLUSIVO — medianoche de Costa Rica del dia SIGUIENTE
 * al dia calendario que codifica `date`. Usar con `lt`, nunca `lte` (un
 * filtro de fecha "hasta" debe incluir el dia completo, no solo su primer
 * instante). */
export function costaRicaDayEndExclusiveFromDateOnly(date: Date): Date {
  return new Date(costaRicaDayStartFromDateOnly(date).getTime() + 24 * 60 * 60 * 1000);
}
