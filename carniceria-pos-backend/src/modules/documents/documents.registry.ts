/**
 * modules/documents/documents.registry.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.2 — Registro interno del Motor de Documentos. Estado en memoria
 * (dos `Map`, privados a este archivo — nada fuera de aca los toca
 * directamente), poblado en el arranque del servidor cuando cada modulo
 * dueño registra sus propios `DocumentDefinition`/`DocumentBuilder`. Sales
 * ya lo hace (Bloque 13.3, `modules/sales/index.ts`, unico `DocumentType`
 * registrado hoy: `SALE_RECEIPT`); Purchases/Cash/Inventory/Returns
 * seguiran el mismo patron cuando les toque.
 *
 * Principio Open/Closed: agregar un `DocumentType` nuevo es registrar una
 * definicion y un builder mas — este archivo no cambia.
 *
 * Sin logica de negocio: solo guardar/recuperar por `DocumentType`, e
 * impedir que el mismo tipo se registre dos veces (un registro duplicado
 * casi siempre significa un error de import/orden de arranque, mejor
 * fallar temprano y explicito que sobrescribir en silencio).
 */
import type {
  DocumentBuilder,
  DocumentDefinition,
  DocumentSourceLoader,
  DocumentType,
} from './documents.types';

const definitions = new Map<DocumentType, DocumentDefinition>();
const builders = new Map<DocumentType, DocumentBuilder<unknown>>();
const loaders = new Map<DocumentType, DocumentSourceLoader<unknown>>();

export function registerDefinition(definition: DocumentDefinition): void {
  if (definitions.has(definition.type)) {
    throw new Error(`Ya existe una DocumentDefinition registrada para "${definition.type}".`);
  }

  definitions.set(definition.type, definition);
}

/**
 * El registro es heterogeneo a proposito (Sales registrara
 * `DocumentBuilder<Sale>`, Compras `DocumentBuilder<Purchase>`, etc.) — un
 * unico `Map` no puede preservar el tipo especifico de cada uno. Quien
 * llame a `getBuilder()` conoce, por convencion (el mismo `DocumentType`
 * con el que se registro), que entidad le corresponde pasarle.
 */
export function registerBuilder<T>(type: DocumentType, builder: DocumentBuilder<T>): void {
  if (builders.has(type)) {
    throw new Error(`Ya existe un DocumentBuilder registrado para "${type}".`);
  }

  builders.set(type, builder as DocumentBuilder<unknown>);
}

export function getDefinition(type: DocumentType): DocumentDefinition | undefined {
  return definitions.get(type);
}

export function getBuilder(type: DocumentType): DocumentBuilder<unknown> | undefined {
  return builders.get(type);
}

/**
 * Hallazgo de seguridad #2 (auditoria 31/07/2026): registro del
 * `DocumentSourceLoader` de cada tipo, mismo criterio que `registerBuilder`
 * (un unico registro por `DocumentType`, falla explicito ante duplicados).
 */
export function registerLoader<T>(type: DocumentType, loader: DocumentSourceLoader<T>): void {
  if (loaders.has(type)) {
    throw new Error(`Ya existe un DocumentSourceLoader registrado para "${type}".`);
  }

  loaders.set(type, loader as DocumentSourceLoader<unknown>);
}

export function getLoader(type: DocumentType): DocumentSourceLoader<unknown> | undefined {
  return loaders.get(type);
}
