/**
 * shared/types/express.d.ts
 * -----------------------------------------------------------------------------
 * Extiende el tipo Request de Express para incluir el usuario autenticado.
 * Lo rellena `authenticate.middleware` tras validar el JWT.
 */
import 'express';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      role: string;
      sucursalId: string;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
