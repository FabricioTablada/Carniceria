/**
 * modules/documents/documents.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del Motor de Documentos — montadas bajo `/documents` desde
 * `modules/index.ts` (registro central), mismo patron que cualquier otro
 * modulo.
 *
 * Bloque 13.7: `POST /documents/pdf`. Sin `authorizePermission` puntual —
 * este endpoint no corresponde a ningun recurso de un modulo de dominio
 * (no lee ni escribe nada propio de Ventas/Compras/etc.), solo renderiza
 * el `DocumentData` que ya viene en el body; `authenticate` (sesion
 * valida) es suficiente. `transactionalRateLimiter`: misma categoria que
 * el resto de las operaciones puntuales del ERP (ventas, compras,
 * inventario...).
 *
 * Bloque 13.10: `GET /documents/definitions/:type` — lectura de solo
 * consulta (capacidades de un tipo de documento), `reportsRateLimiter`
 * (misma categoria que el resto de las consultas de solo lectura del
 * ERP), mismo criterio de `authenticate` sin permiso puntual.
 */
import { Router } from 'express';
import { authenticate, reportsRateLimiter, transactionalRateLimiter } from '@/middlewares';
import { generatePdf, getDefinition } from './documents.controller';

export const documentsRoutes = Router();

documentsRoutes.post('/pdf', transactionalRateLimiter, authenticate, generatePdf);
documentsRoutes.get('/definitions/:type', reportsRateLimiter, authenticate, getDefinition);
