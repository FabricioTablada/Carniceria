/**
 * modules/documents/documents.validation.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.8: el cliente envia `{ type, source }` (que documento quiere y
 * el identificador de la entidad de dominio que lo origina).
 *
 * Hallazgo de seguridad #2 (auditoria 31/07/2026): `source` YA NO acepta un
 * objeto arbitrario (`z.unknown()`) — el diseño anterior dejaba que
 * cualquier usuario autenticado enviara una entidad completamente
 * fabricada (montos, numero de documento, sucursal) y el motor la
 * renderizaba como si fuera real, sin volver a consultar la base de datos.
 * Ahora `source` es unicamente `{ id }`: el motor recupera la entidad real
 * por su cuenta (`documents.service.ts`, via `DocumentSourceLoader`) y
 * exige el permiso declarado en la `DocumentDefinition` de ese `type` antes
 * de construir el documento.
 *
 * Bloque 13.10: `DocumentTypeSchema` se exporta ademas para validar el
 * parametro `:type` de `GET /documents/definitions/:type` — mismo schema,
 * sin duplicar el listado de tipos en dos lugares.
 */
import { z } from 'zod';

/** Mismo listado que `DocumentType` (`documents.types.ts`). */
export const DocumentTypeSchema = z.enum([
  'SALE_RECEIPT',
  'PURCHASE_ORDER',
  'CASH_MOVEMENT',
  'INVENTORY_MOVEMENT',
  'RETURN',
  'QUOTE',
  'ORDER',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
]);

export const GenerateDocumentRequestSchema = z.object({
  type: DocumentTypeSchema,
  source: z.object({
    id: z.string().uuid(),
  }),
});
