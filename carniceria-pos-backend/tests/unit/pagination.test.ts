/**
 * tests/unit/pagination.test.ts
 * -----------------------------------------------------------------------------
 * Cubre `resolvePagination()` y `buildPaginationMeta()` de
 * shared/utils/pagination.ts: valores por defecto, clamping de `limit`,
 * paginas invalidas, calculo de `skip`/`totalPages`, y los limites exactos
 * de `hasNext`/`hasPrev`. Sin Prisma, sin base de datos, sin ningun
 * servicio externo — logica pura.
 */
import { describe, it, expect } from 'vitest';
import { resolvePagination, buildPaginationMeta } from '../../src/shared/utils/pagination';

describe('resolvePagination', () => {
  it('usa los valores por defecto cuando no se envia page ni limit', () => {
    const result = resolvePagination({});
    expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('respeta page y limit validos', () => {
    const result = resolvePagination({ page: 3, limit: 10 });
    expect(result).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('calcula skip correctamente para una pagina avanzada', () => {
    const result = resolvePagination({ page: 5, limit: 10 });
    expect(result.skip).toBe(40);
  });

  it('vuelve a la pagina 1 cuando page es 0', () => {
    const result = resolvePagination({ page: 0, limit: 10 });
    expect(result.page).toBe(1);
  });

  it('vuelve a la pagina 1 cuando page es negativo', () => {
    const result = resolvePagination({ page: -5, limit: 10 });
    expect(result.page).toBe(1);
  });

  it('vuelve a la pagina 1 cuando page no es numerico', () => {
    const result = resolvePagination({ page: 'abc', limit: 10 });
    expect(result.page).toBe(1);
  });

  it('usa el limite por defecto cuando limit es 0', () => {
    const result = resolvePagination({ page: 1, limit: 0 });
    expect(result.limit).toBe(20);
  });

  it('el limite minimo permitido es 1, incluso con limit negativo', () => {
    const result = resolvePagination({ page: 1, limit: -5 });
    expect(result.limit).toBe(1);
  });

  it('el limite maximo permitido es 100, aunque se pida mas', () => {
    const result = resolvePagination({ page: 1, limit: 500 });
    expect(result.limit).toBe(100);
  });

  it('acepta el limite maximo exacto (100)', () => {
    const result = resolvePagination({ page: 1, limit: 100 });
    expect(result.limit).toBe(100);
  });

  it('acepta el limite minimo exacto (1)', () => {
    const result = resolvePagination({ page: 1, limit: 1 });
    expect(result.limit).toBe(1);
  });

  it('usa el limite por defecto cuando limit no es numerico', () => {
    const result = resolvePagination({ page: 1, limit: 'abc' });
    expect(result.limit).toBe(20);
  });
});

describe('buildPaginationMeta', () => {
  it('total = 0 produce totalPages = 1, no 0', () => {
    const meta = buildPaginationMeta(0, { page: 1, limit: 20, skip: 0 });
    expect(meta.totalPages).toBe(1);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
  });

  it('calcula totalPages redondeando hacia arriba', () => {
    const meta = buildPaginationMeta(50, { page: 1, limit: 20, skip: 0 });
    expect(meta.totalPages).toBe(3);
  });

  it('primera pagina: hasNext true, hasPrev false', () => {
    const meta = buildPaginationMeta(50, { page: 1, limit: 20, skip: 0 });
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(false);
  });

  it('pagina intermedia: hasNext true, hasPrev true', () => {
    const meta = buildPaginationMeta(50, { page: 2, limit: 20, skip: 20 });
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(true);
  });

  it('ultima pagina: hasNext false, hasPrev true', () => {
    const meta = buildPaginationMeta(50, { page: 3, limit: 20, skip: 40 });
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
  });

  it('total exactamente divisible por limit no genera una pagina extra vacia', () => {
    const meta = buildPaginationMeta(40, { page: 2, limit: 20, skip: 20 });
    expect(meta.totalPages).toBe(2);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
  });

  it('conserva page, limit y total tal cual se recibieron', () => {
    const meta = buildPaginationMeta(50, { page: 2, limit: 20, skip: 20 });
    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(20);
    expect(meta.total).toBe(50);
  });
});