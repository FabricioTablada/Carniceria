/**
 * modules/auth/auth.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del inicio de sesion.
 *
 * Responsabilidades:
 *  - Verificar credenciales (usuario + contrasena) contra la base de datos.
 *  - Emitir el par de tokens JWT (acceso y refresco).
 *  - Persistir, rotar y revocar refresh tokens (A-02) — nunca en texto
 *    plano, solo su hash (`refreshToken.repository.ts`).
 *  - Actualizar `lastLoginAt` y dejar constancia del evento en `AuditLog`.
 *
 * Toda consulta relacionada al usuario se hace a traves de
 * `auth.repository.ts`; toda consulta relacionada a refresh tokens se hace
 * a traves de `refreshToken.repository.ts`. El registro en `AuditLog` pasa
 * siempre por `auditService` (`shared/services/audit.service.ts`), que
 * persiste en base de datos — nunca se escribe con Prisma directamente
 * desde aca.
 *
 * Hallazgo de seguridad #6 (auditoria 31/07/2026): `login()` tambien
 * registra `AuditAction.LOGIN_FAILED` en sus tres caminos de rechazo
 * (usuario inexistente, contrasena invalida, cuenta inactiva) — antes
 * ningun intento fallido dejaba rastro en `AuditLog`, limitando la
 * deteccion de fuerza bruta dirigida a una cuenta especifica.
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { UnauthorizedError } from '@/shared/errors';
import { AuditAction } from '@/shared/constants';
import { auditService } from '@/shared/services/audit.service';
import { env, REFRESH_TOKEN_TTL_MS } from '@/config/env';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
} from '@/shared/utils/jwt';
import * as authRepository from './auth.repository';
import * as refreshTokenRepository from './refreshToken.repository';
import type { LoginDto } from './auth.validation';

export interface LoginResult {
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
    permissions: string[];
  };
  accessToken: string;
  refreshToken: string;
}

/** El JWT nunca se persiste — solo su hash (SHA-256 alcanza: el token ya
 * es un valor aleatorio de alta entropia, no una contrasena que requiera
 * salting/costo alto como bcrypt). */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}


export async function login(dto: LoginDto, ip?: string): Promise<LoginResult> {
  const user = await authRepository.findByUsername(dto.username);

  if (!user) {
    // Sin sucursalId de un usuario real que atribuir (no existe la
    // cuenta) — se usa `env.SUCURSAL_ID` (esta instalacion on-premise es
    // siempre de una unica sucursal, ver `config/logger.ts` para el mismo
    // criterio ya establecido).
    await auditService.log({
      action: AuditAction.LOGIN_FAILED,
      entity: 'user',
      sucursalId: env.SUCURSAL_ID,
      ip,
      metadata: { username: dto.username, reason: 'user_not_found' },
    });
    throw new UnauthorizedError('Usuario o contrasena invalidos.');
  }

  const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

  if (!passwordMatches) {
    await auditService.log({
      action: AuditAction.LOGIN_FAILED,
      entity: 'user',
      entityId: user.id,
      userId: user.id,
      sucursalId: user.sucursalId,
      ip,
      metadata: { username: dto.username, reason: 'invalid_password' },
    });
    throw new UnauthorizedError('Usuario o contrasena invalidos.');
  }

  if (!user.active) {
    await auditService.log({
      action: AuditAction.LOGIN_FAILED,
      entity: 'user',
      entityId: user.id,
      userId: user.id,
      sucursalId: user.sucursalId,
      ip,
      metadata: { username: dto.username, reason: 'inactive_user' },
    });
    throw new UnauthorizedError('El usuario se encuentra inactivo.');
  }

  await authRepository.updateLastLogin(user.id);

  const payload: JwtPayload = {
    sub: user.id,
    role: user.role.name,
    sucursalId: user.sucursalId,
    tokenVersion: user.tokenVersion,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  await auditService.log({
    action: AuditAction.LOGIN,
    entity: 'user',
    entityId: user.id,
    userId: user.id,
    sucursalId: user.sucursalId,
  });

  // `userWithRoleInclude` (auth.repository.ts) ya trae Role -> RolePermission
  // -> Permission; solo se proyecta el `code` de cada permiso, que es el
  // formato plano (`Permission[]`) que el frontend espera en `user.permissions`.
  const permissions = user.role.rolePermissions.map(
    (rolePermission: { permission: { code: string } }) => rolePermission.permission.code,
  );

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role.name,
      permissions,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Verifica la contrasena del usuario YA AUTENTICADO — Bloque 7.24, pantalla
 * de bloqueo por inactividad. Nunca emite ni rota tokens ni toca la cookie
 * de refresco: no es un inicio de sesion nuevo, solo confirma que quien
 * esta frente a la maquina sigue siendo el mismo usuario de la sesion ya
 * vigente. `req.user.id` (JWT del `accessToken` actual) es la fuente del
 * `userId`, nunca un `username` recibido en el body.
 *
 * Deliberadamente NO reutiliza `login()`: esa funcion emite un par de
 * tokens nuevo (dejaria el refresh token anterior sin revocar, ver
 * `refreshTokenRepository.create`) y en la ruta pasa por `loginRateLimiter`
 * (5 intentos/15min POR IP) — en esta arquitectura on-premise todo el
 * trafico llega desde el mismo loopback, asi que ese cupo lo comparte el
 * terminal ENTERO, no cada usuario; un puñado de intentos fallidos al
 * desbloquear dejaria a cualquiera sin poder iniciar sesion en esa maquina
 * por 15 minutos. Esta funcion vive detras de `authenticate` (ver
 * `auth.routes.ts`) — no es una superficie anonima, por lo que el cupo
 * generoso de `authRateLimiter` (misma categoria que `/refresh` y
 * `/logout`) es la proteccion adecuada.
 *
 * Reutiliza `AuditAction.LOGIN_FAILED` ya existente para un intento
 * fallido (no amerita una accion de auditoria nueva, que requeriria migrar
 * el enum de Postgres) — un intento exitoso no se audita: no es un evento
 * de autenticacion nuevo, solo la confirmacion de una sesion que ya era
 * valida.
 */
export async function verifyPassword(userId: string, password: string, ip?: string): Promise<void> {
  const user = await authRepository.findById(userId);

  if (!user) {
    throw new UnauthorizedError('Usuario no encontrado.');
  }

  if (!user.active) {
    throw new UnauthorizedError('El usuario se encuentra inactivo.');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    await auditService.log({
      action: AuditAction.LOGIN_FAILED,
      entity: 'user',
      entityId: user.id,
      userId: user.id,
      sucursalId: user.sucursalId,
      ip,
      metadata: { username: user.username, reason: 'invalid_password_unlock' },
    });
    throw new UnauthorizedError('Contrasena incorrecta.');
  }
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * Emite un nuevo access token a partir de un refresh token vigente, y
 * rota el refresh token (A-02): el usado se revoca, se emite y persiste
 * uno nuevo. Si el token recibido ya fue revocado (reutilizacion de un
 * token que ya se roto antes), se trata como incidente de seguridad:
 * se revocan TODOS los refresh tokens activos del usuario.
 *
 * El nuevo refresh token se devuelve al controller unicamente para que
 * lo escriba en la cookie httpOnly (`auth.controller.ts`) — nunca debe
 * pasar de ahi hacia el body de la respuesta.
 */
export async function refresh(token: string): Promise<RefreshResult> {
  const payload = verifyRefreshToken(token);
  const tokenHash = hashToken(token);

  const storedToken = await refreshTokenRepository.findByTokenHash(tokenHash);

  if (!storedToken) {
    throw new UnauthorizedError('Sesion invalida. Inicia sesion nuevamente.');
  }

  if (storedToken.revokedAt) {
    // Reuso de un token ya rotado/revocado: incidente de seguridad.
    await refreshTokenRepository.revokeAllByUserId(storedToken.userId);
    throw new UnauthorizedError('Sesion invalida. Inicia sesion nuevamente.');
  }

  if (storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Sesion expirada. Inicia sesion nuevamente.');
  }

  const user = await authRepository.findById(payload.sub);

  if (!user) {
    throw new UnauthorizedError('Usuario no encontrado.');
  }

  if (!user.active) {
    throw new UnauthorizedError('El usuario se encuentra inactivo.');
  }

  // Hallazgo de seguridad #3 (auditoria 31/07/2026): `tokenVersion` cambio
  // desde que se emitio este refresh token (desactivacion revertida luego,
  // cambio de rol o cambio de contrasena, `users.service.ts`) — se trata
  // igual que la reutilizacion de un token ya rotado (linea 144 mas abajo):
  // incidente de seguridad, se revocan TODOS los refresh tokens del usuario.
  if (payload.tokenVersion !== user.tokenVersion) {
    await refreshTokenRepository.revokeAllByUserId(user.id);
    throw new UnauthorizedError('Sesion invalida. Inicia sesion nuevamente.');
  }

  const newPayload: JwtPayload = {
    sub: user.id,
    role: user.role.name,
    sucursalId: user.sucursalId,
    tokenVersion: user.tokenVersion,
  };

  const accessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  await refreshTokenRepository.revoke(storedToken.id);

  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Registra el evento de cierre de sesion en `AuditLog` y revoca el
 * refresh token correspondiente (A-02).
 *
 * `refreshToken` es opcional por compatibilidad con el punto de llamada
 * actual del controller (que todavia no lo pasa) — sin el, se revocan
 * TODOS los tokens activos del usuario (comportamiento seguro por
 * defecto, equivalente a "cerrar todas mis sesiones"). Cuando el
 * controller se actualice para pasar el token de la cookie actual, el
 * logout revocara unicamente esa sesion puntual, no todas.
 */
export async function logout(userId: string, refreshToken?: string): Promise<void> {
  const user = await authRepository.findById(userId);

  if (!user) {
    throw new UnauthorizedError('Usuario no encontrado.');
  }

  if (!user.active) {
    throw new UnauthorizedError('El usuario se encuentra inactivo.');
  }

  if (refreshToken) {
    const storedToken = await refreshTokenRepository.findByTokenHash(hashToken(refreshToken));

    if (storedToken) {
      await refreshTokenRepository.revoke(storedToken.id);
    }
  } else {
    await refreshTokenRepository.revokeAllByUserId(userId);
  }

  await auditService.log({
    action: AuditAction.LOGOUT,
    entity: 'user',
    entityId: user.id,
    userId: user.id,
    sucursalId: user.sucursalId,
  });
}
