/**
 * modules/integrations/alegra/alegra.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo base de integracion con Alegra. Se monta bajo
 * `/integrations/alegra` desde `modules/index.ts`.
 *
 * Reutiliza `settings.manage` (mismo permiso que ya usa
 * `modules/configuration`): administrar una integracion externa es una
 * accion administrativa como cualquier otra configuracion del sistema —
 * no se agrega un permiso nuevo solo para este bloque.
 *
 * Bloque 7.9/7.10: `GET /sales/:saleId/invoice-pdf` y `.../invoice-xml`
 * reutilizan `sales.view` en vez de `settings.manage` — descargar el
 * PDF/XML de una factura es una accion sobre una VENTA, no sobre la
 * configuracion de la integracion (mismo permiso que ya protege el resto
 * de las consultas de `modules/sales`). `transactionalRateLimiter`: mismo
 * criterio ya usado por el equivalente `POST /documents/pdf`
 * (`documents.routes.ts`). Las dos rutas son identicas salvo el path y el
 * controlador — mismo patron arquitectonico exacto (punto 7 del
 * Bloque 7.10).
 */
import { Router } from 'express';
import {
  administrativeRateLimiter,
  authenticate,
  authorizePermission,
  transactionalRateLimiter,
} from '@/middlewares';
import {
  checkInvoiceStatus,
  downloadInvoicePdf,
  downloadInvoiceXml,
  emitInvoice,
  getConfigStatus,
  saveConfig,
  sendInvoiceEmail,
  testConnection,
} from './alegra.controller';

export const alegraRoutes = Router();

alegraRoutes.post(
  '/test-connection',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  testConnection,
);

/** Bloque 7.4. */
alegraRoutes.get(
  '/config',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  getConfigStatus,
);

alegraRoutes.post(
  '/config',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  saveConfig,
);

/** Bloque 7.17: dispara la emision BAJO PEDIDO (ya no automatica al
 * confirmar una venta, ver `sales/service.ts`) — mismo permiso `sales.view`
 * que las descargas de abajo (mismo criterio: accion sobre una venta
 * puntual, no sobre la configuracion de la integracion). */
alegraRoutes.post(
  '/sales/:saleId/emit',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('sales.view'),
  emitInvoice,
);

/** Fix (05/08/2026): expone `checkInvoiceStatus` (Bloque 7.8), antes
 * implementada pero sin ninguna ruta HTTP — mismo permiso/rate limiter que
 * el resto de las acciones sobre una venta puntual de este modulo. */
alegraRoutes.get(
  '/sales/:saleId/status',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('sales.view'),
  checkInvoiceStatus,
);

/** Bloque 7.9. */
alegraRoutes.get(
  '/sales/:saleId/invoice-pdf',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('sales.view'),
  downloadInvoicePdf,
);

/** Bloque 7.10. */
alegraRoutes.get(
  '/sales/:saleId/invoice-xml',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('sales.view'),
  downloadInvoiceXml,
);

/** Bloque 7.20: reenvia por correo la factura YA emitida — mismo permiso
 * `sales.view` que el resto de las acciones sobre una venta puntual de
 * este modulo. */
alegraRoutes.post(
  '/sales/:saleId/email',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('sales.view'),
  sendInvoiceEmail,
);
