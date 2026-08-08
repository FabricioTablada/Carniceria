/**
 * shared/services/promotionEngine/conditions.ts
 * -----------------------------------------------------------------------------
 * EVALUACION DE CONDICIONES (Bloque P.4) — unica responsabilidad: dado un
 * `EngineContext` (momento a evaluar) y el carrito, determinar si una
 * promocion YA ELEGIBLE (ver `eligibility.ts`) realmente aplica en este
 * instante: activa, sucursal correcta, dentro de vigencia por fecha,
 * dentro de la franja horaria, dia de la semana correcto, y cantidad
 * minima alcanzada. No decide MONTO (`calculation.ts`) ni prioridad/
 * exclusividad entre promociones (`promotionEngine.ts`).
 *
 * ZONA HORARIA (ver analisis de arquitectura aprobado, "Riesgos"): la
 * hora/dia de la semana de `EngineContext.now` se interpretan SIEMPRE en
 * America/Costa_Rica, nunca en la zona horaria local del proceso de
 * Node — evita el tipo de bug silencioso que ya se vio en este proyecto
 * (ej. `taxId` omitido en el payload del POS) si el servidor corriera en
 * otra zona horaria.
 */
import { resolveAffectedLines } from './eligibility';
import type { EngineCartLine, EngineContext, EngineDayOfWeek, EnginePromotion } from './promotionEngine.types';

const COSTA_RICA_TIME_ZONE = 'America/Costa_Rica';

const WEEKDAY_TO_DAY_OF_WEEK: Record<string, EngineDayOfWeek> = {
  Monday: 'MONDAY',
  Tuesday: 'TUESDAY',
  Wednesday: 'WEDNESDAY',
  Thursday: 'THURSDAY',
  Friday: 'FRIDAY',
  Saturday: 'SATURDAY',
  Sunday: 'SUNDAY',
};

/** Resuelve dia de la semana + hora/minuto de un `Date` en la zona
 * horaria de Costa Rica, sin depender de la zona horaria del proceso. */
function resolveCostaRicaDateParts(date: Date): {
  dayOfWeek: EngineDayOfWeek;
  minutesSinceMidnight: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: COSTA_RICA_TIME_ZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Monday';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return {
    dayOfWeek: WEEKDAY_TO_DAY_OF_WEEK[weekday] ?? 'MONDAY',
    minutesSinceMidnight: hour * 60 + minute,
  };
}

/** Convierte "HH:mm" a minutos desde medianoche, para comparar contra
 * `resolveCostaRicaDateParts().minutesSinceMidnight`. */
function timeStringToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * QA.9 (Promociones): dia calendario (`YYYY-MM-DD`) de `context.now` en
 * Costa Rica — para comparar contra `startDate`/`endDate`. `Intl` con
 * `timeZone: America/Costa_Rica` ya resuelve el dia calendario correcto
 * sin depender de la zona horaria del proceso, mismo mecanismo que
 * `resolveCostaRicaDateParts` (arriba) usa para `dayOfWeek`.
 */
function resolveCostaRicaDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: COSTA_RICA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

/**
 * QA.9 (Promociones): dia calendario (`YYYY-MM-DD`) que representa
 * `startDate`/`endDate` — SIEMPRE se construyen a partir de un
 * `<input type="date">` ("YYYY-MM-DD") parseado con `z.coerce.date()`
 * (`promotions.validation.ts`), que produce medianoche UTC de ese mismo
 * dia (`promotionTime.utils.ts` documenta el mismo criterio para
 * `startTime`/`endTime`) — por eso el dia calendario "querido" por quien
 * configuro la promocion se recupera con los getters UTC, NO con
 * `resolveCostaRicaDateString` (que interpretaria medianoche UTC como las
 * 18:00 del dia ANTERIOR en Costa Rica, corriendo la fecha un dia hacia
 * atras).
 */
function resolveStoredDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Determina si una promocion YA ELEGIBLE (ver `eligibility.ts`) cumple
 * TODAS sus condiciones en el momento/contexto dado. Cada condicion
 * ausente (null/vacia) se considera "sin restriccion" en esa dimension —
 * mismo criterio ya documentado en el catalogo (`Promotion`, Bloque P.3):
 * nulo = sin limite.
 */
export function meetsConditions(
  promotion: EnginePromotion,
  cart: EngineCartLine[],
  context: EngineContext,
): boolean {
  if (!promotion.active) {
    return false;
  }

  if (promotion.sucursalId && promotion.sucursalId !== context.sucursalId) {
    return false;
  }

  // QA.9: comparacion por DIA CALENDARIO en Costa Rica, no por instante
  // UTC crudo — `startDate`/`endDate` se guardan como medianoche UTC del
  // dia elegido (ver doc de `resolveStoredDateString`). Comparar
  // `context.now` (instante UTC real) directamente contra esa medianoche
  // UTC hacia "vencia a medianoche UTC", que en Costa Rica (UTC-6) son
  // las 18:00 del dia ANTERIOR al que el usuario eligio como fecha de
  // fin — una promocion configurada "vigente hasta el 10" dejaba de
  // aplicar desde las 6pm del dia 9, hora de Costa Rica. Mismo criterio
  // de zona horaria ya aplicado a `dayOfWeek`/`startTime`/`endTime` mas
  // abajo, ahora tambien a la fecha.
  const nowDateString = resolveCostaRicaDateString(context.now);

  if (promotion.startDate && nowDateString < resolveStoredDateString(promotion.startDate)) {
    return false;
  }

  if (promotion.endDate && nowDateString > resolveStoredDateString(promotion.endDate)) {
    return false;
  }

  const { dayOfWeek, minutesSinceMidnight } = resolveCostaRicaDateParts(context.now);

  if (promotion.daysOfWeek.length > 0 && !promotion.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  if (promotion.startTime && minutesSinceMidnight < timeStringToMinutes(promotion.startTime)) {
    return false;
  }

  if (promotion.endTime && minutesSinceMidnight > timeStringToMinutes(promotion.endTime)) {
    return false;
  }

  if (promotion.minQuantity != null) {
    const relevantQuantity = sumRelevantQuantity(promotion, cart);

    if (relevantQuantity < promotion.minQuantity) {
      return false;
    }
  }

  return true;
}

/** Suma la cantidad de las lineas del carrito relevantes para esta
 * promocion (mismas lineas que `resolveAffectedLines` — reutilizado, no
 * reimplementado) — la base sobre la que se mide `minQuantity`. */
function sumRelevantQuantity(promotion: EnginePromotion, cart: EngineCartLine[]): number {
  const lines = resolveAffectedLines(promotion, cart);
  const relevant = lines === 'CART' ? cart : lines;

  return relevant.reduce((sum, line) => sum + line.quantity, 0);
}
