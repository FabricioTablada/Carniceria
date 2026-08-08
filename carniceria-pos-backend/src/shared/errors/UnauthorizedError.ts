import { AppError } from './AppError';

/** Falta autenticacion o el token es invalido. HTTP 401. */
export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado.', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', true, details);
  }
}
