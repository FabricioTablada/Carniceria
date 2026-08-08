/**
 * modules/permissions/permissions.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de permisos.
 *
 * Responsabilidades:
 *  - Validar existencia del permiso antes de leer/actualizar.
 *  - Validar que el `code` no este duplicado al crear.
 *  - QA.12 (auditoria de QA por modulos, 04/08/2026): impedir que `code` se
 *    modifique una vez creado el permiso (ver `update()`) — es codigo
 *    literal referenciado por decenas de llamadas
 *    `authorizePermission('modulo.accion')` en todo el backend.
 *  - Traducir los registros de Prisma a la forma publica `PermissionResponse`.
 *  - Hallazgo de rendimiento #3 (auditoria 31/07/2026): invalidar el cache
 *    de `roles.service.ts::hasPermission()` cuando cambia un `Permission`
 *    (en particular su `code`, que es lo que ese cache guarda por rol) —
 *    ver `shared/services/permissionCache.service.ts`. Este modulo no
 *    importa nada de `roles/`: el cache vive en `shared/services/`
 *    precisamente para que ninguno de los dos dependa del otro.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `permissions.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { invalidatePermissionCache } from '@/shared/services/permissionCache.service';
import * as permissionsRepository from './permissions.repository';
import type {
  CreatePermissionDto,
  ListPermissionsQuery,
  ListPermissionsResult,
  PermissionResponse,
  UpdatePermissionDto,
} from './permissions.types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type PermissionRecord = {
  id: string;
  code: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica del permiso. */
function toPermissionResponse(permission: PermissionRecord): PermissionResponse {
  return {
    id: permission.id,
    code: permission.code,
    description: permission.description,
    createdAt: permission.createdAt,
    updatedAt: permission.updatedAt,
  };
}

export async function create(dto: CreatePermissionDto): Promise<PermissionResponse> {
  const existingByCode = await permissionsRepository.findByCode(dto.code);

  if (existingByCode) {
    throw new ConflictError('El codigo del permiso ya se encuentra registrado.');
  }

  const created = await permissionsRepository.create({
    code: dto.code,
    description: dto.description ?? null,
  });

  // Hallazgo de rendimiento #3: un permiso nuevo no puede estar en ninguna
  // entrada cacheada todavia, pero se invalida por el mismo criterio simple
  // que el resto de las mutaciones (ver `update` mas abajo).
  invalidatePermissionCache();

  return toPermissionResponse(created);
}

export async function findById(id: string): Promise<PermissionResponse> {
  const permission = await permissionsRepository.findById(id);

  if (!permission) {
    throw new NotFoundError('Permiso');
  }

  return toPermissionResponse(permission);
}

export async function findMany(query: ListPermissionsQuery): Promise<ListPermissionsResult> {
  const [items, total] = await permissionsRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map(toPermissionResponse),
    total,
  };
}

export async function update(id: string, dto: UpdatePermissionDto): Promise<PermissionResponse> {
  const existing = await permissionsRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Permiso');
  }

  // QA.12 (Permisos): el `code` de un permiso, a diferencia de su
  // `description`, es inmutable despues de creado. A diferencia del
  // `name` de un Rol (QA.11, donde solo los roles de sistema estan
  // protegidos), aca no existe ninguna distincion "de sistema" vs
  // "personalizado" (`Permission` no tiene un campo `isSystem`) -- y no
  // hace falta: CADA codigo de permiso existente es, en la practica,
  // codigo literal hardcodeado en decenas de llamadas
  // `authorizePermission('modulo.accion')` a lo largo de TODAS las rutas
  // del backend (unico mecanismo real de autorizacion). Verificado
  // empiricamente (permiso de prueba, sin usar en ningun rol real): el
  // endpoint aceptaba el cambio de `code` sin ninguna validacion. Si se
  // renombra un `code` en uso, CUALQUIER rol que ya tuviera ese permiso
  // asignado (por `id`, la asignacion en si no cambia) deja de poder
  // pasar esa verificacion de autorizacion para TODAS las rutas que la
  // exigen, para TODOS los usuarios con ese rol, de inmediato -- sin
  // ninguna forma de recuperarse salvo saber de memoria el string exacto
  // original y revertirlo a mano. Mismo criterio de proteccion ya
  // aplicado en `roles.service.ts::update()` (QA.11) para el `name` de
  // un rol de sistema, aca aplicado sin excepcion porque no hay forma de
  // distinguir cuales codigos son "seguros" de renombrar.
  if (dto.code && dto.code !== existing.code) {
    throw new ForbiddenError('El codigo de un permiso no se puede modificar despues de creado.');
  }

  const updated = await permissionsRepository.update(id, {
    description: dto.description,
  });

  // Hallazgo de rendimiento #3: el cache (`permissionCache.service.ts`)
  // solo guarda `code`, que ya no puede cambiar aca (QA.12, ver arriba) --
  // esta invalidacion es estrictamente innecesaria para un cambio de
  // `description`, pero se mantiene sin tocar por ser el mismo criterio
  // simple ya usado en TODA mutacion de Role/RolePermission/Permission
  // (invalidar completo, nunca selectivo) — no es un bug, solo una
  // invalidacion de mas, inofensiva.
  invalidatePermissionCache();

  return toPermissionResponse(updated);
}
