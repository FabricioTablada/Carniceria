/**
 * modules/cabys/cabys.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo CABYS — en este bloque, unicamente el
 * lookup para el asistente de busqueda de `ProductForm.tsx`. Sin
 * create/update/delete: ver `cabys.types.ts`.
 */
import * as cabysRepository from './cabys.repository';
import type { CabysLookupItem, LookupCabysQuery } from './cabys.types';

export async function lookup(query: LookupCabysQuery): Promise<CabysLookupItem[]> {
  const items = await cabysRepository.lookup({
    take: query.take,
    filters: query.filters,
  });

  return items;
}
