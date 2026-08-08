/**
 * config/rateLimitPolicies.ts
 * -----------------------------------------------------------------------------
 * Punto unico de definicion de politicas de Rate Limiting por categoria de
 * trafico (Fase 19, Bloque 19.3). Sustituye el concepto de un unico Rate
 * Limiter global compartido por todas las rutas.
 *
 * Investigacion 429 recurrente (03/08/2026): la version anterior de este
 * archivo daba a las 4 categorias EXACTAMENTE el mismo `windowMs`/`max`
 * (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`) — cada una tenia su propio
 * contador (arquitectura ya separada desde Fase 19), pero con el mismo
 * numero, pese a que el patron de uso real de cada una es completamente
 * distinto:
 *   - `POST /sales/quote` (cotizacion del carrito) se llama varias veces
 *     por cada venta finalizada, y competia por el mismo cupo que
 *     `POST /sales` bajo `transactional` — con ~60 ventas reales el cupo se
 *     agotaba mucho antes de llegar a las 60, generando 429 persistentes.
 *   - `reports` absorbe el Dashboard (~12 queries por montaje) mas
 *     notificaciones (poll cada 60s) mas listados GET de alto volumen —
 *     trafico de lectura, no comparable a una escritura transaccional.
 *   - `administrative` es CRUD de catalogos/usuarios/roles de uso
 *     esporadico.
 * Cada categoria ahora tiene su propia variable de entorno con un default
 * calibrado a su volumen real (ver `config/env.ts`) — `auth` es la unica que
 * conserva las 2 variables genericas (`RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`),
 * porque no estaba implicada en la investigacion y su volumen real
 * (refresh/logout) es bajo. Sigue sin ser necesario tocar middlewares ni
 * rutas para recalibrar: solo este archivo/`env.ts`.
 */
import { env } from './env';

export type RateLimitCategory = 'auth' | 'salesQuote' | 'transactional' | 'reports' | 'administrative';

export interface RateLimitPolicy {
  windowMs: number;
  max: number;
}

export const RATE_LIMIT_POLICIES: Record<RateLimitCategory, RateLimitPolicy> = {
  auth: { windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX },
  salesQuote: { windowMs: env.RATE_LIMIT_QUOTE_WINDOW_MS, max: env.RATE_LIMIT_QUOTE_MAX },
  transactional: { windowMs: env.RATE_LIMIT_TRANSACTIONAL_WINDOW_MS, max: env.RATE_LIMIT_TRANSACTIONAL_MAX },
  reports: { windowMs: env.RATE_LIMIT_REPORTS_WINDOW_MS, max: env.RATE_LIMIT_REPORTS_MAX },
  administrative: {
    windowMs: env.RATE_LIMIT_ADMINISTRATIVE_WINDOW_MS,
    max: env.RATE_LIMIT_ADMINISTRATIVE_MAX,
  },
};
