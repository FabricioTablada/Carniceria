/**
 * tests/unit/httpResponse.test.ts
 * -----------------------------------------------------------------------------
 * Cubre `success()` y `failure()` de shared/utils/httpResponse.ts: la
 * estructura completa del sobre de respuesta, con y sin `meta`/`details`,
 * y el caso borde real ya documentado en el propio codigo: `success()`
 * debe lanzar un error explicito cuando `data === undefined`, en vez de
 * producir en silencio un `200` vacio. Sin Prisma, sin base de datos, sin
 * ningun servicio externo — logica pura.
 */
import { describe, it, expect } from 'vitest';
import { success, failure } from '../../src/shared/utils/httpResponse';

describe('success', () => {
  it('devuelve el sobre completo sin meta cuando no se especifica', () => {
    const result = success({ id: '1', name: 'Producto' });
    expect(result).toEqual({
      success: true,
      data: { id: '1', name: 'Producto' },
    });
  });

  it('no incluye la clave meta cuando no se especifica', () => {
    const result = success({ id: '1' });
    expect('meta' in result).toBe(false);
  });

  it('devuelve el sobre completo con meta cuando se especifica', () => {
    const meta = { page: 1, limit: 20, total: 5 };
    const result = success([{ id: '1' }], meta);
    expect(result).toEqual({
      success: true,
      data: [{ id: '1' }],
      meta: { page: 1, limit: 20, total: 5 },
    });
  });

  it('conserva el tipo y el valor exacto de data (array)', () => {
    const data = [1, 2, 3];
    const result = success(data);
    expect(result.data).toBe(data);
  });

  it('conserva el tipo y el valor exacto de data (objeto anidado)', () => {
    const data = { user: { id: '1', roles: ['ADMIN'] } };
    const result = success(data);
    expect(result.data).toEqual(data);
  });

  it('lanza un error cuando data es undefined', () => {
    expect(() => success(undefined)).toThrow();
  });

  it('el mensaje del error explica la causa real del problema', () => {
    expect(() => success(undefined)).toThrow(/data=undefined/);
  });

  it('no lanza error cuando data es null (null no es undefined)', () => {
    expect(() => success(null)).not.toThrow();
    const result = success(null);
    expect(result).toEqual({ success: true, data: null });
  });

  it('no lanza error con valores falsy validos: 0', () => {
    const result = success(0);
    expect(result).toEqual({ success: true, data: 0 });
  });

  it('no lanza error con valores falsy validos: cadena vacia', () => {
    const result = success('');
    expect(result).toEqual({ success: true, data: '' });
  });

  it('no lanza error con valores falsy validos: false', () => {
    const result = success(false);
    expect(result).toEqual({ success: true, data: false });
  });

  it('no lanza error con valores falsy validos: array vacio', () => {
    const result = success([]);
    expect(result).toEqual({ success: true, data: [] });
  });
});

describe('failure', () => {
  it('devuelve el sobre completo sin details cuando no se especifica', () => {
    const result = failure('NOT_FOUND', 'Recurso no encontrado');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toBe('Recurso no encontrado');
  });

  it('la propiedad details existe siempre, incluso sin especificarla (a diferencia de meta en success)', () => {
    const result = failure('NOT_FOUND', 'Recurso no encontrado');
    expect('details' in result.error).toBe(true);
    expect(result.error.details).toBeUndefined();
  });

  it('devuelve el sobre completo con details cuando se especifica', () => {
    const details = { field: 'email', reason: 'formato invalido' };
    const result = failure('VALIDATION_ERROR', 'Datos invalidos', details);
    expect(result).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos invalidos',
        details: { field: 'email', reason: 'formato invalido' },
      },
    });
  });

  it('conserva code y message exactamente como se pasaron', () => {
    const result = failure('UNAUTHORIZED', 'Token invalido o expirado');
    expect(result.error.code).toBe('UNAUTHORIZED');
    expect(result.error.message).toBe('Token invalido o expirado');
  });

  it('acepta details como array', () => {
    const details = ['El campo A es obligatorio', 'El campo B es obligatorio'];
    const result = failure('VALIDATION_ERROR', 'Datos invalidos', details);
    expect(result.error.details).toEqual(details);
  });

  it('acepta details como string', () => {
    const result = failure('INTERNAL_ERROR', 'Error inesperado', 'stack trace resumido');
    expect(result.error.details).toBe('stack trace resumido');
  });

  it('success siempre es false en el sobre de error', () => {
    const result = failure('NOT_FOUND', 'Recurso no encontrado');
    expect(result.success).toBe(false);
  });
});