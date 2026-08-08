/**
 * middlewares/rateLimit.middleware.ts
 * -----------------------------------------------------------------------------
 * Limita la cantidad de solicitudes por ventana de tiempo (mitigacion basica
 * de abuso / fuerza bruta). Parametrizado por variables de entorno.
 *
 * Fase 19 (Bloque 19.3): el antiguo Rate Limiter unico y global fue
 * reemplazado por una politica independiente por categoria de trafico
 * (`RATE_LIMIT_POLICIES`, ver `config/rateLimitPolicies.ts`) — cada categoria
 * obtiene su propio contador, sin compartir cupo con las demas. Este archivo
 * solo se encarga de construir la instancia concreta de `express-rate-limit`
 * para cada politica (definicion de politicas).
 *
 * Fase 19 (Bloque 19.4): la asignacion de cual categoria protege cada
 * endpoint ya NO vive en el punto de montaje de modulos — cada
 * `<modulo>/routes.ts` importa el limiter que corresponde a la naturaleza
 * de cada ruta (igual que ya hace con `authenticate`/`authorizePermission`).
 *
 * Investigacion 429 recurrente (03/08/2026): se agrega `salesQuoteRateLimiter`,
 * categoria propia para `POST /sales/quote` — antes compartia
 * `transactionalRateLimiter` con `POST /sales` (la venta real), pese a que la
 * cotizacion se invoca varias veces por cada venta finalizada (cada edicion
 * del carrito). Ver justificacion completa en `config/rateLimitPolicies.ts`.
 *
 * Hallazgo de seguridad #10 (auditoria 31/07/2026): `express-rate-limit`
 * identifica al cliente por `req.ip`. Si este backend llega a desplegarse
 * detras de un proxy inverso/balanceador (no es el caso hoy — despliegue
 * on-premise sin proxy, ver ARCHITECTURE.md), `req.ip` devolveria la IP del
 * proxy para TODOS los clientes salvo que se configure `TRUST_PROXY`
 * (`config/env.ts`, aplicado en `app.ts`) — sin eso, todos los usuarios
 * compartirian el mismo cupo de intentos de login, bloqueandose entre si.
 */
import rateLimit from 'express-rate-limit';
import { env, isDevelopment, RATE_LIMIT_POLICIES, type RateLimitCategory } from '@/config';

const sharedRateLimitOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes. Intente mas tarde.',
    },
  },
} as const;

function createCategoryRateLimiter(category: RateLimitCategory) {
  const policy = RATE_LIMIT_POLICIES[category];
  return rateLimit({
    windowMs: policy.windowMs,
    max: policy.max,
    ...sharedRateLimitOptions,
  });
}

// Trafico general de autenticacion (/refresh, /logout): separado del cupo
// transaccional/reportes/administrativo. `POST /login` ademas atraviesa
// `loginRateLimiter`, mas estricto (ver mas abajo), sin cambios.
export const authRateLimiter = createCategoryRateLimiter('auth');

// Cotizacion de venta (`POST /sales/quote`): simulacion sin persistir,
// llamada en cada edicion del carrito — cupo propio, ventana corta, sin
// competir con las operaciones transaccionales reales de abajo.
export const salesQuoteRateLimiter = createCategoryRateLimiter('salesQuote');

// Operaciones transaccionales del ERP: ventas, compras, inventario, cajas,
// devoluciones, catalogo de productos.
export const transactionalRateLimiter = createCategoryRateLimiter('transactional');

// Consultas de solo lectura de mayor volumen: reportes, notificaciones.
export const reportsRateLimiter = createCategoryRateLimiter('reports');

// Endpoints administrativos de bajo volumen: usuarios, roles, permisos,
// catalogos de configuracion (categorias, impuestos, proveedores,
// promociones), cajas registradoras (alta/edicion), auditoria.
export const administrativeRateLimiter = createCategoryRateLimiter('administrative');

// En desarrollo, el limite de produccion (5 intentos / 15min, pensado como
// mitigacion de fuerza bruta) se agota con el uso normal de QA manual (cada
// cambio de usuario consume un intento). Se eleva solo en dev; en produccion
// queda exactamente igual (env.LOGIN_RATE_LIMIT_MAX).
const LOGIN_RATE_LIMIT_MAX_DEV = 1000;

export const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: isDevelopment ? LOGIN_RATE_LIMIT_MAX_DEV : env.LOGIN_RATE_LIMIT_MAX,
  ...sharedRateLimitOptions,
});
