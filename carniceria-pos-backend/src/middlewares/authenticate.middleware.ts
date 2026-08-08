/**
 * middlewares/authenticate.middleware.ts
 * -----------------------------------------------------------------------------
 * Verifica el JWT de acceso y adjunta el usuario autenticado a `req.user`.
 * Es infraestructura generica: no contiene reglas de negocio de autenticacion
 * (esas viven en el modulo `auth`). Aqui solo se valida y decodifica el token.
 */
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '@/config';
import { UnauthorizedError } from '@/shared/errors';

interface AccessTokenPayload {
  sub: string;
  role: string;
  sucursalId: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acceso ausente.');
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, jwtConfig.access.secret) as AccessTokenPayload;
    req.user = {
      id: payload.sub,
      role: payload.role,
      sucursalId: payload.sucursalId,
    };
    next();
  } catch {
    throw new UnauthorizedError('Token de acceso invalido o expirado.');
  }
}
