/**
 * modules/integrations/alegra/index.ts
 * -----------------------------------------------------------------------------
 * Barrel del modulo. Expone las rutas (montadas por `modules/index.ts`,
 * incluida la descarga de PDF/XML de los Bloques 7.9/7.10 vistas por el
 * frontend), `createAlegraClient` — el unico punto de salida HTTP hacia
 * Alegra —, `resolveGenericClient` (Bloque 7.5), `resolveProductAlegraId`
 * (Bloque 7.6), `emitInvoice` (Bloque 7.7) y `checkInvoiceStatus`
 * (Bloque 7.8), para que quien dispare estas operaciones (Bloque 7.11+:
 * probablemente `modules/sales`) las reutilice sin duplicar logica ni
 * instanciar su propio cliente axios. `getInvoicePdf`/`getInvoiceXml`
 * (Bloques 7.9/7.10) NO se exportan aca: solo se consumen via HTTP
 * (`alegraRoutes`), no hay ningun otro modulo que necesite esos archivos
 * en crudo.
 */
export { alegraRoutes } from './alegra.routes';
export { ALEGRA_DEFAULT_BASE_URL, ALEGRA_GENERIC_CLIENT_NAME, createAlegraClient } from './alegra.client';
export {
  checkInvoiceStatus,
  emitInvoice,
  resolveGenericClient,
  resolveProductAlegraId,
} from './alegra.service';
export type {
  AlegraConfigStatus,
  AlegraConnectionTestResult,
  AlegraCredentials,
  AlegraGenericClientResult,
  AlegraInvoiceResult,
  AlegraInvoiceStatusResult,
  AlegraProductLinkResult,
  SaveAlegraConfigInput,
} from './alegra.types';
