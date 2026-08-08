/**
 * shared/utils/jwt.ts
 * -----------------------------------------------------------------------------
 * Generacion y verificacion de tokens JWT (acceso y refresco).
 * Consume unicamente la configuracion centralizada en `config/jwt.ts`;
 * no se leen secretos ni tiempos de expiracion fuera de ese punto.
 */
import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { jwtConfig } from '@/config';
import { UnauthorizedError } from '@/shared/errors';

/** Payload embebido en los tokens de acceso y de refresco.
 *
 * `tokenVersion` (hallazgo de seguridad #3, auditoria 31/07/2026): snapshot
 * de `User.tokenVersion` al emitir el token. `auth.service.ts` lo compara
 * contra el valor vigente en base de datos UNICAMENTE en `refresh()` — una
 * desactivacion, cambio de rol o cambio de contrasena incrementa
 * `User.tokenVersion` (`users.service.ts`), invalidando el proximo refresco
 * sin requerir una consulta a la base de datos en cada request autenticado. */
export interface JwtPayload {
  sub: string;
  role: string;
  sucursalId: string;
  tokenVersion: number;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, jwtConfig.access.secret, {
    expiresIn: jwtConfig.access.expiresIn,
  } as SignOptions);
}

/**
 * A diferencia del access token, el refresh token se persiste (hasheado) en
 * `refresh_tokens.token_hash`, con restriccion UNIQUE. Sin un componente
 * aleatorio, dos refresh tokens del mismo usuario firmados dentro del mismo
 * segundo (mismo payload + mismo `iat` + mismo secreto) son byte-a-byte
 * identicos, violando esa restriccion. `jti` (claim estandar de JWT, RFC
 * 7519) garantiza unicidad por emision sin afectar al access token ni al
 * modelo de multiples sesiones por usuario.
 */
export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, jwtConfig.refresh.secret, {
    expiresIn: jwtConfig.refresh.expiresIn,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, jwtConfig.access.secret) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Token de acceso invalido o expirado.');
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, jwtConfig.refresh.secret) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Token de refresco invalido o expirado.');
  }
}
