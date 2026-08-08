/**
 * tests/unit/costEngine.test.ts
 * -----------------------------------------------------------------------------
 * Pruebas del Motor de Costos (CostEngine, Bloque COST-01) — cubre
 * exactamente los 4 escenarios exigidos por el Bloque COST-02
 * (integracion con Ventas, `assertNoBelowCostSale` en
 * `modules/sales/service.ts`), que delega en `getEffectiveCost()` sin
 * reimplementar ninguna formula:
 *
 *  - Toggle apagado (`applyExpectedWasteToCost: false`).
 *  - Toggle encendido (`applyExpectedWasteToCost: true`).
 *  - Producto sin merma (`wastePercent: 0`).
 *  - Producto con merma (`wastePercent > 0`).
 *
 * Se prueba el motor directamente (funcion pura, sin Prisma, sin mocks
 * necesarios) en vez de forzar todo a traves de `sales/service.ts` — mismo
 * criterio ya usado en `tests/unit/promotionEngine.test.ts` para el Motor
 * de Reglas de Promociones: la correccion de la formula se prueba en el
 * unico lugar donde vive (el motor); `sales/service.ts` solo le pasa datos
 * y compara el resultado, sin logica propia que probar por separado.
 */
import { describe, expect, it } from 'vitest';
import { getEffectiveCost } from '@/shared/services/costEngine';
import type { CostContext } from '@/shared/services/costEngine';

function baseContext(overrides: Partial<CostContext> = {}): CostContext {
  return {
    averageCost: 1000,
    wastePercent: 0,
    applyExpectedWasteToCost: false,
    ...overrides,
  };
}

describe('CostEngine — toggle apagado (applyExpectedWasteToCost: false)', () => {
  it('devuelve el costo promedio sin ningun ajuste', () => {
    const result = getEffectiveCost(baseContext({ averageCost: 1000, wastePercent: 0 }));

    expect(result.effectiveCost).toBe(1000);
    expect(result.averageCost).toBe(1000);
    expect(result.adjustmentApplied).toBe(false);
    expect(result.adjustmentType).toBeNull();
  });

  it('ignora el porcentaje de merma aunque el producto tenga uno configurado', () => {
    // Compatibilidad total (requisito del bloque): un producto con
    // `wastePercent` configurado pero el toggle apagado debe comportarse
    // exactamente igual que uno sin merma configurada.
    const result = getEffectiveCost(baseContext({ averageCost: 1000, wastePercent: 30 }));

    expect(result.effectiveCost).toBe(1000);
    expect(result.adjustmentApplied).toBe(false);
  });

  it('nunca lanza, incluso con un wastePercent fuera de rango (dato historico invalido)', () => {
    // El toggle apagado es la garantia de compatibilidad: un producto con
    // datos de merma mal cargados, pero sin la regla activada, nunca debe
    // romper el flujo de venta.
    expect(() =>
      getEffectiveCost(baseContext({ averageCost: 1000, wastePercent: 150, applyExpectedWasteToCost: false })),
    ).not.toThrow();
  });
});

describe('CostEngine — toggle encendido, producto SIN merma esperada', () => {
  it('devuelve el costo promedio sin ajuste cuando wastePercent es 0', () => {
    const result = getEffectiveCost(
      baseContext({ averageCost: 1000, wastePercent: 0, applyExpectedWasteToCost: true }),
    );

    // 1000 / (1 - 0/100) = 1000 / 1 = 1000 — matematicamente equivalente a
    // "sin ajuste", pero `adjustmentApplied` SI es `true`: la regla se
    // evaluo y se aplico, solo que su resultado coincide con el costo
    // promedio para este caso particular.
    expect(result.effectiveCost).toBe(1000);
    expect(result.adjustmentApplied).toBe(true);
    expect(result.adjustmentType).toBe('PERCENTAGE_WASTE');
  });
});

describe('CostEngine — toggle encendido, producto CON merma esperada', () => {
  it('calcula el costo efectivo con la formula aprobada (Bloque YIELD-01 §1.2)', () => {
    const result = getEffectiveCost(
      baseContext({ averageCost: 1000, wastePercent: 20, applyExpectedWasteToCost: true }),
    );

    // effectiveCost = averageCost / (1 - wastePercent/100)
    //               = 1000 / (1 - 0.20) = 1000 / 0.8 = 1250
    expect(result.effectiveCost).toBe(1250);
    expect(result.averageCost).toBe(1000);
    expect(result.adjustmentApplied).toBe(true);
    expect(result.adjustmentType).toBe('PERCENTAGE_WASTE');
    expect(result.wastePercent).toBe(20);
  });

  it('el costo efectivo siempre es mayor al costo promedio cuando hay merma real', () => {
    const result = getEffectiveCost(
      baseContext({ averageCost: 500, wastePercent: 10, applyExpectedWasteToCost: true }),
    );

    expect(result.effectiveCost).toBeGreaterThan(result.averageCost);
  });

  it('rechaza wastePercent negativo (validacion backend exigida por el bloque)', () => {
    expect(() =>
      getEffectiveCost(baseContext({ averageCost: 1000, wastePercent: -5, applyExpectedWasteToCost: true })),
    ).toThrow();
  });

  it('rechaza wastePercent >= 100 (nunca permite division entre cero)', () => {
    expect(() =>
      getEffectiveCost(baseContext({ averageCost: 1000, wastePercent: 100, applyExpectedWasteToCost: true })),
    ).toThrow();

    expect(() =>
      getEffectiveCost(baseContext({ averageCost: 1000, wastePercent: 150, applyExpectedWasteToCost: true })),
    ).toThrow();
  });
});
