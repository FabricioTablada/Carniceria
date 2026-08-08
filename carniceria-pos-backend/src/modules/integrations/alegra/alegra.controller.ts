/**
 * modules/integrations/alegra/alegra.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo base de integracion con Alegra (Bloque 7.3).
 * Solo valida la peticion e invoca `alegra.service.ts` — no interpreta
 * errores de Alegra por su cuenta (eso ya lo resuelve `alegra.client.ts`
 * antes de que el error llegue aca).
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { HttpStatus } from '@/shared/constants';
import {
  SaleIdParamSchema,
  SaveAlegraConfigSchema,
  SendInvoiceEmailSchema,
  TestAlegraConnectionSchema,
} from './alegra.validation';
import * as alegraService from './alegra.service';

/** POST /test-connection */
export const testConnection = asyncHandler(async (req: Request, res: Response) => {
  const body = TestAlegraConnectionSchema.parse(req.body);

  const result = await alegraService.testConnection(body);

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /config — Bloque 7.4. */
export const saveConfig = asyncHandler(async (req: Request, res: Response) => {
  const body = SaveAlegraConfigSchema.parse(req.body);

  const result = await alegraService.saveConfig(body);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /config — Bloque 7.4. Nunca llama a Alegra (ver `alegra.service.ts`). */
export const getConfigStatus = asyncHandler(async (_req: Request, res: Response) => {
  const result = await alegraService.getConfigStatus();

  res.status(HttpStatus.OK).json(success(result));
});

/**
 * POST /sales/:saleId/emit — Bloque 7.17. Dispara `emitInvoice` BAJO PEDIDO
 * del usuario, desde Ventas -> Documentos ("Emitir Factura Electronica") —
 * el flujo operativo del POS ya no emite automaticamente al confirmar una
 * venta (ver `sales/service.ts::create`, de donde se removio el disparo
 * "fire and forget" de Bloque 7.11).
 *
 * Fix (07/08/2026, decision de negocio): el ERP ya no soporta Tiquete
 * Electronico — sin body, sin eleccion de `documentType`, toda emision es
 * Factura Electronica.
 */
export const emitInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { saleId } = SaleIdParamSchema.parse(req.params);

  const result = await alegraService.emitInvoice(saleId);

  res.status(HttpStatus.OK).json(success(result));
});

/**
 * GET /sales/:saleId/status — Fix (05/08/2026). Expone `checkInvoiceStatus`
 * (Bloque 7.8, implementada desde entonces pero sin ninguna ruta HTTP que la
 * usara — deuda tecnica ya documentada en `ROADMAP.md` del frontend) sin
 * ningun cambio de logica: sigue siendo una relectura (`GET /invoices/{id}`
 * de Alegra) que solo actualiza los campos que cambiaron.
 */
export const checkInvoiceStatus = asyncHandler(async (req: Request, res: Response) => {
  const { saleId } = SaleIdParamSchema.parse(req.params);

  const result = await alegraService.checkInvoiceStatus(saleId);

  res.status(HttpStatus.OK).json(success(result));
});

/**
 * POST /sales/:saleId/email — Bloque 7.20. Reenvia por correo la factura
 * YA emitida (`Sale.alegraInvoiceId`) via `POST /invoices/{id}/email` de
 * Alegra — sin emitir nada nuevo, sin volver a timbrar (ver
 * `alegraService.sendInvoiceEmail`). El correo de destino NUNCA se
 * persiste: viaja en el body de esta peticion y se descarta.
 */
export const sendInvoiceEmail = asyncHandler(async (req: Request, res: Response) => {
  const { saleId } = SaleIdParamSchema.parse(req.params);
  const { emails } = SendInvoiceEmailSchema.parse(req.body);

  const result = await alegraService.sendInvoiceEmail(saleId, emails);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /sales/:saleId/invoice-pdf — Bloque 7.9. Unico endpoint de este
 * modulo que NO responde con el sobre `success(...)` de siempre: entrega
 * el PDF directo (mismo patron de headers ya usado en
 * `documents.controller.ts`, `generatePdf`). El frontend nunca ve la
 * URL/credenciales de Alegra — solo pide esto por `saleId`. */
export const downloadInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const { saleId } = SaleIdParamSchema.parse(req.params);

  const { buffer, filename } = await alegraService.getInvoicePdf(saleId);

  res.status(HttpStatus.OK);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

/** GET /sales/:saleId/invoice-xml — Bloque 7.10. Mismo patron exacto que
 * `downloadInvoicePdf` (punto 7 del bloque): mismo esquema de validacion,
 * mismo criterio de respuesta HTTP, solo cambia `Content-Type`. */
export const downloadInvoiceXml = asyncHandler(async (req: Request, res: Response) => {
  const { saleId } = SaleIdParamSchema.parse(req.params);

  const { buffer, filename } = await alegraService.getInvoiceXml(saleId);

  res.status(HttpStatus.OK);
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});
