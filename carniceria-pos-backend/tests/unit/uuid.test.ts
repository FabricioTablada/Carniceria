/**
 * tests/unit/uuid.test.ts
 * -----------------------------------------------------------------------------
 * Cubre `generateUuid()` e `isUuid()` de shared/utils/uuid.ts: formato real
 * de UUID v4, unicidad entre llamadas sucesivas, y los casos normales y
 * borde de validacion (UUID valido, cadena vacia, cadena arbitraria, UUID
 * con formato incorrecto, mayusculas). Sin Prisma, sin base de datos, sin
 * ningun servicio externo — el paquete `uuid` no depende de ningun
 * binario nativo, a diferencia de Prisma.
 */
import { describe, it, expect } from 'vitest';
import { generateUuid, isUuid } from '../../src/shared/utils/uuid';

describe('generateUuid', () => {
  it('genera un string con formato de UUID v4', () => {
    const id = generateUuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('genera valores distintos en llamadas sucesivas', () => {
    const id1 = generateUuid();
    const id2 = generateUuid();
    expect(id1).not.toBe(id2);
  });

  it('el resultado siempre pasa su propia validacion (isUuid)', () => {
    const id = generateUuid();
    expect(isUuid(id)).toBe(true);
  });
});

describe('isUuid', () => {
  it('reconoce un UUID v4 valido', () => {
    expect(isUuid('45639bc8-23fb-42d9-a422-478368fedfa8')).toBe(true);
  });

  it('reconoce un UUID valido en mayusculas', () => {
    expect(isUuid('45639BC8-23FB-42D9-A422-478368FEDFA8')).toBe(true);
  });

  it('rechaza una cadena vacia', () => {
    expect(isUuid('')).toBe(false);
  });

  it('rechaza una cadena que no tiene formato de UUID', () => {
    expect(isUuid('no-es-un-uuid')).toBe(false);
  });

  it('rechaza un UUID con un caracter de mas', () => {
    expect(isUuid('45639bc8-23fb-42d9-a422-478368fedfa8a')).toBe(false);
  });

  it('rechaza un UUID con un caracter de menos', () => {
    expect(isUuid('45639bc8-23fb-42d9-a422-478368fedfa')).toBe(false);
  });

  it('rechaza un UUID con caracteres invalidos (no hexadecimales)', () => {
    expect(isUuid('zzzzzzzz-23fb-42d9-a422-478368fedfa8')).toBe(false);
  });

  it('rechaza un UUID sin guiones', () => {
    expect(isUuid('45639bc823fb42d9a422478368fedfa8')).toBe(false);
  });
});
