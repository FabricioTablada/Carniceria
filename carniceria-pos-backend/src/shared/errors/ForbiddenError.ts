import { AppError } from './AppError';

/** El usuario esta autenticado pero no tiene permisos. HTTP 403. */
export class ForbiddenError extends AppError {
  constructor(message = 'No tiene permisos para realizar esta accion.', details?: unknown) {
    super(message, 403, 'FORBIDDEN', true, details);
  }
}
