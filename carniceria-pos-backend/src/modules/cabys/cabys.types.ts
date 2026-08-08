/**
 * modules/cabys/cabys.types.ts
 * -----------------------------------------------------------------------------
 * Version 1.1, Bloque 2 (asistente inteligente de CABYS): tipos del modulo
 * de solo-lectura sobre el catalogo `CabysCode` (`prisma/schema.prisma`,
 * cargado exclusivamente por `prisma/import-cabys.ts`, Bloque 1). Este
 * modulo NO tiene create/update/delete — la unica via de escritura del
 * catalogo sigue siendo el script de importacion, decision ya cerrada.
 */
import type { LookupParams } from '@/shared/utils/lookup';

/**
 * Forma especifica del lookup de CABYS — deliberadamente mas rica que el
 * `LookupItem` generico (`{id,label}`, `shared/utils/lookup.ts`) porque
 * `ProductCabysField.tsx` (frontend) necesita el codigo y la descripcion
 * como campos separados: el codigo es el unico valor que se persiste en
 * `Product.cabysCode`, la descripcion se muestra aparte, solo como
 * referencia. Mismo criterio ya usado para `ProductLookupItem`.
 */
export interface CabysLookupItem {
  code: string;
  description: string;
  // Mejora UX (indicador visual del impuesto oficial en ProductForm.tsx):
  // valor crudo de `CabysCode.taxIndicator` (ver `cabysTaxCoherence.ts`,
  // modulo products) — solo lectura/informativo aqui, este modulo no
  // interpreta ni valida el valor, solo lo expone tal cual.
  taxIndicator: string | null;
}

export interface LookupCabysFilters {
  search?: string;
}

export interface LookupCabysQuery extends LookupParams {
  filters?: LookupCabysFilters;
}
