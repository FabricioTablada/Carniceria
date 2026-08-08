/**
 * tests/unit/promotionApplication.test.ts
 * -----------------------------------------------------------------------------
 * Pruebas controladas de `PromotionApplicationService` (Bloque P.5) — la
 * capa adaptadora entre el Motor de Reglas y el dominio de Ventas. Cubre
 * la traduccion de vocabulario en ambas direcciones (Ventas -> motor,
 * motor -> Ventas), el reparto proporcional de un descuento que afecta
 * varias lineas, y el manejo distinto de descuentos por linea vs. de
 * carrito completo en los totales recalculados.
 *
 * `@/modules/promotions/promotions.repository` se mockea: esta es una
 * prueba de la LOGICA DE TRADUCCION/AGREGACION de esta capa, no de
 * integracion con Postgres — mismo criterio ya usado en
 * `sales.void.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/promotions/promotions.repository', () => ({
  findActiveForEvaluation: vi.fn(),
}));

import * as promotionsRepository from '@/modules/promotions/promotions.repository';
import { evaluateSalePromotions } from '@/modules/promotions/promotionApplication.service';
import type { PromotionApplicationCartLine } from '@/modules/promotions/promotionApplication.types';

// 2026-01-07 12:00 hora de Costa Rica (UTC-6) es miercoles — fuera del
// alcance de cualquier condicion de fecha/hora/dia en estas promociones
// de prueba (ninguna las usa), pero fijo para que las pruebas sean
// deterministas sin depender de la fecha real de ejecucion.
const NOW = new Date(Date.UTC(2026, 0, 7, 18, 0));

function catalogPromotion(overrides: Record<string, unknown>) {
  return {
    id: 'promo-1',
    name: 'Promoción de prueba',
    scopeType: 'CART',
    effectType: 'PERCENTAGE',
    effectValue: 10,
    buyQuantity: null,
    payQuantity: null,
    minQuantity: null,
    startDate: null,
    endDate: null,
    startTime: null,
    endTime: null,
    daysOfWeek: [],
    priority: 0,
    stackable: false,
    exclusiveGroup: null,
    active: true,
    sucursalId: null,
    products: [],
    categories: [],
    ...overrides,
  };
}

function cartLine(overrides: Partial<PromotionApplicationCartLine>): PromotionApplicationCartLine {
  return {
    saleItemId: 'item-1',
    productId: 'product-1',
    categoryId: 'category-1',
    quantity: 1,
    unitPrice: 1000,
    lineSubtotal: 1000,
    taxRate: 13,
    ...overrides,
  };
}

describe('PromotionApplicationService — evaluateSalePromotions', () => {
  it('carrito vacio: no consulta el catalogo y devuelve un resultado vacio', async () => {
    const result = await evaluateSalePromotions([], { sucursalId: 'sucursal-1', now: NOW });

    expect(promotionsRepository.findActiveForEvaluation).not.toHaveBeenCalled();
    expect(result).toEqual({
      lines: [],
      appliedPromotions: [],
      totals: { subtotal: 0, taxTotal: 0, promotionDiscountTotal: 0, total: 0 },
    });
  });

  it('sin promociones activas: cada linea pasa sin cambios (descuento 0)', async () => {
    vi.mocked(promotionsRepository.findActiveForEvaluation).mockResolvedValue([] as never);

    const cart = [cartLine({ lineSubtotal: 1000, taxRate: 13 })];
    const result = await evaluateSalePromotions(cart, { sucursalId: 'sucursal-1', now: NOW });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toEqual({
      saleItemId: 'item-1',
      promotionDiscount: 0,
      adjustedLineSubtotal: 1000,
      adjustedLineTax: 130,
      adjustedLineTotal: 1130,
    });
    expect(result.appliedPromotions).toEqual([]);
    expect(result.totals).toEqual({
      subtotal: 1000,
      taxTotal: 130,
      promotionDiscountTotal: 0,
      total: 1130,
    });
  });

  it('promocion PRODUCT: descuenta la linea y recalcula impuesto sobre el subtotal ya ajustado', async () => {
    vi.mocked(promotionsRepository.findActiveForEvaluation).mockResolvedValue([
      catalogPromotion({
        scopeType: 'PRODUCT',
        effectType: 'PERCENTAGE',
        effectValue: 10,
        products: [{ productId: 'product-1', requiredQuantity: null }],
      }),
    ] as never);

    const cart = [cartLine({ saleItemId: 'item-1', lineSubtotal: 1000, taxRate: 13 })];
    const result = await evaluateSalePromotions(cart, { sucursalId: 'sucursal-1', now: NOW });

    expect(result.lines[0].promotionDiscount).toBe(100); // 10% de 1000
    expect(result.lines[0].adjustedLineSubtotal).toBe(900);
    expect(result.lines[0].adjustedLineTax).toBe(117); // 13% de 900
    expect(result.lines[0].adjustedLineTotal).toBe(1017);

    expect(result.appliedPromotions).toEqual([
      {
        saleItemId: 'item-1',
        promotionId: 'promo-1',
        promotionName: 'Promoción de prueba',
        effectType: 'PERCENTAGE',
        effectValue: 10,
        amountApplied: 100,
      },
    ]);

    expect(result.totals).toEqual({
      subtotal: 900,
      taxTotal: 117,
      promotionDiscountTotal: 100,
      total: 1017,
    });
  });

  it('promocion CATEGORY sobre dos lineas: reparte el descuento proporcional al subtotal de cada una', async () => {
    vi.mocked(promotionsRepository.findActiveForEvaluation).mockResolvedValue([
      catalogPromotion({
        scopeType: 'CATEGORY',
        effectType: 'FIXED_AMOUNT',
        effectValue: 300,
        categories: [{ categoryId: 'bebidas' }],
      }),
    ] as never);

    const cart = [
      cartLine({ saleItemId: 'l1', categoryId: 'bebidas', lineSubtotal: 3000, taxRate: 0 }),
      cartLine({ saleItemId: 'l2', categoryId: 'bebidas', lineSubtotal: 1000, taxRate: 0 }),
    ];
    const result = await evaluateSalePromotions(cart, { sucursalId: 'sucursal-1', now: NOW });

    // l1 pesa 3000/4000 = 75% del monto afectado -> 225; l2 pesa 25% -> 75.
    const l1 = result.lines.find((line) => line.saleItemId === 'l1')!;
    const l2 = result.lines.find((line) => line.saleItemId === 'l2')!;

    expect(l1.promotionDiscount).toBe(225);
    expect(l2.promotionDiscount).toBe(75);
    expect(l1.promotionDiscount + l2.promotionDiscount).toBe(300);
    expect(result.appliedPromotions).toHaveLength(2);
  });

  it('promocion CART: descuenta del total final, sin afectar subtotal/impuesto por linea', async () => {
    vi.mocked(promotionsRepository.findActiveForEvaluation).mockResolvedValue([
      catalogPromotion({ scopeType: 'CART', effectType: 'PERCENTAGE', effectValue: 5 }),
    ] as never);

    // El motor calcula PERCENTAGE sobre `unitPrice * quantity` (ver
    // `calculation.ts`, `sumLineTotal`) — se fija `unitPrice` igual a
    // `lineSubtotal` (quantity 1) para que ambos coincidan en este caso
    // sin descuento de linea previo.
    const cart = [
      cartLine({ saleItemId: 'l1', unitPrice: 1000, lineSubtotal: 1000, taxRate: 0 }),
      cartLine({ saleItemId: 'l2', unitPrice: 2000, lineSubtotal: 2000, taxRate: 0 }),
    ];
    const result = await evaluateSalePromotions(cart, { sucursalId: 'sucursal-1', now: NOW });

    // Ninguna linea individual queda afectada (scope CART, no linea a linea):
    // el subtotal ajustado de cada linea es identico al de entrada.
    expect(result.lines.every((line) => line.promotionDiscount === 0)).toBe(true);
    expect(result.lines.map((line) => line.adjustedLineSubtotal)).toEqual([1000, 2000]);

    expect(result.appliedPromotions).toEqual([
      {
        saleItemId: null,
        promotionId: 'promo-1',
        promotionName: 'Promoción de prueba',
        effectType: 'PERCENTAGE',
        effectValue: 5,
        amountApplied: 150, // 5% de 3000
      },
    ]);

    // subtotal/taxTotal sin cambios (nada se resto de las lineas); total SI
    // refleja el descuento de carrito, restado al final.
    expect(result.totals.subtotal).toBe(3000);
    expect(result.totals.taxTotal).toBe(0);
    expect(result.totals.promotionDiscountTotal).toBe(150);
    expect(result.totals.total).toBe(2850); // 3000 - 150
  });

  it('pasa la sucursal del contexto al repositorio', async () => {
    vi.mocked(promotionsRepository.findActiveForEvaluation).mockResolvedValue([] as never);

    await evaluateSalePromotions([cartLine({})], { sucursalId: 'sucursal-42', now: NOW });

    expect(promotionsRepository.findActiveForEvaluation).toHaveBeenCalledWith('sucursal-42');
  });
});
