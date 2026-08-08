/**
 * modules/documents/documents.service.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.8 — orquestador del Motor: UNICO lugar que resuelve un
 * `DocumentType` contra el `DocumentRegistry` para construir un
 * `DocumentData`. Nada fuera de este archivo (`documents.controller.ts`,
 * `documents.pdf.ts`) conoce que existe un `SALE_RECEIPT` o cualquier otro
 * tipo concreto — todos trabajan unicamente con `DocumentData` una vez que
 * este servicio lo construyo.
 *
 * Sin switch/if por tipo de documento: agregar un tipo nuevo es registrar
 * su `DocumentDefinition`/`DocumentBuilder`/`DocumentSourceLoader` desde el
 * modulo dueño (bloque futuro) — este archivo no cambia.
 *
 * Hallazgo de seguridad #2 (auditoria 31/07/2026): antes `source` era la
 * entidad YA CARGADA por quien invocaba (nunca se buscaba aca), lo que
 * permitia a cualquier usuario autenticado fabricar un `source` arbitrario
 * y obtener un documento con datos falsos. Ahora `buildDocument` recibe
 * solo un `sourceId` y un `actorRole`: exige el `requiredPermission` de la
 * `DocumentDefinition` (mismo mecanismo que `authorizePermission`, via
 * `rolesService.hasPermission`) y recupera la entidad real a traves del
 * `DocumentSourceLoader` registrado — el motor sigue sin conocer
 * Sales/Purchases/Cash/Inventory: es cada modulo dueño quien registra COMO
 * se busca su propia entidad.
 */
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors';
import * as rolesService from '@/modules/roles/roles.service';
import { getBuilder, getDefinition, getLoader } from './documents.registry';
import type { DocumentCapabilities, DocumentData, DocumentDefinition, DocumentType } from './documents.types';

/** Resuelve la `DocumentDefinition` de `type` contra el `DocumentRegistry`
 * — lanza `NotFoundError` si nadie la registro todavia. */
export function getDocumentDefinition(type: DocumentType): DocumentDefinition {
  const definition = getDefinition(type);

  if (!definition) {
    throw new NotFoundError(`DocumentDefinition ("${type}")`);
  }

  return definition;
}

/**
 * Construye el `DocumentData` de `type` a partir del `id` de su entidad de
 * origen — resolviendo SIEMPRE el `DocumentBuilder`/`DocumentSourceLoader`
 * correspondientes a traves del `DocumentRegistry`, nunca por un import
 * directo de un builder o loader concreto. Antes de construir nada, valida
 * (via la `DocumentDefinition` registrada) que `capability` sea una accion
 * soportada por ese tipo de documento, y que `actorRole` tenga el permiso
 * que esa `DocumentDefinition` exige (hallazgo de seguridad #2).
 */
export async function buildDocument(
  type: DocumentType,
  sourceId: string,
  capability: keyof DocumentCapabilities,
  actorRole: string,
): Promise<DocumentData> {
  const definition = getDocumentDefinition(type);

  if (!definition.capabilities[capability]) {
    throw new ValidationError(`El documento "${type}" no admite la accion "${capability}".`);
  }

  const hasPermission = await rolesService.hasPermission(actorRole, [definition.requiredPermission]);

  if (!hasPermission) {
    throw new ForbiddenError();
  }

  const loader = getLoader(type);

  if (!loader) {
    throw new NotFoundError(`DocumentSourceLoader ("${type}")`);
  }

  const builder = getBuilder(type);

  if (!builder) {
    throw new NotFoundError(`DocumentBuilder ("${type}")`);
  }

  const source = await loader(sourceId);

  return builder.build(source);
}
