/**
 * tests/unit/money.test.ts
 * -----------------------------------------------------------------------------
 * Prueba minima para verificar que el arnes de pruebas funciona y que la
 * utilidad de dinero formatea Colones correctamente.
 *
 * Nota: requiere haber ejecutado `npm run prisma:generate` (money.ts usa
 * Prisma.Decimal).
 */
import { describe, it, expect } from 'vitest';
import { toMoney, addMoney } from '@/shared/utils/money';

describe('money util', () => {
  it('suma montos sin errores de punto flotante', () => {
    const result = addMoney(toMoney('0.1'), toMoney('0.2'));
    expect(result.toString()).toBe('0.3');
  });
});
