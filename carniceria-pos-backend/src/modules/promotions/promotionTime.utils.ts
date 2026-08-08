/**
 * modules/promotions/promotionTime.utils.ts
 * -----------------------------------------------------------------------------
 * Conversion entre "HH:mm" (formato que expone el modulo hacia afuera,
 * `Promotion.startTime`/`endTime`) y el `Date` que exige Prisma para una
 * columna `@db.Time`. Extraido de `promotions.service.ts` en el Bloque P.5
 * porque `promotionApplication.service.ts` (el adaptador hacia el motor de
 * reglas) necesita EXACTAMENTE la misma conversion al traducir el catalogo
 * cargado de la base de datos hacia `EnginePromotion` — sin esto, la
 * logica de parseo quedaria duplicada en dos archivos.
 */

/** Convierte "HH:mm" a un `Date` en UTC con esa hora/minuto — Prisma solo
 * necesita algun `Date` para escribir una columna `@db.Time` (Postgres
 * descarta la parte de fecha); se usa UTC (no la hora local del servidor)
 * para que el valor guardado no dependa de en que zona horaria corre el
 * proceso de Node. */
export function parseTimeString(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);

  return new Date(Date.UTC(1970, 0, 1, hours, minutes));
}

/** Convierte el `Date` que devuelve Prisma para una columna `@db.Time` de
 * vuelta a "HH:mm" — misma zona horaria (UTC) usada en `parseTimeString`. */
export function formatTimeString(value: Date): string {
  const hours = String(value.getUTCHours()).padStart(2, '0');
  const minutes = String(value.getUTCMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}
