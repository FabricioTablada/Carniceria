/**
 * shared/errors/AppError.ts
 * -----------------------------------------------------------------------------
 * Clase base de todos los errores controlados de la aplicacion.
 *
 * `isOperational = true` indica que es un error esperado del dominio (p.ej.
 * "recurso no encontrado") y no un bug. El manejador global de errores usa
 * esta distincion para decidir que exponer al cliente.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
