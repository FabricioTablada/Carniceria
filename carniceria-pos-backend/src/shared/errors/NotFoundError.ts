import { AppError } from './AppError';

/** El recurso solicitado no existe. HTTP 404. */
export class NotFoundError extends AppError {
  constructor(resource = 'Recurso', details?: unknown) {
    super(`${resource} no encontrado.`, 404, 'NOT_FOUND', true, details);
  }
}
