/**
 * modules/cabys/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo CABYS.
 */
export { cabysRoutes } from './cabys.routes';
export { lookup as lookupCabysService } from './cabys.service';
export { LookupCabysQuerySchema } from './cabys.validation';
export type { LookupCabysQueryDto } from './cabys.validation';
export type { CabysLookupItem, LookupCabysFilters, LookupCabysQuery } from './cabys.types';
