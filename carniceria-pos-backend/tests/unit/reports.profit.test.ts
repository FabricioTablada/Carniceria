/**
 * tests/unit/reports.profit.test.ts
 * -----------------------------------------------------------------------------
 * Bloque COST-03.2 (correccion de historico, Opcion A aprobada) del
 * Reporte de Utilidad (`getProfitReport`, `modules/reports/reports.service.ts`).
 * Cubre los escenarios exigidos:
 *  - Venta SIN merma esperada activada al momento de la venta
 *    (`applyExpectedWasteToCostAtSale: false`): `effectiveCost` identico a
 *    `unitCost`, `costTotal`/`profit`/`marginPercent` sin cambios.
 *  - Venta CON merma esperada activada al momento de la venta
 *    (`applyExpectedWasteToCostAtSale: true`, `expectedWastePercentAtSale >
 *    0`): `effectiveCost` mayor a `unitCost`.
 *  - Snapshot ausente (`expectedWastePercentAtSale`/
 *    `applyExpectedWasteToCostAtSale: null`, venta anterior a este bloque):
 *    se trata como `applyExpectedWasteToCostAtSale: false` — NUNCA se
 *    infiere del `Product` vigente.
 *  - CRITICO (regresion del defecto de COST-03 original): cambiar
 *    `Product.expectedWastePercent`/`applyExpectedWasteToCost` DESPUES de
 *    la venta no debe alterar la utilidad ya calculada — el mock de
 *    `product` en estos tests deliberadamente NUNCA trae esos 2 campos
 *    (ni siquiera se seleccionan en `profitReportInclude`), para que sea
 *    imposible que el servicio los use por error.
 *  - `unitCost: null`: todos los campos derivados siguen siendo `null`,
 *    sin invocar el CostEngine.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/reports/reports.repository', () => ({
  getProfitReport: vi.fn(),
}));

import * as reportsRepository from '@/modules/reports/reports.repository';
import { getProfitReport } from '@/modules/reports/reports.service';

function baseSaleItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sale-item-1',
    saleId: 'sale-1',
    productId: 'product-1',
    taxId: null,
    quantity: 2,
    unitPrice: 1000,
    taxRate: 0,
    discount: 0,
    lineSubtotal: 2000,
    lineTax: 0,
    lineTotal: 2000,
    unitCost: 500,
    // Bloque COST-03.2: snapshots en el SaleItem, NUNCA en `product`.
    expectedWastePercentAtSale: 0,
    applyExpectedWasteToCostAtSale: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    syncStatus: 'PENDING',
    // Deliberadamente SIN `expectedWastePercent`/`applyExpectedWasteToCost`
    // (mismo shape real que `profitReportInclude` produce desde
    // COST-03.2) — si el servicio los llegara a leer por error, el test
    // fallaria con `undefined` en vez de silenciosamente "funcionar".
    product: { id: 'product-1', sku: 'SKU-1', name: 'Lomito', cost: 500 },
    sale: { id: 'sale-1', documentNumber: 'VTA-000001', saleDate: new Date('2026-01-01') },
    tax: null,
    ...overrides,
  };
}

async function runReport(item: ReturnType<typeof baseSaleItem>) {
  vi.mocked(reportsRepository.getProfitReport).mockResolvedValue([[item], 1] as never);

  const result = await getProfitReport({ page: 1, limit: 20, skip: 0 });

  return result.items[0] as {
    unitCost: number | null;
    effectiveCost: number | null;
    costTotal: number | null;
    profit: number | null;
    marginPercent: number | null;
  };
}

describe('getProfitReport — venta SIN merma esperada activada al momento de la venta', () => {
  it('effectiveCost es identico a unitCost y la utilidad usa el costo promedio, sin cambios', async () => {
    const mapped = await runReport(
      baseSaleItem({
        unitCost: 500,
        lineSubtotal: 2000,
        quantity: 2,
        expectedWastePercentAtSale: 0,
        applyExpectedWasteToCostAtSale: false,
      }),
    );

    expect(mapped.unitCost).toBe(500);
    expect(mapped.effectiveCost).toBe(500);
    // costTotal = effectiveCost * quantity = 500 * 2 = 1000
    expect(mapped.costTotal).toBe(1000);
    // profit = lineSubtotal - costTotal = 2000 - 1000 = 1000
    expect(mapped.profit).toBe(1000);
    // marginPercent = (profit / lineSubtotal) * 100 = 50
    expect(mapped.marginPercent).toBe(50);
  });

  it('ignora un expectedWastePercentAtSale configurado si el toggle estaba apagado en la venta', async () => {
    const mapped = await runReport(
      baseSaleItem({
        unitCost: 500,
        expectedWastePercentAtSale: 25,
        applyExpectedWasteToCostAtSale: false,
      }),
    );

    expect(mapped.effectiveCost).toBe(500);
  });
});

describe('getProfitReport — venta CON merma esperada activada al momento de la venta', () => {
  it('effectiveCost es mayor a unitCost y la utilidad/margen reflejan el costo ajustado', async () => {
    const mapped = await runReport(
      baseSaleItem({
        unitCost: 500,
        lineSubtotal: 2000,
        quantity: 2,
        expectedWastePercentAtSale: 20,
        applyExpectedWasteToCostAtSale: true,
      }),
    );

    // effectiveCost = 500 / (1 - 20/100) = 500 / 0.8 = 625
    expect(mapped.effectiveCost).toBe(625);
    expect(mapped.effectiveCost!).toBeGreaterThan(mapped.unitCost!);
    // costTotal = 625 * 2 = 1250
    expect(mapped.costTotal).toBe(1250);
    // profit = 2000 - 1250 = 750 (menor que con el costo promedio: 1000)
    expect(mapped.profit).toBe(750);
    // marginPercent = (750 / 2000) * 100 = 37.5
    expect(mapped.marginPercent).toBe(37.5);
  });

  it('el Product.expectedWastePercent/applyExpectedWasteToCost VIGENTES son irrelevantes: el mock ni siquiera los expone', async () => {
    // Regresion del defecto corregido en COST-03.2: si el servicio alguna
    // vez volviera a leer `item.product.expectedWastePercent`, este test
    // fallaria con un error de "Cannot read properties of undefined", no
    // con un resultado incorrecto silencioso.
    const mapped = await runReport(
      baseSaleItem({
        unitCost: 500,
        expectedWastePercentAtSale: 20,
        applyExpectedWasteToCostAtSale: true,
      }),
    );

    expect(mapped.effectiveCost).toBe(625);
  });
});

describe('getProfitReport — venta anterior a este bloque (snapshot de merma ausente)', () => {
  it('trata expectedWastePercentAtSale/applyExpectedWasteToCostAtSale: null como "sin ajuste", sin inferir del Product vigente', async () => {
    const mapped = await runReport(
      baseSaleItem({
        unitCost: 500,
        lineSubtotal: 2000,
        quantity: 2,
        expectedWastePercentAtSale: null,
        applyExpectedWasteToCostAtSale: null,
      }),
    );

    // Compatibilidad (requisito #5 del bloque): null -> comportamiento
    // identico a `applyExpectedWasteToCost: false`.
    expect(mapped.effectiveCost).toBe(500);
    expect(mapped.costTotal).toBe(1000);
    expect(mapped.profit).toBe(1000);
  });
});

describe('getProfitReport — venta sin snapshot de costo (unitCost: null)', () => {
  it('effectiveCost/costTotal/profit/marginPercent siguen siendo null, sin invocar el CostEngine', async () => {
    const mapped = await runReport(
      baseSaleItem({
        unitCost: null,
        expectedWastePercentAtSale: 20,
        applyExpectedWasteToCostAtSale: true,
      }),
    );

    expect(mapped.unitCost).toBeNull();
    expect(mapped.effectiveCost).toBeNull();
    expect(mapped.costTotal).toBeNull();
    expect(mapped.profit).toBeNull();
    expect(mapped.marginPercent).toBeNull();
  });
});
