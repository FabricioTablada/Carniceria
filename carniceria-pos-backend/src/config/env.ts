/**
 * config/env.ts
 * -----------------------------------------------------------------------------
 * Carga las variables de entorno (dotenv) y las VALIDA con Zod antes de que la
 * aplicacion arranque. Si falta o es invalida alguna variable critica, el
 * proceso se detiene de inmediato con un mensaje claro (fail-fast).
 *
 * Ningun otro archivo del proyecto debe leer `process.env` directamente:
 * siempre debe importar `env` desde aqui para obtener valores ya validados y
 * tipados.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const envSchema = z.object({
  // Aplicacion
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  SUCURSAL_ID: z.string().uuid(),

  // Base de datos
  DATABASE_URL: z.string().url(),

  // JWT
  // Hallazgo de seguridad #8 (auditoria 31/07/2026): el minimo subio de 16 a
  // 32 caracteres — 16 es insuficiente para HMAC-SHA256 si el operador usa
  // una frase memorable en vez de un valor aleatorio real (~128 bits en el
  // mejor caso). El mensaje de error indica ademas COMO generar un valor
  // que cumpla, en vez de solo exigir la longitud.
  JWT_SECRET: z
    .string()
    .min(
      32,
      'JWT_SECRET debe tener al menos 32 caracteres aleatorios. Genera uno con: openssl rand -base64 48',
    )
    .refine(
      (s) => s !== 'cambia_este_secreto_por_uno_largo_y_aleatorio',
      'JWT_SECRET no puede usar el valor placeholder del proyecto. Genera un valor aleatorio propio.',
    ),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(
      32,
      'JWT_REFRESH_SECRET debe tener al menos 32 caracteres aleatorios. Genera uno con: openssl rand -base64 48',
    )
    .refine(
      (s) => s !== 'cambia_este_secreto_de_refresh_por_otro_distinto',
      'JWT_REFRESH_SECRET no puede usar el valor placeholder del proyecto. Genera un valor aleatorio propio.',
    ),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // bcrypt
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // CORS
  // NOTA (hallazgo de seguridad #1, auditoria 31/07/2026): "*" solo es valido
  // en development/test. Combinado con `credentials: true` (obligatorio para
  // la cookie httpOnly del refresh token, ver `config/cors.ts`), un origen
  // reflejado sin restriccion en produccion permite que cualquier sitio lea
  // la respuesta de `POST /auth/refresh` con las credenciales del navegador
  // de la victima. La restriccion real (rechazar "*" en produccion) se aplica
  // mas abajo via `.superRefine`, cruzando este campo con `NODE_ENV`.
  CORS_ORIGIN: z.string(),

  // Rate limiting
  // Investigacion 429 recurrente (03/08/2026): un unico limite compartido
  // por las 4 categorias (`auth`/`transactional`/`reports`/`administrative`,
  // ver `config/rateLimitPolicies.ts`) no reflejaba que cada una tiene un
  // patron de uso real completamente distinto — en particular, `POST
  // /sales/quote` (cotizacion del carrito, se llama en cada edicion, no solo
  // al confirmar la venta) competia por el mismo cupo que `POST /sales`
  // (la venta real) bajo `transactional`, agotandolo mucho antes de llegar a
  // las ~60 ventas reales que un cajero completa en su turno. Cada categoria
  // ahora tiene su propia variable de entorno (con default ya calibrado a su
  // volumen real), en vez de reutilizar `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`
  // para las 4 — `auth` conserva esas 2 variables genericas (trafico bajo,
  // no implicado en la investigacion).
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  // Cotizacion de venta (`POST /sales/quote`, simulacion sin persistir):
  // ventana corta, cupo alto — se dispara en cada edicion del carrito (cada
  // producto agregado, cada cambio de cantidad/descuento), varias veces por
  // venta finalizada.
  RATE_LIMIT_QUOTE_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_QUOTE_MAX: z.coerce.number().int().positive().default(120),

  // Operaciones transaccionales reales (venta/anulacion/correccion, compras,
  // movimientos/apertura/cierre de caja, devoluciones, ajustes de
  // inventario): ya no comparte cupo con la cotizacion — el volumen real es
  // una escritura por operacion de negocio, no por cada edicion.
  //
  // Version 1.0.3, Bloque 7 (429 real al anular varias ventas seguidas):
  // el calculo original (arriba) solo contaba la escritura de negocio en
  // si, pero esta categoria tambien absorbe, por diseño, las 5 rutas de
  // Facturacion Electronica (Alegra: emitir, ver estado, PDF/XML, reenviar
  // — `alegra.routes.ts`), consultadas desde la misma pantalla de detalle
  // de venta que un administrador revisa ANTES de decidir anular. Una
  // sesion real de limpieza (revisar el estado de Alegra + anular, venta
  // por venta, de un lote de ventas erroneas) puede consumir 2-3 unidades
  // de este cupo por venta revisada, no 1 — con el limite anterior (150),
  // una racha de ~50-75 ventas revisadas+anuladas en la misma ventana de
  // 5 minutos ya lo agotaba, pese a ser trabajo administrativo legitimo,
  // no abuso. Recalibrado a 450 (x3): cubre holgadamente una racha
  // administrativa intensa (~150 ventas revisadas+anuladas en 5 minutos,
  // muy por encima de cualquier turno real — un cajero completa ~60
  // ventas en un turno COMPLETO, no en 5 minutos) sin dejar de acotar el
  // trafico — sigue siendo un tope fijo por IP y por ventana, no una
  // desactivacion del limitador ni un cambio de que cuenta como "cliente".
  RATE_LIMIT_TRANSACTIONAL_WINDOW_MS: z.coerce.number().int().positive().default(300000),
  RATE_LIMIT_TRANSACTIONAL_MAX: z.coerce.number().int().positive().default(450),

  // Lecturas de mayor volumen (reportes, notificaciones, listados GET de
  // ventas/compras/inventario/productos/lotes): el Dashboard dispara ~12
  // queries por montaje y, por diseño ya aprobado del sistema de
  // invalidacion (`reportQueryKeys.ts`), cada venta marca esas ~12 queries
  // como obsoletas — al volver al Dashboard tras cada venta se refetchean
  // en un solo lote. Cupo dimensionado para absorber eso repetidas veces por
  // ventana sin degradar el resto del sistema.
  RATE_LIMIT_REPORTS_WINDOW_MS: z.coerce.number().int().positive().default(300000),
  RATE_LIMIT_REPORTS_MAX: z.coerce.number().int().positive().default(900),

  // Endpoints administrativos de bajo volumen (usuarios, roles, permisos,
  // catalogos de configuracion, auditoria): patron de uso real es CRUD
  // esporadico, nunca comparable en frecuencia a ventas/reportes.
  RATE_LIMIT_ADMINISTRATIVE_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_ADMINISTRATIVE_MAX: z.coerce.number().int().positive().default(200),

  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Respaldos
  BACKUP_CRON: z.string().default('0 2 * * *'),
  BACKUP_DIR: z.string().default('./backups'),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  BACKUP_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),
  // Parche 1.0.1 (Backup & Restore real): carpeta `bin/` con `pg_dump`/
  // `pg_restore` reales — inyectada por `carniceria-pos-desktop`
  // (`buildBackendEnv()`, mismo valor que `PostgresManager.binDir` ya usa
  // para `pg_ctl`/`postgres`/`initdb`, ahora con esos dos binarios
  // tambien copiados ahi por `prepare-package-resources.js`). Opcional:
  // sin Electron (desarrollo local, o un despliegue futuro fuera de
  // escritorio) se asume que `pg_dump`/`pg_restore` ya estan en el PATH
  // del sistema, igual que cualquier instalacion normal de PostgreSQL.
  POSTGRES_BIN_DIR: z.string().optional(),

  // Sincronizacion (Bloque 4) — sin CRON propio: es un worker permanente
  // que se despierta solo (ver `modules/sync/sync.worker.ts`), no una
  // tarea de horario fijo como los respaldos. Solo necesita un interruptor.
  SYNC_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value.toLowerCase() === 'true'),

  // Integraciones (Bloque 7.4): clave simetrica del SERVIDOR usada para
  // cifrar en reposo credenciales de terceros que el ERP debe reenviar tal
  // cual (no un hash de verificacion como `passwordHash`/`RefreshToken` —
  // el token de Alegra tiene que poder recuperarse en texto plano para
  // autenticar cada llamada saliente, ver `modules/integrations/alegra`).
  // 64 caracteres hex = 32 bytes, la longitud exacta que exige AES-256-GCM
  // (`alegra.crypto.ts`). Sin default: perder/rotar esta clave sin migrar
  // los datos cifrados existentes los vuelve irrecuperables.
  INTEGRATIONS_ENCRYPTION_KEY: z
    .string()
    .length(
      64,
      'INTEGRATIONS_ENCRYPTION_KEY debe ser una clave hex de 32 bytes (64 caracteres). Genera una con: openssl rand -hex 32',
    )
    .regex(/^[0-9a-fA-F]+$/, 'INTEGRATIONS_ENCRYPTION_KEY debe ser hexadecimal.'),

  // Seed
  SEED_ADMIN_PASSWORD: z
    .string()
    .min(8, 'SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres'),

  // Imagenes de productos (bloque "Imagenes 1"): directorio local donde el
  // backend sirve las imagenes hoy, y host publico usado para construir la
  // URL absoluta que termina en `Product.imageUrl`. Ambos con default para
  // no requerir cambios en `.env` existentes; se migran a un
  // almacenamiento de objetos (S3/R2) cambiando solo estos valores.
  PRODUCT_IMAGES_STORAGE_DIR: z.string().default('./storage/product-images'),
  PRODUCT_IMAGES_BASE_URL: z.string().url().default('http://localhost:3000'),

  // Imagenes de productos (Bloque 10 — gestion completa): tamaño maximo
  // aceptado por archivo subido via `POST/PUT /products/:id/image`. Con
  // default para no requerir cambios en `.env` existentes.
  PRODUCT_IMAGE_MAX_SIZE_MB: z.coerce.number().int().positive().default(5),

  // Hallazgo de seguridad #10 (auditoria 31/07/2026): `app.set('trust proxy', ...)`
  // NO se configura hoy porque el despliegue on-premise actual no usa proxy
  // inverso (`req.ip`/`express-rate-limit` ya usan la IP real del cliente).
  // Default "false" preserva ese comportamiento exacto (equivalente a no
  // llamar `app.set('trust proxy', ...)`, ver `app.ts`). Si en el futuro se
  // agrega un proxy/balanceador (ej. para el acceso remoto ya previsto en
  // ARCHITECTURE.md), configurar aca el numero de saltos confiables (ej.
  // "1") o la lista de IPs/CIDR de esos proxies (ej. "127.0.0.1,10.0.0.5")
  // — nunca "true" sin restriccion: con un proxy real por delante, eso
  // permitiria falsificar `X-Forwarded-For` y burlar el Rate Limiting.
  TRUST_PROXY: z
    .string()
    .default('false')
    .refine(
      (value) => value !== 'true',
      'TRUST_PROXY no admite "true" sin restriccion. Usa un numero de saltos ' +
        '(ej. "1") o la lista de IPs/CIDR de los proxies confiables ' +
        '(ej. "127.0.0.1,10.0.0.5").',
    ),
}).superRefine((data, ctx) => {
  const origins = data.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  if (data.NODE_ENV === 'production' && origins.includes('*')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGIN'],
      message:
        'CORS_ORIGIN no puede ser "*" en produccion (NODE_ENV=production): ' +
        'combinado con credentials:true, permite que cualquier sitio robe ' +
        'la sesion via /auth/refresh. Especifica el/los origenes reales del frontend.',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '\u274C Variables de entorno invalidas. Revisa tu archivo .env:\n',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export type Env = typeof env;

/**
 * Resuelve `TRUST_PROXY` al valor que espera `app.set('trust proxy', ...)`
 * (hallazgo de seguridad #10): `false` (default) deja el comportamiento
 * actual sin cambios; un numero de saltos se pasa como `number`; cualquier
 * otro valor (lista de IPs/CIDR) se pasa como `string` tal cual — `cors`/
 * Express lo interpretan igual. Nunca devuelve `true` (bloqueado por el
 * `.refine` del schema, arriba).
 */
export function resolveTrustProxy(): boolean | number | string {
  if (env.TRUST_PROXY === 'false') {
    return false;
  }

  return /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY;
}

/** Configuracion de la cookie httpOnly del refresh token (A-01). No
 * requiere variables de entorno nuevas: el nombre/politica quedan fijos
 * por diseño, no configurables por entorno.
 *
 * Fix QA.APP.1 (auditoria Electron, causa raiz confirmada): `secure`/
 * `sameSite` YA NO dependen de `isProduction`. Motivo — el frontend
 * empaquetado en Electron (`carniceria-pos-desktop`) carga el renderer
 * bajo el esquema propio `app://bundle`, mientras que este backend corre
 * en `http://127.0.0.1:<puerto>`: son sitios distintos para el navegador
 * (distinto scheme), asi que cualquier peticion XHR/fetch entre ambos es
 * cross-site. `SameSite=Lax` NUNCA adjunta la cookie en una peticion
 * cross-site que no sea una navegacion de nivel superior — `POST
 * /auth/refresh` no lo es, asi que el refresh fallaba SIEMPRE dentro de
 * Electron (nunca por el TTL del access token en si), forzando un logout
 * cada vez que el usuario volvia a interactuar tras superar ese TTL, y en
 * cada reinicio de la app (refresh silencioso de `App.tsx`). En
 * localhost la cookie funcionaba porque frontend y backend son el mismo
 * "site" (mismo scheme+dominio, solo cambia el puerto) — por eso el bug
 * era invisible ahi.
 *
 * `sameSite: 'none'` es obligatorio para que la cookie viaje en ese
 * escenario cross-site. Chromium exige `Secure` para honrar
 * `SameSite=None` — por eso `secure` pasa a ser `true` sin condicion.
 * Esto NO rompe loopback sin TLS real (ni en Electron ni en `localhost`
 * de desarrollo): Chromium trata `localhost`/`127.0.0.1`/`[::1]` como
 * origen "potencialmente confiable" incluso sobre HTTP plano — excepcion
 * intencional del navegador para desarrollo/loopback — y esa excepcion
 * alcanza al atributo `Secure` de las cookies, no solo a las APIs que
 * exigen contexto seguro. Validado en vivo contra el `.exe` empaquetado
 * real (no solo codigo) antes de cerrar este bloque. */
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

/** Duracion real del refresh token en milisegundos (7 dias, igual que
 * `JWT_REFRESH_EXPIRES_IN`). Unica fuente de verdad para cualquier lugar
 * que necesite esa duracion como valor concreto (no como cadena relativa
 * de `jsonwebtoken`): el `maxAge` de la cookie httpOnly de aqui abajo, y
 * el calculo de `expiresAt` al persistir el refresh token en base de
 * datos (`auth.service.ts`). Antes existian dos constantes identicas
 * definidas por separado (Estabilidad de sesion, Bloque 3) — la cookie
 * no tenia `maxAge`/`expires`, por lo que el navegador la trataba como
 * cookie de sesion y la borraba al cerrarse, aunque el refresh token
 * siguiera siendo valido en base de datos por 7 dias mas. */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: REFRESH_TOKEN_TTL_MS,
};
