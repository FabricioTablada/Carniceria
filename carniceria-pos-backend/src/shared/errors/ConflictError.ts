import { AppError } from './AppError';

/** Conflicto de estado (p.ej. registro duplicado). HTTP 409. */
export class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual del recurso.', details?: unknown) {
    super(message, 409, 'CONFLICT', true, details);
  }
}
