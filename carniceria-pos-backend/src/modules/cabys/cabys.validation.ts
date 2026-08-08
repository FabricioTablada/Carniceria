/**
 * modules/cabys/cabys.validation.ts
 * -----------------------------------------------------------------------------
 * Validacion de la unica peticion del modulo CABYS: `GET /cabys/lookup`.
 * Mismo criterio que `LookupCategoriesQuerySchema`.
 */
import { z } from 'zod';

export const LookupCabysQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type LookupCabysQueryDto = z.infer<typeof LookupCabysQuerySchema>;

/** `POST /cabys/catalog/apply` — el token de vista previa devuelto por
 * `POST /cabys/catalog/preview`. Nunca se acepta un diff enviado por el
 * cliente: solo se aplica exactamente el diff ya calculado del lado del
 * servidor para ese token. */
export const ApplyCabysCatalogUpdateSchema = z.object({
  previewToken: z.string().min(1, 'previewToken es requerido.'),
});

export type ApplyCabysCatalogUpdateDto = z.infer<typeof ApplyCabysCatalogUpdateSchema>;
