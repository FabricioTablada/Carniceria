/**
 * middlewares/validate.middleware.ts
 * -----------------------------------------------------------------------------
 * Valida body, params y query contra un esquema Zod antes de llegar al
 * controlador. Cada modulo define sus esquemas en `*.validation.ts`.
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ValidationError } from '@/shared/errors';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError('Datos de entrada invalidos.', error.flatten());
      }
      throw error;
    }
  };
}
