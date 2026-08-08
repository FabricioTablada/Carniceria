/**
 * modules/documents/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion PUBLICA del Motor de Documentos — mismo
 * criterio que `shared/services/promotionEngine/index.ts`: quien necesite
 * el motor importa unicamente desde aca, nunca de `documents.registry.ts`
 * directamente.
 *
 * Esta es la API que Sales YA USA (Bloque 13.3, `modules/sales/index.ts`) y
 * que Purchases/Cash/Inventory/Returns usaran cuando les toque, para
 * registrar sus propios documentos SIN que este modulo sepa que esos
 * modulos existen: `registerDefinition`/`registerBuilder`/`registerLoader`
 * (para registrarse) + los tipos necesarios para implementar un
 * `DocumentBuilder`/`DocumentSourceLoader` propios.
 *
 * `registerLoader` (hallazgo de seguridad #2, auditoria 31/07/2026): cada
 * modulo dueño debe registrar, junto a su builder, COMO recuperar su propia
 * entidad a partir de un `id` — el motor ya no acepta una entidad completa
 * enviada por el cliente (ver `documents.service.ts`).
 *
 * `getDefinition`/`getBuilder`/`getLoader` (lectura del registro) NO se
 * exponen aca a proposito — son de uso interno del motor
 * (`documents.service.ts`, que resuelve `DocumentType` -> `DocumentData` y
 * ya esta implementado), no algo que un modulo dueño necesite para
 * registrarse.
 *
 * Bloque 13.7: `documentsRoutes` — el modulo gana su primer endpoint real
 * (`POST /documents/pdf`), montado desde `modules/index.ts` exactamente
 * igual que cualquier otro modulo (`salesRoutes`, `purchaseRoutes`, etc.).
 */
export { registerBuilder, registerDefinition, registerLoader } from './documents.registry';
export { documentsRoutes } from './documents.routes';
export type {
  DocumentBuilder,
  DocumentCapabilities,
  DocumentCompany,
  DocumentCustomer,
  DocumentData,
  DocumentDefinition,
  DocumentItem,
  DocumentMetadata,
  DocumentPayment,
  DocumentSourceLoader,
  DocumentTotals,
  DocumentType,
} from './documents.types';
