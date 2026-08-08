/**
 * tests/unit/errors.test.ts
 * -----------------------------------------------------------------------------
 * Cubre `AppError` (shared/errors/AppError.ts) y sus 5 subclases
 * (NotFoundError, ValidationError, UnauthorizedError, ForbiddenError,
 * ConflictError): valores por defecto, `statusCode`/`code` propios de cada
 * subclase, mensajes personalizados, propagacion de `details`, y que
 * `name` se resuelva correctamente a la subclase real (`this.constructor.name`).
 * Sin Prisma, sin base de datos, sin ningun servicio externo — logica pura
 * de clases de JavaScript, sin efectos secundarios.
 */
import { describe, it, expect } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../src/shared/errors';

describe('AppError', () => {
  it('usa los valores por defecto cuando solo se pasa el mensaje', () => {
    const error = new AppError('Algo salio mal.');
    expect(error.message).toBe('Algo salio mal.');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('respeta statusCode, code, isOperational y details cuando se especifican', () => {
    const details = { field: 'email' };
    const error = new AppError('Mensaje custom', 418, 'TEAPOT', false, details);
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('TEAPOT');
    expect(error.isOperational).toBe(false);
    expect(error.details).toBe(details);
  });

  it('name se resuelve al nombre real de la clase (AppError)', () => {
    const error = new AppError('x');
    expect(error.name).toBe('AppError');
  });

  it('es una instancia real de Error', () => {
    const error = new AppError('x');
    expect(error).toBeInstanceOf(Error);
  });

  it('tiene un stack trace capturado', () => {
    const error = new AppError('x');
    expect(typeof error.stack).toBe('string');
    expect(error.stack).toBeTruthy();
  });
});

describe('NotFoundError', () => {
  it('usa "Recurso" como valor por defecto', () => {
    const error = new NotFoundError();
    expect(error.message).toBe('Recurso no encontrado.');
  });

  it('arma el mensaje con el nombre del recurso indicado', () => {
    const error = new NotFoundError('Producto');
    expect(error.message).toBe('Producto no encontrado.');
  });

  it('fija statusCode 404 y code NOT_FOUND', () => {
    const error = new NotFoundError('Producto');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('propaga details cuando se especifica', () => {
    const details = { id: 'abc-123' };
    const error = new NotFoundError('Producto', details);
    expect(error.details).toBe(details);
  });

  it('name se resuelve a NotFoundError, no a AppError', () => {
    const error = new NotFoundError('Producto');
    expect(error.name).toBe('NotFoundError');
  });

  it('es instancia de AppError y de Error', () => {
    const error = new NotFoundError('Producto');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ValidationError', () => {
  it('usa el mensaje por defecto cuando no se especifica', () => {
    const error = new ValidationError();
    expect(error.message).toBe('Datos de entrada invalidos.');
  });

  it('respeta un mensaje personalizado', () => {
    const error = new ValidationError('El campo email es obligatorio.');
    expect(error.message).toBe('El campo email es obligatorio.');
  });

  it('fija statusCode 422 y code VALIDATION_ERROR', () => {
    const error = new ValidationError();
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('propaga details cuando se especifica', () => {
    const details = ['El campo A es obligatorio.'];
    const error = new ValidationError('Datos invalidos', details);
    expect(error.details).toBe(details);
  });

  it('name se resuelve a ValidationError', () => {
    const error = new ValidationError();
    expect(error.name).toBe('ValidationError');
  });
});

describe('UnauthorizedError', () => {
  it('usa el mensaje por defecto cuando no se especifica', () => {
    const error = new UnauthorizedError();
    expect(error.message).toBe('No autenticado.');
  });

  it('respeta un mensaje personalizado', () => {
    const error = new UnauthorizedError('Token invalido o expirado.');
    expect(error.message).toBe('Token invalido o expirado.');
  });

  it('fija statusCode 401 y code UNAUTHORIZED', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('name se resuelve a UnauthorizedError', () => {
    const error = new UnauthorizedError();
    expect(error.name).toBe('UnauthorizedError');
  });
});

describe('ForbiddenError', () => {
  it('usa el mensaje por defecto cuando no se especifica', () => {
    const error = new ForbiddenError();
    expect(error.message).toBe('No tiene permisos para realizar esta accion.');
  });

  it('respeta un mensaje personalizado', () => {
    const error = new ForbiddenError('Rol insuficiente para esta operacion.');
    expect(error.message).toBe('Rol insuficiente para esta operacion.');
  });

  it('fija statusCode 403 y code FORBIDDEN', () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('name se resuelve a ForbiddenError', () => {
    const error = new ForbiddenError();
    expect(error.name).toBe('ForbiddenError');
  });
});

describe('ConflictError', () => {
  it('usa el mensaje por defecto cuando no se especifica', () => {
    const error = new ConflictError();
    expect(error.message).toBe('Conflicto con el estado actual del recurso.');
  });

  it('respeta un mensaje personalizado', () => {
    const error = new ConflictError('El nombre de usuario ya existe.');
    expect(error.message).toBe('El nombre de usuario ya existe.');
  });

  it('fija statusCode 409 y code CONFLICT', () => {
    const error = new ConflictError();
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  it('name se resuelve a ConflictError', () => {
    const error = new ConflictError();
    expect(error.name).toBe('ConflictError');
  });
});