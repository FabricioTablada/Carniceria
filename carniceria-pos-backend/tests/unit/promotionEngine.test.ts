/**
 * tests/unit/promotionEngine.test.ts
 * -----------------------------------------------------------------------------
 * Pruebas controladas del Motor de Reglas de Promociones (Bloque P.4) —
 * "el motor podra probarse unicamente mediante pruebas controladas" (sin
 * integracion al POS, sin endpoint, sin UI en este bloque). Cubre los 4
 * `scopeType` y los 4 `effectType` preparados, condiciones (activo,
 * fecha, hora, dia de semana, sucursal, cantidad minima) y resolucion de
 * prioridad/exclusividad/acumulacion.
 *
 * `crDate` construye un `Date` a partir de una hora LOCAL de Costa Rica
 * (UTC-6, sin horario de verano) — evita que las pruebas dependan de la
 * zona horaria de la maquina donde corren, mismo criterio que el propio
 * motor (`conditions.ts`, `America/Costa_Rica` explicito).
 */
import { describe, expect, it } from 'vitest';
import { evaluatePromotions } from '@/shared/services/promotionEngine';
import type { EngineCartLine, EnginePromotion } from '@/shared/services/promotionEngine';

const SUCURSAL_ID = 'sucursal-1';

function crDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute));
}

// 2026-01-07 es miercoles.
const WEDNESDAY_NOON = crDate(2026, 1, 7, 12, 0);

function basePromotion(overrides: Partial<EnginePromotion>): EnginePromotion {
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
    categoryIds: [],
    ...overrides,
  };
}

function line(overrides: Partial<EngineCartLine>): EngineCartLine {
  return {
    lineId: 'line-1',
    productId: 'product-1',
    categoryId: 'category-1',
    quantity: 1,
    unitPrice: 1000,
    ...overrides,
  };
}

describe('promotionEngine — carrito vacio', () => {
  it('no aplica nada si el carrito esta vacio', () => {
    const result = evaluatePromotions([], [basePromotion({})], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
    expect(result.totalDiscount).toBe(0);
  });
});

describe('promotionEngine — scopeType', () => {
  it('PRODUCT: aplica solo si el producto esta en el carrito', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      effectType: 'PERCENTAGE',
      effectValue: 10,
      products: [{ productId: 'product-1', requiredQuantity: null }],
    });
    const cart = [line({ lineId: 'l1', productId: 'product-1', quantity: 2, unitPrice: 1000 })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].amount).toBe(200); // 10% de 2000
    expect(result.appliedPromotions[0].affectedLineIds).toEqual(['l1']);
  });

  it('PRODUCT: no aplica si el producto no esta en el carrito', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      products: [{ productId: 'product-x', requiredQuantity: null }],
    });
    const cart = [line({ productId: 'product-1' })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
  });

  it('CATEGORY: aplica a todas las lineas de la categoria', () => {
    const promotion = basePromotion({
      scopeType: 'CATEGORY',
      effectType: 'FIXED_AMOUNT',
      effectValue: 300,
      categoryIds: ['bebidas'],
    });
    const cart = [
      line({ lineId: 'l1', productId: 'p1', categoryId: 'bebidas', quantity: 1, unitPrice: 1000 }),
      line({ lineId: 'l2', productId: 'p2', categoryId: 'carnes', quantity: 1, unitPrice: 5000 }),
    ];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].amount).toBe(300);
    expect(result.appliedPromotions[0].affectedLineIds).toEqual(['l1']);
  });

  it('CART: aplica sobre el total del carrito completo, sin lineas especificas', () => {
    const promotion = basePromotion({ scopeType: 'CART', effectType: 'PERCENTAGE', effectValue: 5 });
    const cart = [
      line({ lineId: 'l1', unitPrice: 1000, quantity: 1 }),
      line({ lineId: 'l2', productId: 'p2', unitPrice: 2000, quantity: 1 }),
    ];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].amount).toBe(150); // 5% de 3000
    expect(result.appliedPromotions[0].affectedLineIds).toBeNull();
  });

  it('COMBO: aplica solo si TODOS los productos requeridos estan en cantidad suficiente', () => {
    const promotion = basePromotion({
      scopeType: 'COMBO',
      effectType: 'SPECIAL_PRICE',
      effectValue: 5000,
      products: [
        { productId: 'chuleta', requiredQuantity: 2 },
        { productId: 'coca', requiredQuantity: 1 },
      ],
    });

    const completeCart = [
      line({ lineId: 'l1', productId: 'chuleta', quantity: 2, unitPrice: 2000 }),
      line({ lineId: 'l2', productId: 'coca', quantity: 1, unitPrice: 800 }),
    ];

    const complete = evaluatePromotions(completeCart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    // Total real: 2*2000 + 800 = 4800; precio especial 5000 -> sin descuento
    // real (el max(0, ...) evita un "descuento" negativo). Se ajusta el
    // effectValue para que si haya descuento real.
    expect(complete.appliedPromotions).toEqual([]);

    const promotionWithRealDiscount = basePromotion({
      ...promotion,
      effectValue: 4000,
    });
    const withDiscount = evaluatePromotions(completeCart, [promotionWithRealDiscount], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });
    expect(withDiscount.appliedPromotions).toHaveLength(1);
    expect(withDiscount.appliedPromotions[0].amount).toBe(800); // 4800 - 4000

    const partialCart = [line({ lineId: 'l1', productId: 'chuleta', quantity: 1, unitPrice: 2000 })];
    const partial = evaluatePromotions(partialCart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(partial.appliedPromotions).toEqual([]);
  });
});

describe('promotionEngine — effectType', () => {
  it('BUY_X_PAY_Y (2x1): descuenta las unidades "gratis" por grupo completo', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      effectType: 'BUY_X_PAY_Y',
      buyQuantity: 2,
      payQuantity: 1,
      products: [{ productId: 'coca', requiredQuantity: null }],
    });
    // 5 unidades -> 2 grupos completos de 2 (4 unidades), 1 unidad sobrante
    // sin descuento -> 2 unidades gratis.
    const cart = [line({ lineId: 'l1', productId: 'coca', quantity: 5, unitPrice: 800 })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].amount).toBe(1600); // 2 unidades gratis * 800
  });

  it('BUY_X_PAY_Y (3x2): no aplica si no se alcanza un grupo completo', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      effectType: 'BUY_X_PAY_Y',
      buyQuantity: 3,
      payQuantity: 2,
      products: [{ productId: 'coca', requiredQuantity: null }],
    });
    const cart = [line({ lineId: 'l1', productId: 'coca', quantity: 2, unitPrice: 800 })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
  });
});

// PROMO-13: precio fijo POR UNIDAD — a diferencia de SPECIAL_PRICE (precio
// TOTAL del conjunto de lineas), estas pruebas verifican explicitamente que
// el descuento escala con la cantidad/peso real de cada linea, y que un
// scope con productos distintos (CATEGORY) re-precia cada uno de forma
// independiente en vez de repartir un unico total combinado.
describe('promotionEngine — effectType FIXED_PRICE', () => {
  it('cantidad 1: el precio final queda exactamente en el precio fijo', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      effectType: 'FIXED_PRICE',
      effectValue: 2200,
      products: [{ productId: 'chuleta', requiredQuantity: null }],
    });
    const cart = [line({ lineId: 'l1', productId: 'chuleta', quantity: 1, unitPrice: 2500 })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].amount).toBe(300); // 2500 - 2200
  });

  it('peso variable (kg): el descuento escala con la cantidad, a diferencia de SPECIAL_PRICE', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      effectType: 'FIXED_PRICE',
      effectValue: 2200,
      products: [{ productId: 'chuleta', requiredQuantity: null }],
    });
    // 3.5 kg a ₡2.500/kg de lista -> con precio fijo de ₡2.200/kg, el
    // descuento debe ser 3.5 * (2500 - 2200) = 1050, NUNCA un valor fijo
    // independiente de la cantidad (ese seria el bug de SPECIAL_PRICE).
    const cart = [line({ lineId: 'l1', productId: 'chuleta', quantity: 3.5, unitPrice: 2500 })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].amount).toBe(1050);
  });

  it('CATEGORY con productos de precio distinto: cada linea se repreca de forma independiente', () => {
    const promotion = basePromotion({
      scopeType: 'CATEGORY',
      effectType: 'FIXED_PRICE',
      effectValue: 2000,
      categoryIds: ['carnes'],
    });
    const cart = [
      line({ lineId: 'l1', productId: 'chuleta', categoryId: 'carnes', quantity: 2, unitPrice: 2500 }),
      line({ lineId: 'l2', productId: 'costilla', categoryId: 'carnes', quantity: 1, unitPrice: 3000 }),
    ];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    // l1: 2 * (2500 - 2000) = 1000; l2: 1 * (3000 - 2000) = 1000 -> 2000 total.
    // (Si se hubiera reusado la formula de SPECIAL_PRICE, el resultado
    // habria sido sumLineTotal(8000) - 2000 = 6000, muy distinto).
    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].amount).toBe(2000);
  });

  it('precio fijo mayor o igual al precio de lista: no genera descuento negativo', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      effectType: 'FIXED_PRICE',
      effectValue: 3000,
      products: [{ productId: 'chuleta', requiredQuantity: null }],
    });
    const cart = [line({ lineId: 'l1', productId: 'chuleta', quantity: 2, unitPrice: 2500 })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
  });
});

describe('promotionEngine — condiciones', () => {
  it('no aplica si la promocion esta inactiva', () => {
    const promotion = basePromotion({ active: false });
    const result = evaluatePromotions([line({})], [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
  });

  it('no aplica fuera del rango de fechas de vigencia', () => {
    const promotion = basePromotion({
      startDate: crDate(2026, 2, 1, 0, 0),
      endDate: crDate(2026, 2, 28, 23, 59),
    });

    const result = evaluatePromotions([line({})], [promotion], {
      now: WEDNESDAY_NOON, // 2026-01-07, antes del rango
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
  });

  it('aplica dentro del rango de fechas de vigencia', () => {
    const promotion = basePromotion({
      startDate: crDate(2026, 1, 1, 0, 0),
      endDate: crDate(2026, 1, 31, 23, 59),
    });

    const result = evaluatePromotions([line({})], [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
  });

  it('no aplica fuera de la franja horaria configurada', () => {
    const promotion = basePromotion({ startTime: '18:00', endTime: '22:00' });

    const result = evaluatePromotions([line({})], [promotion], {
      now: WEDNESDAY_NOON, // 12:00, antes de la franja
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
  });

  it('aplica dentro de la franja horaria configurada', () => {
    const promotion = basePromotion({ startTime: '10:00', endTime: '14:00' });

    const result = evaluatePromotions([line({})], [promotion], {
      now: WEDNESDAY_NOON, // 12:00, dentro de la franja
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
  });

  it('no aplica en un dia de la semana no incluido', () => {
    const promotion = basePromotion({ daysOfWeek: ['SATURDAY', 'SUNDAY'] });

    const result = evaluatePromotions([line({})], [promotion], {
      now: WEDNESDAY_NOON, // miercoles
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
  });

  it('respeta sucursalId cuando esta especificado, e ignora la restriccion cuando es null', () => {
    const scoped = basePromotion({ sucursalId: 'otra-sucursal' });
    const global = basePromotion({ sucursalId: null });

    const context = { now: WEDNESDAY_NOON, sucursalId: SUCURSAL_ID };

    expect(evaluatePromotions([line({})], [scoped], context).appliedPromotions).toEqual([]);
    expect(evaluatePromotions([line({})], [global], context).appliedPromotions).toHaveLength(1);
  });

  it('no aplica si no se alcanza la cantidad minima', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      minQuantity: 5,
      products: [{ productId: 'product-1', requiredQuantity: null }],
    });
    const cart = [line({ productId: 'product-1', quantity: 3 })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toEqual([]);
  });

  it('aplica al alcanzar la cantidad minima', () => {
    const promotion = basePromotion({
      scopeType: 'PRODUCT',
      minQuantity: 5,
      products: [{ productId: 'product-1', requiredQuantity: null }],
    });
    const cart = [line({ productId: 'product-1', quantity: 5, unitPrice: 1000 })];

    const result = evaluatePromotions(cart, [promotion], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
  });
});

describe('promotionEngine — prioridad, exclusividad y acumulacion', () => {
  it('sin stackable: la promocion de mayor prioridad gana la misma linea, la otra se descarta', () => {
    const cart = [line({ lineId: 'l1', productId: 'p1', quantity: 1, unitPrice: 1000 })];
    const low = basePromotion({
      id: 'low',
      scopeType: 'PRODUCT',
      priority: 1,
      stackable: false,
      effectValue: 10,
      products: [{ productId: 'p1', requiredQuantity: null }],
    });
    const high = basePromotion({
      id: 'high',
      scopeType: 'PRODUCT',
      priority: 5,
      stackable: false,
      effectValue: 20,
      products: [{ productId: 'p1', requiredQuantity: null }],
    });

    const result = evaluatePromotions(cart, [low, high], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].promotionId).toBe('high');
    expect(result.appliedPromotions[0].amount).toBe(200); // 20% de 1000
  });

  it('stackable: ambas promociones se acumulan sobre la misma linea', () => {
    const cart = [line({ lineId: 'l1', productId: 'p1', quantity: 1, unitPrice: 1000 })];
    const first = basePromotion({
      id: 'first',
      scopeType: 'PRODUCT',
      priority: 5,
      stackable: true,
      effectValue: 10,
      products: [{ productId: 'p1', requiredQuantity: null }],
    });
    const second = basePromotion({
      id: 'second',
      scopeType: 'PRODUCT',
      priority: 1,
      stackable: true,
      effectValue: 5,
      products: [{ productId: 'p1', requiredQuantity: null }],
    });

    const result = evaluatePromotions(cart, [first, second], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(2);
    expect(result.totalDiscount).toBe(150); // 100 (10%) + 50 (5%)
  });

  it('exclusiveGroup: solo la de mayor prioridad del grupo aplica, aunque ambas sean stackable', () => {
    const cart = [line({ lineId: 'l1', productId: 'p1', quantity: 1, unitPrice: 1000 })];
    const first = basePromotion({
      id: 'first',
      scopeType: 'PRODUCT',
      priority: 5,
      stackable: true,
      exclusiveGroup: 'TEMPORADA',
      effectValue: 10,
      products: [{ productId: 'p1', requiredQuantity: null }],
    });
    const second = basePromotion({
      id: 'second',
      scopeType: 'PRODUCT',
      priority: 1,
      stackable: true,
      exclusiveGroup: 'TEMPORADA',
      effectValue: 30,
      products: [{ productId: 'p1', requiredQuantity: null }],
    });

    const result = evaluatePromotions(cart, [first, second], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(1);
    expect(result.appliedPromotions[0].promotionId).toBe('first');
  });

  it('sin stackable en lineas distintas: ambas aplican, no compiten entre si', () => {
    const cart = [
      line({ lineId: 'l1', productId: 'p1', quantity: 1, unitPrice: 1000 }),
      line({ lineId: 'l2', productId: 'p2', quantity: 1, unitPrice: 2000 }),
    ];
    const promoP1 = basePromotion({
      id: 'promo-p1',
      scopeType: 'PRODUCT',
      stackable: false,
      effectValue: 10,
      products: [{ productId: 'p1', requiredQuantity: null }],
    });
    const promoP2 = basePromotion({
      id: 'promo-p2',
      scopeType: 'PRODUCT',
      stackable: false,
      effectValue: 10,
      products: [{ productId: 'p2', requiredQuantity: null }],
    });

    const result = evaluatePromotions(cart, [promoP1, promoP2], {
      now: WEDNESDAY_NOON,
      sucursalId: SUCURSAL_ID,
    });

    expect(result.appliedPromotions).toHaveLength(2);
    expect(result.totalDiscount).toBe(300); // 100 + 200
  });
});
