import { AppError } from './AppError';

/** Un servicio externo (API de un tercero) no respondio correctamente:
 * caida de red, timeout, o un error propio de ese servicio. HTTP 502.
 * Primer uso: `modules/integrations/alegra` (Bloque 7.3). */
export class ExternalServiceError extends AppError {
  constructor(message = 'El servicio externo no respondio correctamente.', details?: unknown) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', true, details);
  }
}
