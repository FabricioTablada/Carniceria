/**
 * modules/roles/roles.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de roles.
 *
 * Responsabilidades:
 *  - Validar existencia del rol antes de leer/actualizar/cambiar su estado/
 *    asignar permisos.
 *  - Validar que el `name` no este duplicado al crear o actualizar.
 *  - Traducir los registros de Prisma a la forma publica `RoleResponse`
 *    (proyectando `rolePermissions.permission` a `PermissionSummary[]`).
 *  - Resolver, para el RBAC basado en permisos, si un rol (por nombre)
 *    cuenta con alguno de los codigos de permiso requeridos. Lo consume
 *    `middlewares/authorize.middleware.ts` a traves de este servicio; el
 *    middleware no ejecuta queries de Prisma ni conoce la persistencia.
 *  - Hallazgo de seguridad #5 (auditoria 31/07/2026): proteger los roles de
 *    sistema (`isSystem`) contra quedar desactivados, y proteger
 *    puntualmente al rol ADMIN contra perder el permiso `roles.manage` —
 *    ninguno de los dos tenia antes ninguna salvaguarda, pese a que
 *    `isSystem` ya existia y se exponia en las respuestas.
 *  - Hallazgo de rendimiento #3 (auditoria 31/07/2026): `hasPermission()`
 *    ahora consulta primero `shared/services/permissionCache.service.ts`
 *    (cache en memoria con TTL de 60s) antes de ir a la base de datos —
 *    evita una consulta completa (rol + todos sus permisos) en
 *    practicamente cada request autenticado. Toda mutacion de Role/
 *    RolePermission en este archivo invalida el cache completo.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `roles.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { SystemRole } from '@/shared/constants';
import {
  getCachedPermissionCodes,
  invalidatePermissionCache,
  setCachedPermissionCodes,
} from '@/shared/services/permissionCache.service';
import * as rolesRepository from './roles.repository';
import type {
  AssignRolePermissionsDto,
  ChangeRoleStatusDto,
  CreateRoleDto,
  ListRolesQuery,
  ListRolesResult,
  PermissionSummary,
  RoleResponse,
  UpdateRoleDto,
} from './roles.types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  active: boolean;
  rolePermissions: Array<{
    permission: { id: string; code: string; description: string | null };
  }>;
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica del rol. */
function toRoleResponse(role: RoleRecord): RoleResponse {
  const permissions: PermissionSummary[] = role.rolePermissions.map((rolePermission) => ({
    id: rolePermission.permission.id,
    code: rolePermission.permission.code,
    description: rolePermission.permission.description,
  }));

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    active: role.active,
    permissions,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export async function create(dto: CreateRoleDto): Promise<RoleResponse> {
  const existingByName = await rolesRepository.findByName(dto.name);

  if (existingByName) {
    throw new ConflictError('El nombre del rol ya se encuentra registrado.');
  }

  const created = await rolesRepository.create(
    {
      name: dto.name,
      description: dto.description ?? null,
      active: dto.active ?? true,
    },
    dto.permissionIds,
  );

  // Hallazgo de rendimiento #3: invalida el cache de permisos por rol —
  // simple y seguro, aunque este bloque puntual no cambie permisos de un
  // rol existente (`assignPermissions` es quien realmente los asigna),
  // mismo criterio en las 4 mutaciones de este archivo.
  invalidatePermissionCache();

  return toRoleResponse(created);
}

export async function findById(id: string): Promise<RoleResponse> {
  const role = await rolesRepository.findById(id);

  if (!role) {
    throw new NotFoundError('Rol');
  }

  return toRoleResponse(role);
}

export async function findMany(query: ListRolesQuery): Promise<ListRolesResult> {
  const [items, total] = await rolesRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map(toRoleResponse),
    total,
  };
}

export async function update(id: string, dto: UpdateRoleDto): Promise<RoleResponse> {
  const existing = await rolesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Rol');
  }

  if (dto.name && dto.name !== existing.name) {
    // QA.11 (Roles): un rol de sistema (ADMIN/MANAGER/CASHIER) nunca puede
    // renombrarse. Sin este chequeo, renombrar el rol ADMIN bypassa en
    // silencio dos salvaguardas de seguridad ya establecidas que comparan
    // por NOMBRE literal contra `SystemRole.ADMIN`
    // (`users.service.ts::assertRoleAssignable` y
    // `roles.service.ts::assignPermissions`, mas abajo): verificado
    // empiricamente que, tras renombrar "ADMIN" a otra cosa, un usuario
    // MANAGER (sin privilegios de ADMIN) podia asignarle ese rol
    // -- con TODOS los permisos de ADMIN intactos, incluido
    // `roles.manage` -- a cualquier otro usuario, sin ningun error.
    // Ademas, como `hasPermission()` resuelve permisos buscando el rol
    // por NOMBRE (el JWT de una sesion ya iniciada solo lleva el nombre
    // capturado al momento del login, no el id), renombrar CUALQUIER rol
    // con sesiones activas bajo ese nombre las deja sin poder pasar
    // ninguna verificacion de permiso hasta que vuelvan a iniciar sesion
    // -- para los roles de sistema (los mas propensos a tener sesiones
    // activas en todo momento) el impacto es maximo. Mismo criterio de
    // proteccion que `changeStatus()` ya aplica para bloquear la
    // desactivacion de un rol de sistema (Hallazgo de seguridad #5) --
    // aca se extiende a bloquear tambien el renombrado. La descripcion
    // SI sigue siendo editable para roles de sistema: no tiene ninguna
    // de estas implicaciones.
    if (existing.isSystem) {
      throw new ForbiddenError('No se puede renombrar un rol de sistema.');
    }

    const existingByName = await rolesRepository.findByName(dto.name);

    if (existingByName) {
      throw new ConflictError('El nombre del rol ya se encuentra registrado.');
    }
  }

  const updated = await rolesRepository.update(id, {
    name: dto.name,
    description: dto.description,
  });

  // Hallazgo de rendimiento #3: un cambio de `name` invalidaria la entrada
  // cacheada bajo el nombre viejo (quedaria huerfana hasta su TTL) — se
  // invalida todo el cache, no solo esa entrada.
  invalidatePermissionCache();

  return toRoleResponse(updated);
}

export async function changeStatus(id: string, dto: ChangeRoleStatusDto): Promise<RoleResponse> {
  const existing = await rolesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Rol');
  }

  // Hallazgo de seguridad #5: un rol de sistema (ADMIN/MANAGER/CASHIER,
  // sembrados como base del RBAC) nunca puede desactivarse — a diferencia
  // de un rol creado a mano, no hay forma de recrearlo desde la UI si queda
  // inactivo, y para el rol ADMIN especificamente equivaldria a bloquear la
  // administracion completa del sistema.
  if (existing.isSystem && !dto.active) {
    throw new ForbiddenError('No se puede desactivar un rol de sistema.');
  }

  const updated = await rolesRepository.changeStatus(id, dto.active);

  // Hallazgo de rendimiento #3: un rol desactivado no deberia seguir
  // resolviendo permisos desde una entrada cacheada previa a la baja.
  invalidatePermissionCache();

  return toRoleResponse(updated);
}

export async function assignPermissions(
  id: string,
  dto: AssignRolePermissionsDto,
): Promise<RoleResponse> {
  const existing = await rolesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Rol');
  }

  // Hallazgo de seguridad #5: el rol ADMIN nunca puede quedarse sin el
  // permiso `roles.manage` — de lo contrario, ningun usuario podria volver
  // a administrar roles/permisos sin acceso directo a la base de datos.
  if (existing.name === SystemRole.ADMIN) {
    const codes = await rolesRepository.permissionCodesForIds(dto.permissionIds);

    if (!codes.some((permission) => permission.code === 'roles.manage')) {
      throw new ForbiddenError(
        'El rol ADMIN no puede quedarse sin el permiso "roles.manage".',
      );
    }
  }

  const updated = await rolesRepository.assignPermissions(id, dto.permissionIds);

  // Hallazgo de rendimiento #3: esta es la mutacion mas directamente
  // relevante para el cache -- cambia exactamente lo que `hasPermission()`
  // cachea (los codigos de permiso de este rol).
  invalidatePermissionCache();

  return toRoleResponse(updated as RoleRecord);
}

/**
 * Verifica si el rol indicado (por nombre) cuenta con al menos uno de los
 * codigos de permiso requeridos. Pensado para RBAC basado en permisos desde
 * middlewares u otras capas que solo conocen el nombre del rol (p.ej. el
 * `role` embebido en el JWT), no su `id`.
 */
export async function hasPermission(
  roleName: string,
  requiredPermissions: string[],
): Promise<boolean> {
  if (requiredPermissions.length === 0) {
    return true;
  }

  // Hallazgo de rendimiento #3: cache en memoria (TTL 60s) antes de ir a
  // la base de datos -- ver `shared/services/permissionCache.service.ts`.
  // El caso "rol no encontrado" deliberadamente NO se cachea: es una
  // ruta rara (nombre de rol invalido/desactualizado en un JWT viejo), y
  // cachearla arriesgaria esconder un rol recien creado con ese mismo
  // nombre hasta que expire el TTL.
  const cachedPermissionCodes = getCachedPermissionCodes(roleName);

  if (cachedPermissionCodes) {
    return requiredPermissions.some((permission) => cachedPermissionCodes.includes(permission));
  }

  const role = await rolesRepository.findByName(roleName);

  if (!role) {
    return false;
  }

  const permissionCodes = role.rolePermissions.map(
    (rolePermission) => rolePermission.permission.code,
  );

  setCachedPermissionCodes(roleName, permissionCodes);

  return requiredPermissions.some((permission) => permissionCodes.includes(permission));
}
