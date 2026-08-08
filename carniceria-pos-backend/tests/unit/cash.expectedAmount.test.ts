/**
 * tests/unit/cash.expectedAmount.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 2. Cubre `computeExpectedAmount` (modules/cash/service.ts) —
 * prioridad "Cierre de caja". Es, sobre todo, una prueba de REGRESION del
 * bug corregido en Sprint QA 1: `CashMovementType.REFUND` (reembolsos en
 * efectivo de una devolucion) se registraba en `CashMovement` pero jamas
 * se restaba del efectivo esperado, sobrestimando el monto e informando un
 * "faltante" falso al cerrar la caja.
 *
 * `computeExpectedAmount` se exportó (cero cambio de logica, solo
 * visibilidad) especificamente para poder probar este calculo en
 * aislamiento, sin pasar por todo `closeSession`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toMoney } from '@/shared/utils/money';

vi.mock('@/database', () => ({ prisma: {} }));

vi.mock('@/modules/cash/repository', () => ({
  sumMovementsByType: vi.fn(),
  sumCashSalesAmount: vi.fn(),
}));

import * as cashRepository from '@/modules/cash/repository';
import { computeExpectedAmount } from '@/modules/cash/service';

describe('computeExpectedAmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin movimientos ni ventas: el efectivo esperado es exactamente el fondo de apertura', async () => {
    vi.mocked(cashRepository.sumMovementsByType).mockResolvedValue([] as never);
    vi.mocked(cashRepository.sumCashSalesAmount).mockResolvedValue({ _sum: { total: null } } as never);

    const result = await computeExpectedAmount('session-1', toMoney(10000), {} as never);

    expect(result.toString()).toBe('10000');
  });

  it('CASH_IN suma y CASH_OUT resta al fondo de apertura', async () => {
    vi.mocked(cashRepository.sumMovementsByType).mockResolvedValue([
      { type: 'CASH_IN', _sum: { amount: toMoney(5000) } },
      { type: 'CASH_OUT', _sum: { amount: toMoney(2000) } },
    ] as never);
    vi.mocked(cashRepository.sumCashSalesAmount).mockResolvedValue({ _sum: { total: null } } as never);

    const result = await computeExpectedAmount('session-1', toMoney(10000), {} as never);

    // 10000 + 5000 - 2000 = 13000
    expect(result.toString()).toBe('13000');
  });

  it('REGRESION (fix de Sprint QA 1): REFUND se RESTA del efectivo esperado, igual que CASH_OUT', async () => {
    vi.mocked(cashRepository.sumMovementsByType).mockResolvedValue([
      { type: 'REFUND', _sum: { amount: toMoney(1500) } },
    ] as never);
    vi.mocked(cashRepository.sumCashSalesAmount).mockResolvedValue({ _sum: { total: null } } as never);

    const result = await computeExpectedAmount('session-1', toMoney(10000), {} as never);

    // Antes del fix, este resultado habria sido 10000 (REFUND ignorado por
    // completo) — el efectivo esperado quedaba sobrestimado en 1500.
    expect(result.toString()).toBe('8500');
  });

  it('ventas en efectivo (COMPLETED, CASH) suman al efectivo esperado', async () => {
    vi.mocked(cashRepository.sumMovementsByType).mockResolvedValue([] as never);
    vi.mocked(cashRepository.sumCashSalesAmount).mockResolvedValue({
      _sum: { total: toMoney(3200) },
    } as never);

    const result = await computeExpectedAmount('session-1', toMoney(10000), {} as never);

    expect(result.toString()).toBe('13200');
  });

  it('combina apertura + CASH_IN - CASH_OUT - REFUND + ventas en efectivo correctamente', async () => {
    vi.mocked(cashRepository.sumMovementsByType).mockResolvedValue([
      { type: 'CASH_IN', _sum: { amount: toMoney(1000) } },
      { type: 'CASH_OUT', _sum: { amount: toMoney(400) } },
      { type: 'REFUND', _sum: { amount: toMoney(600) } },
    ] as never);
    vi.mocked(cashRepository.sumCashSalesAmount).mockResolvedValue({
      _sum: { total: toMoney(2000) },
    } as never);

    const result = await computeExpectedAmount('session-1', toMoney(5000), {} as never);

    // 5000 + 1000 - 400 - 600 + 2000 = 7000
    expect(result.toString()).toBe('7000');
  });
});
