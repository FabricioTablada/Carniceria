/**
 * middlewares/notFound.middleware.ts
 * -----------------------------------------------------------------------------
 * Captura cualquier ruta no registrada y delega en el manejador de errores.
 */
import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '@/shared/errors';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Ruta ${req.method} ${req.originalUrl}`));
}
