/**
 * tests/unit/date.test.ts
 * -----------------------------------------------------------------------------
 * Bloque COST-04.2 (correccion de zona horaria): `getCostaRicaDayRange()`
 * (`shared/utils/date.ts`), la utilidad compartida que reemplaza el calculo
 * en UTC que usaba `calculateTodayProfit()` (Dashboard, Bloque COST-04.1).
 *
 * El caso critico es un instante que ya cruzo la medianoche UTC pero
 * TODAVIA no cruzo la medianoche de Costa Rica (UTC-6) — exactamente el
 * defecto que este bloque corrige: con un corte en UTC, esa venta se
 * hubiera contado en el dia CALENDARIO equivocado.
 */
import { describe, expect, it } from 'vitest';
import { getCostaRicaDayRange } from '@/shared/utils/date';

describe('getCostaRicaDayRange', () => {
  it('resuelve el rango [medianoche CR, medianoche CR siguiente) para un instante a medio dia', () => {
    // 2026-01-15T18:00:00Z = 2026-01-15 12:00pm hora de Costa Rica (UTC-6).
    const { start, end } = getCostaRicaDayRange(new Date('2026-01-15T18:00:00.000Z'));

    expect(start.toISOString()).toBe('2026-01-15T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-16T06:00:00.000Z');
  });

  it('CASO CRITICO: un instante ya en el dia UTC siguiente, pero AUN en el dia calendario de Costa Rica, resuelve el dia correcto', () => {
    // 2026-01-16T02:00:00Z = 2026-01-15 20:00 hora de Costa Rica — todavia
    // 15 de enero para el negocio, aunque en UTC ya sea 16 de enero. Un
    // corte ingenuo en UTC (el defecto de COST-04.1) hubiera devuelto el
    // rango del 16 de enero, contando esta venta en el dia equivocado.
    const { start, end } = getCostaRicaDayRange(new Date('2026-01-16T02:00:00.000Z'));

    expect(start.toISOString()).toBe('2026-01-15T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-16T06:00:00.000Z');
  });

  it('el inicio del rango es exactamente la medianoche de Costa Rica (06:00 UTC)', () => {
    const { start } = getCostaRicaDayRange(new Date('2026-01-15T06:00:00.000Z'));

    expect(start.toISOString()).toBe('2026-01-15T06:00:00.000Z');
  });

  it('el fin del rango es exclusivo: exactamente 24 horas despues del inicio', () => {
    const { start, end } = getCostaRicaDayRange(new Date('2026-03-01T12:00:00.000Z'));

    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('sin argumento, usa la fecha/hora actual', () => {
    const before = Date.now();
    const { start, end } = getCostaRicaDayRange();
    const after = Date.now();

    expect(start.getTime()).toBeLessThanOrEqual(before);
    expect(end.getTime()).toBeGreaterThan(after);
  });
});
