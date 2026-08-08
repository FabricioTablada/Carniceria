/**
 * modules/documents/documents.controller.ts
 * -----------------------------------------------------------------------------
 * Capa HTTP del Motor de Documentos.
 *
 * Bloque 13.8: el cliente envia `{ type, source }`, no un `DocumentData` ya
 * construido — `documents.service.ts` (`buildDocument`) resuelve el
 * `DocumentBuilder`/`DocumentDefinition` correspondientes a `type` a
 * traves del `DocumentRegistry`. Este controlador no conoce ningun
 * `DocumentType` especifico, no importa nada de Sales/Purchases/etc., y a
 * partir de que `buildDocument` devuelve el `DocumentData`, todo lo
 * siguiente (el PDF) trabaja unicamente con esa forma generica.
 *
 * Hallazgo de seguridad #2 (auditoria 31/07/2026): `source` ahora es solo
 * `{ id }` (`documents.validation.ts`) — este controlador le pasa ese `id`
 * y el `role` del usuario autenticado a `buildDocument`, que es quien
 * recupera la entidad real y valida el permiso (ver `documents.service.ts`).
 * `req.user` siempre existe aca porque la ruta pasa por `authenticate`
 * antes de llegar a este controlador (`documents.routes.ts`).
 *
 * Bloque 13.10: `getDefinition` — endpoint de solo lectura, expone la
 * `DocumentDefinition` ya registrada para un `type` (`capabilities`
 * incluidas). Pensado para que el frontend decida que botones habilitar
 * (`SaleDetailContent.tsx`) sin duplicar esa informacion a mano.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import { DocumentTypeSchema, GenerateDocumentRequestSchema } from './documents.validation';
import { buildDocument, getDocumentDefinition } from './documents.service';
import { renderDocumentPdf } from './documents.pdf';

/** POST /documents/pdf */
export const generatePdf = asyncHandler(async (req: Request, res: Response) => {
  // Mismo guard defensivo ya usado en sales/controller.ts, cash/controller.ts
  // e inventory/controller.ts: `authenticate` garantiza `req.user` en esta
  // ruta, el chequeo es defensivo.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const { type, source } = GenerateDocumentRequestSchema.parse(req.body);

  const documentData = await buildDocument(type, source.id, 'pdf', req.user.role);
  const pdf = await renderDocumentPdf(documentData);

  res.status(HttpStatus.OK);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${documentData.document.type.toLowerCase()}-${documentData.document.number ?? 'documento'}.pdf"`,
  );
  res.send(pdf);
});

/** GET /documents/definitions/:type */
export const getDefinition = asyncHandler(async (req: Request, res: Response) => {
  const type = DocumentTypeSchema.parse(req.params.type);

  const definition = getDocumentDefinition(type);

  res.status(HttpStatus.OK).json(success(definition));
});
