/**
 * shared/utils/asyncHandler.ts
 * -----------------------------------------------------------------------------
 * Envuelve controladores async para que cualquier promesa rechazada sea
 * redirigida automaticamente al manejador global de errores de Express,
 * evitando try/catch repetidos en cada controlador.
 */
import type { NextFunction, Request, Response } from 'express';

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(controller: AsyncController) {
  return (req: Request, res: Response, next: NextFunction): void => {
    controller(req, res, next).catch(next);
  };
}
