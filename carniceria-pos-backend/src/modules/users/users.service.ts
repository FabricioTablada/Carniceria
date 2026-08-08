/**
 * modules/users/users.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de usuarios.
 *
 * Responsabilidades:
 *  - Validar existencia de usuario antes de leer/actualizar/cambiar su estado.
 *  - Validar que `username` y `email` no esten duplicados al crear o actualizar.
 *  - Hashear la contrasena con bcrypt antes de persistirla.
 *  - Traducir los registros de Prisma a la forma publica `UserResponse`
 *    (sin exponer `passwordHash`).
 *  - Hallazgo de seguridad #4 (auditoria 31/07/2026): impedir que alguien sin
 *    el rol ADMIN cree o ascienda a otro usuario al rol ADMIN.
 *  - Hallazgo de seguridad #3: incrementar `User.tokenVersion` en cada
 *    cambio de rol, contrasena o desactivacion, para que una sesion vieja
 *    deje de poder refrescarse (`auth.service.ts`) tras ese cambio.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `users.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors';
import { SystemRole } from '@/shared/constants';
import type { LookupItem } from '@/shared/utils/lookup';
import { hashPassword } from '@/shared/utils/password';
import { findByIdRoleService } from '@/modules/roles';
import * as usersRepository from './users.repository';
import type {
  ChangeUserStatusDto,
  CreateUserDto,
  ListUsersQuery,
  ListUsersResult,
  LookupUsersQuery,
  UpdateUserDto,
  UserResponse,
} from './users.types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type UserRecord = {
  id: string;
  sucursalId: string;
  username: string;
  email: string | null;
  fullName: string;
  active: boolean;
  role: { id: string; name: string };
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica del usuario (sin passwordHash). */
function toUserResponse(user: UserRecord): UserResponse {
  return {
    id: user.id,
    sucursalId: user.sucursalId,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    active: user.active,
    role: user.role,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Hallazgo de seguridad #4 (auditoria 31/07/2026): solo un usuario ADMIN
 * puede asignar el rol ADMIN (a un usuario nuevo o existente). El permiso
 * `users.manage` no distingue jerarquia de roles — sin este chequeo,
 * cualquier cuenta a la que se le otorgue ese permiso podria crear o
 * ascender administradores sin restriccion.
 */
async function assertRoleAssignable(roleId: string, actorRole: string): Promise<void> {
  const targetRole = await findByIdRoleService(roleId);

  if (targetRole.name === SystemRole.ADMIN && actorRole !== SystemRole.ADMIN) {
    throw new ForbiddenError('Solo un usuario ADMIN puede asignar el rol ADMIN.');
  }
}

export async function create(dto: CreateUserDto, actorRole: string): Promise<UserResponse> {
  const existingByUsername = await usersRepository.findByUsername(dto.username);

  if (existingByUsername) {
    throw new ConflictError('El nombre de usuario ya se encuentra registrado.');
  }

  if (dto.email) {
    const existingByEmail = await usersRepository.findByEmail(dto.email);

    if (existingByEmail) {
      throw new ConflictError('El correo electronico ya se encuentra registrado.');
    }
  }

  await assertRoleAssignable(dto.roleId, actorRole);

  const passwordHash = await hashPassword(dto.password);

  const created = await usersRepository.create({
    sucursalId: dto.sucursalId,
    roleId: dto.roleId,
    username: dto.username,
    email: dto.email ?? null,
    fullName: dto.fullName,
    passwordHash,
    active: dto.active ?? true,
  });

  return toUserResponse(created);
}

export async function findById(id: string): Promise<UserResponse> {
  const user = await usersRepository.findById(id);

  if (!user) {
    throw new NotFoundError('Usuario');
  }

  return toUserResponse(user);
}

export async function findMany(query: ListUsersQuery): Promise<ListUsersResult> {
  const [items, total] = await usersRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map(toUserResponse),
    total,
  };
}

/** Arquitectura de selectores, Bloque 1: patron de lookup — devuelve la
 * forma liviana `LookupItem[]` (label = `fullName`), nunca
 * `UserResponse[]` (evita mapear/serializar `role`, que un selector de
 * cajeros no necesita). */
export async function lookup(query: LookupUsersQuery): Promise<LookupItem[]> {
  const items = await usersRepository.lookup({
    take: query.take,
    filters: query.filters,
  });

  return items.map((item) => ({ id: item.id, label: item.fullName }));
}

export async function update(
  id: string,
  dto: UpdateUserDto,
  currentUserId: string,
  actorRole: string,
): Promise<UserResponse> {
  const existing = await usersRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Usuario');
  }

  const isRoleChange = Boolean(dto.roleId && dto.roleId !== existing.roleId);

  if (isRoleChange && id === currentUserId) {
    throw new ForbiddenError('No puede modificar su propio rol.');
  }

  if (isRoleChange && dto.roleId) {
    await assertRoleAssignable(dto.roleId, actorRole);
  }

  // Version 1.0.5, Bloque A: sin este chequeo, cualquier ADMIN (o un
  // MANAGER con el permiso `users.manage`, que hoy tiene los mismos
  // codigos de escritura que ADMIN sobre usuarios) podia degradar al
  // UNICO ADMIN activo del sistema a otro rol, dejando el ERP sin ningun
  // usuario capaz de volver a asignar ese rol (`assertRoleAssignable`
  // exige ya ser ADMIN para asignar ADMIN) — un bloqueo administrativo
  // total. Solo importa si el usuario que se esta editando es HOY un
  // ADMIN activo (si ya estaba inactivo, o no era ADMIN, no cambia el
  // conteo de ADMIN activos).
  if (isRoleChange && existing.role.name === SystemRole.ADMIN && existing.active) {
    const otherActiveAdmins = await usersRepository.countOtherActiveUsersByRoleName(
      SystemRole.ADMIN,
      id,
    );

    if (otherActiveAdmins === 0) {
      throw new ForbiddenError(
        'No se puede quitar el rol ADMIN al último administrador activo del sistema.',
      );
    }
  }

  if (dto.username && dto.username !== existing.username) {
    const existingByUsername = await usersRepository.findByUsername(dto.username);

    if (existingByUsername) {
      throw new ConflictError('El nombre de usuario ya se encuentra registrado.');
    }
  }

  if (dto.email && dto.email !== existing.email) {
    const existingByEmail = await usersRepository.findByEmail(dto.email);

    if (existingByEmail) {
      throw new ConflictError('El correo electronico ya se encuentra registrado.');
    }
  }

  const passwordHash = dto.password ? await hashPassword(dto.password) : undefined;

  // Hallazgo de seguridad #3: un cambio de rol o de contrasena invalida las
  // sesiones existentes de este usuario en el proximo refresh
  // (`auth.service.ts`), incrementando `tokenVersion`.
  const invalidatesSessions = isRoleChange || Boolean(passwordHash);

  const updated = await usersRepository.update(id, {
    sucursalId: dto.sucursalId,
    roleId: dto.roleId,
    username: dto.username,
    email: dto.email,
    fullName: dto.fullName,
    ...(passwordHash && { passwordHash }),
    ...(invalidatesSessions && { tokenVersion: { increment: 1 } }),
  });

  return toUserResponse(updated);
}

export async function changeStatus(
  id: string,
  dto: ChangeUserStatusDto,
  currentUserId: string,
): Promise<UserResponse> {
  const existing = await usersRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Usuario');
  }

  // QA.10 (Usuarios): mismo criterio de autoproteccion que el bloqueo de
  // auto-cambio de rol en `update()` de mas arriba -- sin este chequeo,
  // cualquier usuario con el permiso `users.manage` podia desactivar su
  // propia cuenta llamando a este endpoint directamente (verificado
  // empiricamente: `PATCH /users/:id/status` con el propio id devolvia
  // `200`), incrementando su propio `tokenVersion` e invalidando su
  // sesion de inmediato. El frontend ya deshabilitaba este botón para la
  // fila del propio usuario (`UsersTable.tsx`), pero esa es solo una
  // proteccion de UI, trivialmente evitable llamando al endpoint
  // directamente -- la regla de negocio real debe vivir aca.
  if (id === currentUserId && !dto.active) {
    throw new ForbiddenError('No puede desactivar su propia cuenta.');
  }

  // Version 1.0.5, Bloque A: misma proteccion que en `update()` — sin
  // esto, un ADMIN podia desactivar al UNICO OTRO ADMIN activo (la
  // autoproteccion de arriba solo cubre que alguien se desactive a si
  // mismo, no protege al sistema de quedar sin ningun ADMIN activo).
  if (existing.active && !dto.active && existing.role.name === SystemRole.ADMIN) {
    const otherActiveAdmins = await usersRepository.countOtherActiveUsersByRoleName(
      SystemRole.ADMIN,
      id,
    );

    if (otherActiveAdmins === 0) {
      throw new ForbiddenError(
        'No se puede desactivar al último administrador activo del sistema.',
      );
    }
  }

  // Hallazgo de seguridad #3: desactivar a un usuario invalida sus sesiones
  // existentes en el proximo refresh (`auth.service.ts`) — sin esto, un
  // usuario recien desactivado seguiria operando con su access token
  // vigente hasta que expire por su cuenta (hasta `JWT_EXPIRES_IN`).
  const isDeactivating = existing.active && !dto.active;

  const updated = await usersRepository.changeStatus(id, {
    active: dto.active,
    ...(isDeactivating && { tokenVersion: { increment: 1 } }),
  });

  return toUserResponse(updated);
}