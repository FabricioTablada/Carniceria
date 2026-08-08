/**
 * tests/integration/rateLimit.pipeline.test.ts
 * -----------------------------------------------------------------------------
 * Fase 19, Bloque 19.5: suite automatizada para la arquitectura de Rate
 * Limiting por endpoint (Bloques 19.1-19.4). Ejerce el pipeline HTTP REAL
 * (`createApp()` montado en un servidor real, sin mocks de Express ni de
 * `express-rate-limit`) — las mismas instancias de middleware que corren en
 * produccion, incluyendo el orden real de registro.
 *
 * Configuracion de prueba aislada: `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`
 * se sobrescriben SOLO en `process.env` de este proceso de test, ANTES de
 * importar `@/app` (que evalua `@/config/env` — y por lo tanto las
 * politicas de Rate Limiting — en el momento del import). Se restauran en
 * `afterAll`. No se toca `.env`, ni la configuracion de desarrollo o
 * produccion, ni los valores de `config/rateLimitPolicies.ts`.
 *
 * Cada test usa una categoria distinta (`auth`/`transactional`/`reports`/
 * `administrative`) para no interferir entre si: el `MemoryStore` de
 * `express-rate-limit` vive en memoria durante toda la vida de la app de
 * pruebas, sin reset entre tests, por lo que agotar la cuota de una
 * categoria en un test no debe "contaminar" otro test que dependa de esa
 * misma categoria estando fresca.
 *
 * No se ejercen rutas que requieran base de datos: todas las peticiones se
 * envian SIN token, por lo que `authenticate` las rechaza con 401 antes de
 * llegar a ningun controlador/Prisma — justo lo que se necesita para
 * probar que el limiter corre ANTES que `authenticate`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { Application } from 'express';

const ORIGINAL_RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX;
const ORIGINAL_RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS;

// Limite pequeño a proposito: la suite hace, como maximo, `TEST_RATE_LIMIT_MAX + 2`
// peticiones por categoria ejercida, para correr en milisegundos.
const TEST_RATE_LIMIT_MAX = 3;
const TEST_RATE_LIMIT_WINDOW_MS = 60_000; // suficientemente largo para no expirar durante la suite

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.RATE_LIMIT_MAX = String(TEST_RATE_LIMIT_MAX);
  process.env.RATE_LIMIT_WINDOW_MS = String(TEST_RATE_LIMIT_WINDOW_MS);

  // Import dinamico DESPUES de fijar el override: `@/config/env` (y, en
  // cascada, `@/config/rateLimitPolicies` y `@/middlewares/rateLimit.middleware`)
  // se evaluan la primera vez que algo los importa.
  const { createApp } = await import('@/app');
  const app: Application = createApp();

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('No se pudo obtener el puerto del servidor de pruebas.');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (ORIGINAL_RATE_LIMIT_MAX === undefined) delete process.env.RATE_LIMIT_MAX;
  else process.env.RATE_LIMIT_MAX = ORIGINAL_RATE_LIMIT_MAX;

  if (ORIGINAL_RATE_LIMIT_WINDOW_MS === undefined) delete process.env.RATE_LIMIT_WINDOW_MS;
  else process.env.RATE_LIMIT_WINDOW_MS = ORIGINAL_RATE_LIMIT_WINDOW_MS;
});

/** Dispara `count` peticiones GET/POST secuenciales (sin token) contra `path`. */
async function fireRequests(
  path: string,
  count: number,
  method: 'GET' | 'POST' = 'GET',
): Promise<Response[]> {
  const responses: Response[] = [];
  for (let i = 0; i < count; i++) {
    // Secuencial (no Promise.all): `express-rate-limit` cuenta por peticion
    // recibida, no hay necesidad de concurrencia real para ejercer el limite.
    const res = await fetch(`${baseUrl}${path}`, { method });
    responses.push(res);
  }
  return responses;
}

describe('Rate Limiting por endpoint (Fase 19) — pipeline HTTP real', () => {
  it('devuelve 429 al exceder la cuota de un endpoint protegido (categoria "reports")', async () => {
    // GET /reports/dashboard: reportsRateLimiter es el PRIMER middleware de
    // la ruta (antes de authenticate) — ver modules/reports/reports.routes.ts.
    const responses = await fireRequests('/api/v1/reports/dashboard', TEST_RATE_LIMIT_MAX + 2);

    const withinLimit = responses.slice(0, TEST_RATE_LIMIT_MAX);
    const overLimit = responses.slice(TEST_RATE_LIMIT_MAX);

    // Dentro de la cuota: el limiter deja pasar la peticion, y `authenticate`
    // la rechaza por falta de token (401) — nunca 429.
    for (const res of withinLimit) {
      expect(res.status).toBe(401);
    }

    // Al exceder la cuota: el limiter responde 429 el mismo, sin llegar a
    // `authenticate` ni al controlador.
    for (const res of overLimit) {
      expect(res.status).toBe(429);
      const body = (await res.json()) as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    }
  });

  it('aisla la cuota entre categorias distintas: agotar "transactional" no afecta "administrative"', async () => {
    // POST /sales: transactionalRateLimiter. Se agota por completo.
    const salesResponses = await fireRequests('/api/v1/sales', TEST_RATE_LIMIT_MAX + 2, 'POST');
    expect(salesResponses.at(-1)?.status).toBe(429);

    // GET /users: administrativeRateLimiter, categoria totalmente distinta
    // y nunca antes ejercida — debe responder 401 (limiter la dejo pasar),
    // NUNCA 429, pese a que "transactional" ya esta agotada.
    const usersResponse = await fetch(`${baseUrl}/api/v1/users`);
    expect(usersResponse.status).toBe(401);
  });

  it('limita trafico NO autenticado (el limiter corre antes que `authenticate`, categoria "auth")', async () => {
    // POST /auth/refresh: no requiere `authenticate` en absoluto (ver
    // auth.routes.ts) — si el 429 aparece de todas formas, es prueba directa
    // de que `authRateLimiter` actua independientemente de la autenticacion.
    const responses = await fireRequests('/api/v1/auth/refresh', TEST_RATE_LIMIT_MAX + 2, 'POST');

    const overLimit = responses.slice(TEST_RATE_LIMIT_MAX);
    for (const res of overLimit) {
      expect(res.status).toBe(429);
    }

    // Cabeceras de Rate Limit (`standardHeaders: true`, ver
    // `middlewares/rateLimit.middleware.ts`): se validan porque la
    // implementacion actual ya las expone.
    const limited = overLimit[0];
    expect(limited.headers.get('ratelimit-limit')).toBe(String(TEST_RATE_LIMIT_MAX));
    expect(limited.headers.get('ratelimit-remaining')).toBe('0');
    expect(limited.headers.get('ratelimit-policy')).toContain(String(TEST_RATE_LIMIT_MAX));
  });

  it('/health nunca consume cupo ni queda bloqueado, incluso con otras categorias ya agotadas', async () => {
    // En este punto del archivo, "reports", "transactional" y "auth" ya
    // estan agotadas (tests anteriores) — exactamente el escenario que
    // /health debe sobrevivir sin verse afectado (Bloque 19.2).
    const responses = await fireRequests('/health', TEST_RATE_LIMIT_MAX + 5);

    for (const res of responses) {
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: { status: string } };
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
    }
  });
});
