/**
 * modules/auth/refreshToken.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para los refresh tokens (A-02: rotacion y revocacion).
 * Es infraestructura pura: no valida datos de entrada y no contiene reglas
 * de negocio (eso vive en `auth.service.ts`). Usa unicamente la instancia
 * singleton de Prisma expuesta en `@/database`.
 *
 * Nunca recibe ni devuelve el JWT en texto plano — todas las operaciones
 * trabajan sobre `tokenHash` (el hash del token, calculado por el service).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/database';

export function create(data: Prisma.RefreshTokenUncheckedCreateInput) {
  return prisma.refreshToken.create({
    data,
  });
}

export function findByTokenHash(tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
  });
}

/** Revoca un unico token (usado en la rotacion: se revoca el token que
 * se acaba de usar, al mismo tiempo que se crea el nuevo). */
export function revoke(id: string) {
  return prisma.refreshToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/** Revoca todos los tokens activos (sin revocar aun) de un usuario —
 * usado en logout y en el caso de reuso detectado (incidente de
 * seguridad: se cierra toda sesion existente del usuario). */
export function revokeAllByUserId(userId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}