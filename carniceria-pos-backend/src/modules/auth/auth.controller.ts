/**
 * modules/auth/auth.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de autenticacion.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `auth.service.ts` y responder con el formato estandar de la API. No accede
 * a Prisma, no genera JWT ni compara contrasenas: esa logica vive en el
 * servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import { REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions } from '@/config/env';
import { LoginSchema, VerifyPasswordSchema } from './auth.validation';
import * as authService from './auth.service';

/** POST /login */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const dto = LoginSchema.parse(req.body);

  const { refreshToken, ...result } = await authService.login(dto, req.ip);

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshTokenCookieOptions);

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /refresh */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  if (!refreshToken) {
    throw new UnauthorizedError('No se encontro un token de refresco valido.');
  }

  const { refreshToken: newRefreshToken, ...result } = await authService.refresh(refreshToken);

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, refreshTokenCookieOptions);

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /verify-password */
export const verifyPassword = asyncHandler(async (req: Request, res: Response) => {
  // Mismo guard defensivo que /logout: `authenticate` garantiza `req.user`
  // en esta ruta (ver auth.routes.ts), el chequeo es defensivo.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto = VerifyPasswordSchema.parse(req.body);

  await authService.verifyPassword(req.user.id, dto.password, req.ip);

  res.status(HttpStatus.NO_CONTENT).send();
});

/** POST /logout */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  // Mismo guard defensivo ya usado en sales/controller.ts, cash/controller.ts
  // e inventory/controller.ts: `authenticate` garantiza `req.user` en esta
  // ruta (ver routes.ts), el chequeo es defensivo.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  await authService.logout(req.user.id, refreshToken);

  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenCookieOptions);

  res.status(HttpStatus.NO_CONTENT).send();
});