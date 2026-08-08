import { AppError } from './AppError';

/** Datos de entrada invalidos. HTTP 422. */
export class ValidationError extends AppError {
  constructor(message = 'Datos de entrada invalidos.', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', true, details);
  }
}
