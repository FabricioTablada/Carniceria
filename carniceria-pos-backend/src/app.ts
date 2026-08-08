/**
 * app.ts
 * -----------------------------------------------------------------------------
 * Construye y configura la instancia de Express: middlewares globales de
 * seguridad, parseo, logging, limitacion de tasa, montaje del router de modulos
 * y manejo de errores. NO arranca el servidor (eso es responsabilidad de
 * server.ts), lo que facilita las pruebas de integracion.
 */
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import {
  corsConfig,
  env,
  logger,
  PRODUCT_IMAGES_CACHE_MAX_AGE,
  PRODUCT_IMAGES_STORAGE_DIR,
  PRODUCT_IMAGES_URL_PREFIX,
  resolveTrustProxy,
} from '@/config';
import { errorHandler, notFound, reportsRateLimiter } from '@/middlewares';
import { modulesRouter } from '@/modules';
import { success } from '@/shared/utils';

export function createApp(): Application {
  const app = express();

  // Hallazgo de seguridad #10 (auditoria 31/07/2026): `resolveTrustProxy()`
  // devuelve `false` por defecto (`TRUST_PROXY` sin configurar) — equivale
  // a NO llamar `app.set('trust proxy', ...)`, mismo comportamiento actual
  // (`req.ip`/`express-rate-limit` siguen usando la conexion directa del
  // cliente). Solo cambia si se configura `TRUST_PROXY` explicitamente
  // (`config/env.ts`), pensado para cuando este despliegue on-premise
  // agregue un proxy inverso en el futuro.
  app.set('trust proxy', resolveTrustProxy());

  // Seguridad y utilidades base
  app.use(helmet());
  app.use(cors(corsConfig));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Endpoint de salud (para monitoreo del POS on-premise): registrado antes
  // de montar `modulesRouter`, para que el monitoreo de infraestructura
  // nunca comparta cupo con ninguna politica de Rate Limiting del ERP (Fase
  // 19, Bloque 19.2). Express evalua los middlewares/rutas en el orden en
  // que se registran, asi que una ruta declarada antes nunca atraviesa lo
  // que se registre despues.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json(
      success({
        status: 'ok',
        service: 'carniceria-pos-backend',
        timestamp: new Date().toISOString(),
      }),
    );
  });

  // Imagenes de productos (bloque "Imagenes 1"): servidas por el backend
  // desde un directorio local, bajo un prefijo dedicado y FUERA de
  // `API_PREFIX` (no son parte del contrato JSON versionado, son un
  // recurso estatico — ver `config/productImages.ts` para la infraestructura
  // completa y la ruta de migracion a almacenamiento externo).
  //
  // `reportsRateLimiter`: misma categoria que las lecturas del catalogo de
  // productos (Fase 19) — es contenido publico de solo lectura, de volumen
  // proporcional al de `GET /products`.
  //
  // El `Cross-Origin-Resource-Policy: same-origin` que Helmet aplica por
  // defecto a TODA respuesta bloquearia la carga de estas imagenes desde
  // cualquier frontend que corra en otro origen/puerto (ej. Vite en
  // localhost:5173 contra la API en localhost:3000) — se relaja
  // unicamente para este prefijo, sin afectar el resto de la aplicacion.
  //
  // `maxAge`/`etag`/`lastModified` (bloque "Imagenes 3"): sin `maxAge`,
  // `express.static` envia `Cache-Control: public, max-age=0` — el
  // navegador revalida (peticion condicional) en CADA carga, sin ahorrar
  // ninguna peticion. `PRODUCT_IMAGES_CACHE_MAX_AGE` (ver
  // `config/productImages.ts`) le da al navegador una ventana de frescura
  // real para reutilizar la imagen sin red; `etag`/`lastModified` (activos
  // por defecto, aqui explicitos a proposito) siguen garantizando que un
  // reemplazo de archivo se detecte apenas vence esa ventana.
  app.use(
    PRODUCT_IMAGES_URL_PREFIX,
    reportsRateLimiter,
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(PRODUCT_IMAGES_STORAGE_DIR, {
      maxAge: PRODUCT_IMAGES_CACHE_MAX_AGE,
      etag: true,
      lastModified: true,
    }),
  );

  // Router central de modulos de dominio: cada endpoint declara su propia
  // politica de Rate Limiting por categoria de trafico directamente en su
  // `routes.ts` (Fase 19, Bloque 19.4) en vez de un unico limiter global.
  app.use(env.API_PREFIX, modulesRouter);

  // Ruta no encontrada + manejador global de errores (siempre al final)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
