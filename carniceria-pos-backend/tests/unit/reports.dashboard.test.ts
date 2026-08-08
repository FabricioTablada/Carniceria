/**
 * tests/unit/reports.dashboard.test.ts
 * -----------------------------------------------------------------------------
 * Bloque COST-04.1 (utilidad diaria del Dashboard — Fase 1 del analisis
 * aprobado). Cubre `getDashboard()` (`modules/reports/reports.service.ts`):
 *  - Toggle apagado (`applyExpectedWasteToCostAtSale: false`):
 *    `totalProfitToday` usa `unitCost` directamente, sin ajuste.
 *  - Toggle encendido con merma (`applyExpectedWasteToCostAtSale: true`,
 *    `expectedWastePercentAtSale > 0`): la utilidad es MENOR que con el
 *    costo promedio (el costo efectivo es mayor).
 *  - Snapshots ausentes (`null`): tratados como `applyExpectedWasteToCostAtSale:
 *    false`, NUNCA inferidos del `Product` vigente (el mock de
 *    `getDashboardTodaySaleItems` ni siquiera expone campos de `Product`).
 *  - Sin ventas hoy: `totalProfitToday`/`averageMarginToday` son `0`, sin
 *    `NaN` ni division por cero.
 *  - Linea sin `unitCost` (`null`): se excluye del calculo por completo,
 *    ni su utilidad ni su subtotal participan.
 *  - El resto de las 9 metricas existentes del Dashboard no cambia
 *    (compatibilidad total).
 *
 * Bloque COST-04.2 (correccion de zona horaria): se agrega un test que
 * verifica que el rango pedido a `getDashboardTodaySaleItems` sea el dia
 * calendario de COSTA RICA (`getCostaRicaDayRange`, `shared/utils/date.ts`),
 * no un corte en UTC — ver `tests/unit/date.test.ts` para la prueba
 * exhaustiva de esa utilidad en si.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/reports/reports.repository', () => ({
  getDashboard: vi.fn(),
  getDashboardTodaySaleItems: vi.fn(),
}));

import * as reportsRepository from '@/modules/reports/reports.repository';
import { getDashboard } from '@/modules/reports/reports.service';

const baseDashboardAggregate = {
  totalSales: 10,
  totalSalesAmount: 50000,
  totalPurchases: 3,
  totalPurchaseAmount: 20000,
  totalProducts: 40,
  totalCategories: 5,
  totalSuppliers: 4,
  totalUsers: 6,
  openCashSessions: 1,
};

function saleItem(overrides: Record<string, unknown> = {}) {
  return {
    unitCost: 500,
    expectedWastePercentAtSale: 0,
    applyExpectedWasteToCostAtSale: false,
    lineSubtotal: 2000,
    quantity: 2,
    ...overrides,
  };
}

function mockRepository(todaySaleItems: ReturnType<typeof saleItem>[]) {
  vi.mocked(reportsRepository.getDashboard).mockResolvedValue(baseDashboardAggregate as never);
  vi.mocked(reportsRepository.getDashboardTodaySaleItems).mockResolvedValue(todaySaleItems as never);
}

describe('getDashboard — toggle apagado', () => {
  it('totalProfitToday usa unitCost directamente, sin ajuste', async () => {
    mockRepository([
      saleItem({
        unitCost: 500,
        lineSubtotal: 2000,
        quantity: 2,
        applyExpectedWasteToCostAtSale: false,
      }),
    ]);

    const result = await getDashboard();

    // profit = lineSubtotal - (unitCost * quantity) = 2000 - 1000 = 1000
    expect(result.totalProfitToday).toBe(1000);
    expect(result.averageMarginToday).toBe(50);
  });

  it('ignora un expectedWastePercentAtSale configurado si el toggle estaba apagado', async () => {
    mockRepository([
      saleItem({
        unitCost: 500,
        expectedWastePercentAtSale: 25,
        applyExpectedWasteToCostAtSale: false,
      }),
    ]);

    const result = await getDashboard();

    expect(result.totalProfitToday).toBe(1000);
  });
});

describe('getDashboard — toggle encendido con merma aplicada', () => {
  it('totalProfitToday es menor que con el costo promedio (costo efectivo mas alto)', async () => {
    mockRepository([
      saleItem({
        unitCost: 500,
        lineSubtotal: 2000,
        quantity: 2,
        expectedWastePercentAtSale: 20,
        applyExpectedWasteToCostAtSale: true,
      }),
    ]);

    const result = await getDashboard();

    // effectiveCost = 500 / (1 - 0.20) = 625; profit = 2000 - (625*2) = 750
    expect(result.totalProfitToday).toBe(750);
    expect(result.averageMarginToday).toBe(37.5);
    expect(result.totalProfitToday).toBeLessThan(1000);
  });
});

describe('getDashboard — snapshots ausentes (venta anterior a COST-03.2)', () => {
  it('trata expectedWastePercentAtSale/applyExpectedWasteToCostAtSale: null como "sin ajuste"', async () => {
    mockRepository([
      saleItem({
        unitCost: 500,
        lineSubtotal: 2000,
        quantity: 2,
        expectedWastePercentAtSale: null,
        applyExpectedWasteToCostAtSale: null,
      }),
    ]);

    const result = await getDashboard();

    expect(result.totalProfitToday).toBe(1000);
  });
});

describe('getDashboard — sin ventas hoy', () => {
  it('totalProfitToday y averageMarginToday son 0, sin NaN ni division por cero', async () => {
    mockRepository([]);

    const result = await getDashboard();

    expect(result.totalProfitToday).toBe(0);
    expect(result.averageMarginToday).toBe(0);
    expect(Number.isNaN(result.averageMarginToday)).toBe(false);
  });
});

describe('getDashboard — linea sin snapshot de costo (unitCost: null)', () => {
  it('excluye la linea por completo del calculo (ni utilidad ni subtotal)', async () => {
    mockRepository([
      saleItem({ unitCost: null, lineSubtotal: 5000, quantity: 1 }),
      saleItem({ unitCost: 500, lineSubtotal: 2000, quantity: 2 }),
    ]);

    const result = await getDashboard();

    // Solo la segunda linea participa: profit = 2000 - 1000 = 1000,
    // margen = 1000/2000 = 50% (el subtotal 5000 de la primera linea NO
    // se suma al denominador).
    expect(result.totalProfitToday).toBe(1000);
    expect(result.averageMarginToday).toBe(50);
  });
});

describe('getDashboard — compatibilidad con el resto de metricas existentes', () => {
  it('no altera ninguna de las 9 metricas previas del Dashboard', async () => {
    mockRepository([]);

    const result = await getDashboard();

    expect(result.totalSales).toBe(10);
    expect(result.totalSalesAmount).toBe(50000);
    expect(result.totalPurchases).toBe(3);
    expect(result.totalPurchaseAmount).toBe(20000);
    expect(result.totalProducts).toBe(40);
    expect(result.totalCategories).toBe(5);
    expect(result.totalSuppliers).toBe(4);
    expect(result.totalUsers).toBe(6);
    expect(result.openCashSessions).toBe(1);
  });
});

describe('getDashboard — Bloque COST-04.2 (zona horaria de Costa Rica, no UTC)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pide a getDashboardTodaySaleItems el rango del dia calendario de Costa Rica, no el corte en UTC', async () => {
    // "Ahora" = 2026-01-16T02:00:00Z = 2026-01-15 20:00 hora de Costa Rica
    // (UTC-6): todavia 15 de enero para el negocio, aunque en UTC ya sea
    // 16 de enero. Un corte ingenuo en UTC (el defecto de COST-04.1)
    // hubiera pedido el rango del 16 de enero.
    vi.setSystemTime(new Date('2026-01-16T02:00:00.000Z'));
    mockRepository([]);

    await getDashboard();

    expect(reportsRepository.getDashboardTodaySaleItems).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: new Date('2026-01-15T06:00:00.000Z'),
        dateToExclusive: new Date('2026-01-16T06:00:00.000Z'),
      }),
    );
  });
});
