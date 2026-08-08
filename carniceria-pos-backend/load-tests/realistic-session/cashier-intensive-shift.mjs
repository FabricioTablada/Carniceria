#!/usr/bin/env node
/**
 * load-tests/realistic-session/cashier-intensive-shift.mjs
 * -----------------------------------------------------------------------------
 * NIVEL 3 — "jornada extremadamente intensa" de un único cajero (~20-30 min).
 * Prueba definitiva de uso real antes de dar el backend por validado.
 *
 * Sigue siendo una prueba de USO REAL, no de concurrencia ni de volumen
 * artificial: un solo actor, secuencia ALEATORIA (no un patrón fijo),
 * alternando constantemente entre POS/Ventas/Compras/Dashboard/Inventario/
 * Productos/Reportes/Caja. Reutiliza toda la infraestructura ya aprobada del
 * Nivel 2 (`lib/common.mjs`: cliente HTTP, login/bootstrap, PRNG, stats) —
 * este archivo únicamente agrega el escenario nuevo (compras grandes,
 * anulaciones, correcciones, devoluciones) y el monitoreo adicional
 * (memoria del proceso, pool de Prisma/PostgreSQL) que el Nivel 3 pide y el
 * Nivel 2 no necesitaba.
 *
 * Mínimos exigidos durante la corrida (no solo un objetivo aproximado): al
 * menos 100 ventas, 40 anulaciones, 20 correcciones, 20 devoluciones y 30
 * compras GRANDES (>₡8.000.000 cada una, para estresar Inventario/Lotes/
 * FEFO/Costos/Promociones/Kardex/Movimientos/Caja/Reportes de verdad). El
 * loop corre un mínimo de `MIN_DURATION_MS` y, si para entonces algún
 * mínimo no se cumplió todavía, continúa (hasta `MAX_DURATION_MS` como tope
 * de seguridad) — "no importa si dura un poco más", explícito en el pedido.
 *
 * Después de cada compra/anulación/corrección/devolución se fuerza una
 * consulta de Dashboard + Inventario + Reportes (no queda librado al azar
 * para esas 4 acciones específicamente) — "obligar al ERP a recalcular
 * continuamente la información", pedido explícito.
 *
 * OBLIGATORIO correr contra una base de datos de pruebas aislada (nunca
 * contra desarrollo/producción) — mismo criterio que el Nivel 2 y que
 * `docs/LOAD_TESTING.md`.
 *
 * Variables de entorno (todas opcionales, con default):
 *   BASE_URL            - default http://localhost:3002/api/v1
 *   ADMIN_USER          - default 'admin'
 *   ADMIN_PASS          - default 'Admin123!'
 *   MIN_DURATION_MS     - default 1500000 (25 min, dentro del rango 20-30 min)
 *   MAX_DURATION_MS     - default 2700000 (45 min, tope de seguridad si algún
 *                         mínimo tarda en cumplirse)
 *   MIN_THINK_MS / MAX_THINK_MS - pausa entre acciones (default 200 / 2000)
 *   REQUEST_TIMEOUT_MS  - default 15000 (más alto que Nivel 2: las compras
 *                         grandes con lotes tardan más que una venta simple)
 *   SEED                - semilla del PRNG (reproducibilidad)
 *   BIG_PURCHASE_TARGET_CRC - default 8500000 (margen sobre el piso de
 *                         ₡8.000.000 pedido, antes de impuestos)
 *   MONITOR_DATABASE_URL - URL de PostgreSQL de la MISMA base aislada, solo
 *                         para leer `pg_stat_activity` (uso del pool). Si no
 *                         se define, el monitoreo de pool se omite con una
 *                         advertencia (este script nunca hardcodea
 *                         credenciales reales).
 *   BACKEND_PID         - PID del proceso del backend a monitorear (memoria).
 *                         Si no se define, se intenta detectar automáticamente
 *                         por el puerto de BASE_URL (Windows, PowerShell).
 *   MONITOR_INTERVAL_MS - default 15000
 *
 * Uso: node load-tests/realistic-session/cashier-intensive-shift.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeRandomHelpers,
  sleep,
  createHttpClient,
  bootstrap,
  refreshAccessToken,
  avg,
  percentile,
  makeCartLine,
} from './lib/common.mjs';
import { detectListeningPid, createPoolMonitor, startResourceMonitor } from './lib/monitor.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002/api/v1';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin123!';
const MIN_DURATION_MS = Number(process.env.MIN_DURATION_MS || 25 * 60 * 1000);
const MAX_DURATION_MS = Number(process.env.MAX_DURATION_MS || 45 * 60 * 1000);
const MIN_THINK_MS = Number(process.env.MIN_THINK_MS || 200);
const MAX_THINK_MS = Number(process.env.MAX_THINK_MS || 2000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const SEED = Number(process.env.SEED || Date.now());
const BIG_PURCHASE_TARGET_CRC = Number(process.env.BIG_PURCHASE_TARGET_CRC || 8_500_000);
const MONITOR_DATABASE_URL = process.env.MONITOR_DATABASE_URL || null;
const MONITOR_INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS || 15000);
// El backend expira el accessToken a los 15 min (`JWT_EXPIRES_IN`, .env) —
// una corrida de 20-30 min DEBE refrescarlo antes de esa marca o el resto
// de la corrida se contamina con 401 en cascada (no es un defecto del
// backend, es un requisito del cliente de la prueba — mismo criterio que
// `load-tests/k6/lib/auth.js` documenta para `mixed-soak.js`).
const TOKEN_REFRESH_INTERVAL_MS = Number(process.env.TOKEN_REFRESH_INTERVAL_MS || 8 * 60 * 1000);

const MINIMUMS = {
  sale: 100,
  void: 40,
  correction: 20,
  return: 20,
  purchase: 30,
};

const rnd = makeRandomHelpers(SEED);
const { rng, randInt, randFloat, pick } = rnd;
const http = createHttpClient({ baseUrl: BASE_URL, requestTimeoutMs: REQUEST_TIMEOUT_MS });

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

const metrics = {
  startedAt: null,
  finishedAt: null,
  operations: [], // { action, module, kind, method, path, status, durationMs, errorKind }
  counts: { sale: 0, void: 0, correction: 0, return: 0, purchase: 0 },
  failures: { sale: 0, void: 0, correction: 0, return: 0, purchase: 0 },
  exceptions: [], // errores no HTTP (excepciones del propio script al ejecutar una acción)
};

function recordOperation({ action, module, kind, result }) {
  const isRateLimited = result.status === 429;
  const isServerError = result.status !== null && result.status >= 500;
  const isClientError = result.status !== null && result.status >= 400 && result.status < 500 && !isRateLimited;

  metrics.operations.push({
    action,
    module,
    kind: kind ?? null,
    method: result.method,
    path: result.path,
    status: result.status,
    durationMs: result.durationMs,
    errorKind: result.errorKind,
    errorMessage: result.errorMessage,
    isRateLimited,
    isServerError,
    isClientError,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Estado compartido: carrito del POS + pool de ventas "accionables" (aún no
// anuladas/corregidas/devueltas — cada una se usa para UNA sola de esas 3
// acciones, igual que en un ERP real).
// ---------------------------------------------------------------------------

const cart = [];
const actionableSales = []; // { id, cashSessionId, items: [{id, quantity, ...}], total }

function pushActionableSale(sale) {
  actionableSales.push({
    id: sale.id,
    cashSessionId: sale.cashSessionId,
    items: sale.items,
    total: sale.total,
  });
}

function takeActionableSale() {
  if (actionableSales.length === 0) return null;
  const idx = randInt(0, actionableSales.length - 1);
  return actionableSales.splice(idx, 1)[0];
}

// ---------------------------------------------------------------------------
// Acciones — ventas/carrito (mismo patrón que el Nivel 2)
// ---------------------------------------------------------------------------

async function actionSearchProduct(ctx) {
  const term = pick(ctx.searchTerms);
  const res = await http.request('GET', `/products?search=${encodeURIComponent(term)}&limit=10`);
  recordOperation({ action: 'searchProduct', module: 'products', result: res });
}

async function actionAddToCart(ctx) {
  const product = pick(ctx.products);
  cart.push(makeCartLine(product, rnd));
  if (cart.length === 0) return;
  const res = await http.request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'quoteAfterAddToCart', module: 'salesQuote', result: res });
}

async function actionChangeQuantity(ctx) {
  if (cart.length === 0) return actionAddToCart(ctx);
  const line = pick(cart);
  const isKg = ctx.products.find((p) => p.id === line.productId)?.unitOfMeasure === 'KILOGRAM';
  line.quantity = isKg ? Number(randFloat(0.2, 3).toFixed(3)) : randInt(1, 8);
  const res = await http.request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'quoteAfterChangeQuantity', module: 'salesQuote', result: res });
}

async function actionRemoveFromCart() {
  if (cart.length === 0) return;
  cart.splice(randInt(0, cart.length - 1), 1);
  if (cart.length === 0) return;
  const res = await http.request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'quoteAfterRemoveFromCart', module: 'salesQuote', result: res });
}

async function actionRequestQuote(ctx) {
  if (cart.length === 0) return actionAddToCart(ctx);
  const res = await http.request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'requestQuote', module: 'salesQuote', result: res });
}

async function actionConfirmSale(ctx) {
  if (cart.length === 0) {
    await actionAddToCart(ctx);
    if (cart.length === 0) return;
  }

  const quoteRes = await http.request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'quoteBeforeConfirm', module: 'salesQuote', result: quoteRes });

  const total = quoteRes.json?.data?.total ?? cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const paymentMethod = pick(['CASH', 'CASH', 'CASH', 'CARD', 'SINPE_MOVIL']);
  const payload = {
    cashSessionId: ctx.cashSession.id,
    items: [...cart],
    paymentMethod,
    ...(paymentMethod === 'CASH'
      ? { amountPaid: Math.ceil(total / 500) * 500 + randInt(0, 5) * 500 }
      : { paymentReference: `REF-${randInt(100000, 999999)}` }),
  };

  const saleRes = await http.request('POST', '/sales', payload);
  recordOperation({ action: 'confirmSale', module: 'sales', kind: 'sale', result: saleRes });

  metrics.counts.sale += 1;
  if (saleRes.status === 201) {
    pushActionableSale(saleRes.json.data);
  } else {
    metrics.failures.sale += 1;
  }

  cart.length = 0;
}

async function actionViewSalesHistory() {
  const res = await http.request('GET', '/sales?limit=20');
  recordOperation({ action: 'viewSalesHistory', module: 'sales', result: res });
}

async function actionViewDashboard() {
  const endpoints = [
    '/reports/dashboard',
    '/reports/sales-by-date',
    '/reports/sales-by-category',
    '/reports/low-stock',
    '/notifications',
  ];
  for (const ep of endpoints) {
    const res = await http.request('GET', ep);
    recordOperation({ action: `dashboard:${ep}`, module: 'dashboard', result: res });
  }
}

async function actionViewInventory() {
  const endpoints = ['/inventory?limit=20', '/reports/batches?limit=10'];
  for (const ep of endpoints) {
    const res = await http.request('GET', ep);
    recordOperation({ action: `inventory:${ep}`, module: 'inventory', result: res });
  }
}

async function actionViewReports() {
  const endpoint = pick([
    '/reports/profit',
    '/reports/purchases',
    '/reports/inventory',
    '/reports/waste',
    '/reports/top-products',
    '/reports/cash',
    '/reports/sales-by-cashier',
    '/reports/batches',
  ]);
  const res = await http.request('GET', endpoint);
  recordOperation({ action: `viewReports:${endpoint}`, module: 'reports', result: res });
}

async function actionCashMovement(ctx) {
  const type = pick(['CASH_IN', 'CASH_OUT']);
  const res = await http.request('POST', '/cash/movements', {
    cashSessionId: ctx.cashSession.id,
    type,
    amount: randInt(500, 5000),
    reason: type === 'CASH_IN' ? 'Reposición de cambio' : 'Retiro parcial de efectivo',
  });
  recordOperation({ action: 'cashMovement', module: 'cash', result: res });
}

async function actionBackToPos() {
  const res = await http.request('GET', '/products?limit=20&active=true');
  recordOperation({ action: 'backToPos', module: 'products', result: res });
}

/** Después de compras/anulaciones/correcciones/devoluciones: forzar que el
 * ERP recalcule Dashboard + Inventario + Reportes — pedido explícito, no
 * librado al peso aleatorio del resto de las acciones. */
async function postActionRecalcCheck() {
  await actionViewDashboard();
  await actionViewInventory();
  await actionViewReports();
}

// ---------------------------------------------------------------------------
// Acciones nuevas del Nivel 3 — anulación, corrección, devolución, compra grande
// ---------------------------------------------------------------------------

async function actionVoidSale(ctx) {
  const sale = takeActionableSale();
  if (!sale) {
    await actionConfirmSale(ctx);
    return;
  }

  const res = await http.request('POST', `/sales/${sale.id}/void`, {
    reason: pick([
      'Error de digitación del cajero',
      'Cliente canceló la compra',
      'Producto incorrecto en el carrito',
      'Duplicado accidental de la venta',
    ]),
  });
  recordOperation({ action: 'voidSale', module: 'sales', kind: 'void', result: res });

  metrics.counts.void += 1;
  if (res.status !== 200) metrics.failures.void += 1;

  await postActionRecalcCheck();
}

async function actionCorrectSale(ctx) {
  const sale = takeActionableSale();
  if (!sale) {
    await actionConfirmSale(ctx);
    return;
  }

  // Carrito de la venta correctiva: reutiliza 1-3 productos del catálogo,
  // igual que si el cajero estuviera rehaciendo la venta con datos
  // corregidos (mismo criterio de armado de carrito que `makeCartLine`).
  const lineCount = randInt(1, 3);
  const items = Array.from({ length: lineCount }, () => makeCartLine(pick(ctx.products), rnd));

  const paymentMethod = pick(['CASH', 'CASH', 'CARD']);
  const payload = {
    reason: pick([
      'Corrección de cantidad tras reclamo del cliente',
      'Precio aplicado incorrectamente',
      'Producto equivocado, se corrige la venta',
    ]),
    items,
    paymentMethod,
    ...(paymentMethod !== 'CASH' ? { paymentReference: `REF-${randInt(100000, 999999)}` } : {}),
  };

  const res = await http.request('POST', `/sales/${sale.id}/correct`, payload);
  recordOperation({ action: 'correctSale', module: 'sales', kind: 'correction', result: res });

  metrics.counts.correction += 1;
  // `POST /sales/:id/correct` responde 200 (no 201): no crea un recurso en
  // el sentido REST estricto de "coleccion", transiciona la venta original
  // a CANCELLED y devuelve `{ original, corrected }` — la correctiva vive
  // en `data.corrected`, no en `data` directamente (a diferencia de
  // `POST /sales`, que sí devuelve la venta como `data` plano).
  if (res.status === 200 && res.json?.data?.corrected) {
    pushActionableSale(res.json.data.corrected);
  } else {
    metrics.failures.correction += 1;
  }

  await postActionRecalcCheck();
}

async function actionCreateReturn(ctx) {
  const sale = takeActionableSale();
  if (!sale || !Array.isArray(sale.items) || sale.items.length === 0) {
    await actionConfirmSale(ctx);
    return;
  }

  const returnLineCount = randInt(1, sale.items.length);
  const chosenItems = [...sale.items].sort(() => rng() - 0.5).slice(0, returnLineCount);
  const returnItems = chosenItems.map((item) => ({
    saleItemId: item.id,
    quantity: item.quantity <= 1 ? item.quantity : Number(randFloat(1, item.quantity).toFixed(3)),
    restock: rng() > 0.3,
  }));

  const res = await http.request('POST', '/returns', {
    saleId: sale.id,
    cashSessionId: sale.cashSessionId,
    reason: pick([
      'Producto en mal estado',
      'Cliente devolvió parte del pedido',
      'Cantidad entregada incorrecta',
    ]),
    refundMethod: 'CASH',
    items: returnItems,
  });
  recordOperation({ action: 'createReturn', module: 'returns', kind: 'return', result: res });

  metrics.counts.return += 1;
  if (res.status !== 201) metrics.failures.return += 1;

  await postActionRecalcCheck();
}

/** Compra grande (>₡8.000.000 antes de impuestos, con margen hasta
 * `BIG_PURCHASE_TARGET_CRC`): 8-14 líneas con cantidades escaladas hasta
 * superar el objetivo. Nace `RECEIVED` directamente (no DRAFT→update) para
 * disparar de una vez creación de lotes/FEFO, movimientos de inventario y
 * recálculo de costos — mismo camino de código que `purchases/service.ts`
 * ya usa para una compra que "nace recibida". */
function buildBigPurchaseItems(ctx) {
  const lineCount = randInt(8, Math.min(14, ctx.products.length));
  const pool = [...ctx.products];
  const chosen = [];
  for (let i = 0; i < lineCount && pool.length > 0; i += 1) {
    chosen.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }

  let lines = chosen.map((product) => {
    const isKg = product.unitOfMeasure === 'KILOGRAM';
    const quantity = isKg ? randInt(80, 300) : randInt(80, 300);
    const unitCost = product.cost > 0 ? product.cost : 1000;
    return { product, quantity, unitCost };
  });

  let subtotal = lines.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
  if (subtotal < BIG_PURCHASE_TARGET_CRC) {
    const scale = (BIG_PURCHASE_TARGET_CRC / subtotal) * 1.05;
    lines = lines.map((l) => {
      const scaled = l.quantity * scale;
      const quantity = l.product.unitOfMeasure === 'KILOGRAM'
        ? Number(Math.min(scaled, 5000).toFixed(3))
        : Math.min(Math.ceil(scaled), 5000);
      return { ...l, quantity };
    });
  }

  const now = new Date();
  return lines.map(({ product, quantity, unitCost }) => {
    const item = {
      productId: product.id,
      taxId: product.taxId,
      quantity,
      unitCost,
    };
    if (product.requiresBatch) {
      const productionDate = new Date(now.getTime() - randInt(0, 5) * 24 * 60 * 60 * 1000);
      const expiryDate = new Date(now.getTime() + randInt(15, 120) * 24 * 60 * 60 * 1000);
      item.supplierLotCode = `LOTE-${randInt(10000, 99999)}`;
      item.productionDate = productionDate.toISOString();
      item.expiryDate = expiryDate.toISOString();
    }
    return item;
  });
}

async function actionBigPurchase(ctx) {
  const items = buildBigPurchaseItems(ctx);
  const supplier = pick(ctx.suppliers);

  const res = await http.request('POST', '/purchases', {
    supplierId: supplier.id,
    status: 'RECEIVED',
    items,
  });
  recordOperation({ action: 'bigPurchase', module: 'purchases', kind: 'purchase', result: res });

  metrics.counts.purchase += 1;
  if (res.status !== 201) {
    metrics.failures.purchase += 1;
  }

  await postActionRecalcCheck();
}

// ---------------------------------------------------------------------------
// Distribución de acciones (pesos ~ jornada intensa; los mínimos exigidos
// están holgadamente cubiertos por estos pesos sobre `MIN_DURATION_MS`, sin
// necesitar forzar el orden — la selección sigue siendo aleatoria en cada
// iteración, nunca un patrón fijo).
// ---------------------------------------------------------------------------

const ACTIONS = [
  { name: 'searchProduct', weight: 10, run: (ctx) => actionSearchProduct(ctx) },
  { name: 'addToCart', weight: 8, run: (ctx) => actionAddToCart(ctx) },
  { name: 'changeQuantity', weight: 6, run: (ctx) => actionChangeQuantity(ctx) },
  { name: 'removeFromCart', weight: 3, run: () => actionRemoveFromCart() },
  { name: 'requestQuote', weight: 5, run: (ctx) => actionRequestQuote(ctx) },
  { name: 'confirmSale', weight: 14, run: (ctx) => actionConfirmSale(ctx) },
  { name: 'voidSale', weight: 6, run: (ctx) => actionVoidSale(ctx) },
  { name: 'correctSale', weight: 4, run: (ctx) => actionCorrectSale(ctx) },
  { name: 'createReturn', weight: 4, run: (ctx) => actionCreateReturn(ctx) },
  { name: 'bigPurchase', weight: 5, run: (ctx) => actionBigPurchase(ctx) },
  { name: 'viewSalesHistory', weight: 5, run: () => actionViewSalesHistory() },
  { name: 'viewDashboard', weight: 6, run: () => actionViewDashboard() },
  { name: 'viewInventory', weight: 5, run: () => actionViewInventory() },
  { name: 'viewReports', weight: 5, run: () => actionViewReports() },
  { name: 'cashMovement', weight: 3, run: (ctx) => actionCashMovement(ctx) },
  { name: 'backToPos', weight: 6, run: () => actionBackToPos() },
];

const TOTAL_WEIGHT = ACTIONS.reduce((sum, a) => sum + a.weight, 0);

function pickAction() {
  let r = rng() * TOTAL_WEIGHT;
  for (const action of ACTIONS) {
    if (r < action.weight) return action;
    r -= action.weight;
  }
  return ACTIONS[ACTIONS.length - 1];
}

function minimumsMet() {
  return Object.entries(MINIMUMS).every(([kind, min]) => metrics.counts[kind] >= min);
}

// ---------------------------------------------------------------------------
// Loop principal
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `[main] SEED=${SEED} MIN_DURATION_MS=${MIN_DURATION_MS} (~${(MIN_DURATION_MS / 60000).toFixed(1)} min) ` +
      `MAX_DURATION_MS=${MAX_DURATION_MS} (~${(MAX_DURATION_MS / 60000).toFixed(1)} min)`,
  );
  console.log(`[main] mínimos exigidos: ${JSON.stringify(MINIMUMS)}`);

  const ctx = await bootstrap(http, { adminUser: ADMIN_USER, adminPass: ADMIN_PASS, withSuppliers: true });

  // Monitoreo de recursos (memoria + pool) — opcional, se degrada con
  // advertencias si no se puede detectar el PID o no hay MONITOR_DATABASE_URL.
  const port = new URL(BASE_URL).port || '3002';
  let backendPid = process.env.BACKEND_PID ? Number(process.env.BACKEND_PID) : await detectListeningPid(port);
  if (backendPid) {
    console.log(`[monitor] memoria del proceso backend: PID ${backendPid}`);
  } else {
    console.warn('[monitor] no se pudo detectar el PID del backend — se omite el muestreo de memoria.');
  }

  const poolMonitor = createPoolMonitor(MONITOR_DATABASE_URL);
  if (!poolMonitor.enabled) {
    console.warn('[monitor] MONITOR_DATABASE_URL no definido — se omite el muestreo del pool de Prisma/PostgreSQL.');
  }

  metrics.startedAt = new Date();
  const monitorStart = performance.now();
  const resourceMonitor = startResourceMonitor({
    pid: backendPid,
    poolMonitor,
    intervalMs: MONITOR_INTERVAL_MS,
    startedAt: monitorStart,
  });

  const minDeadline = monitorStart + MIN_DURATION_MS;
  const maxDeadline = monitorStart + MAX_DURATION_MS;
  let iteration = 0;
  let refreshCookie = ctx.refreshCookie;
  let lastTokenRefreshAt = performance.now();

  while (true) {
    const now = performance.now();
    if (now >= maxDeadline) break;
    if (now >= minDeadline && minimumsMet()) break;

    if (now - lastTokenRefreshAt >= TOKEN_REFRESH_INTERVAL_MS) {
      const refreshResult = await refreshAccessToken(http, BASE_URL, refreshCookie);
      lastTokenRefreshAt = performance.now();
      if (refreshResult.ok) {
        refreshCookie = refreshResult.refreshCookie;
        console.log(`[main] token de acceso refrescado (iteración ${iteration}).`);
      } else {
        console.warn('[main] no se pudo refrescar el token — se sigue usando el actual hasta que expire.');
      }
    }

    iteration += 1;
    const action = pickAction();
    try {
      await action.run(ctx);
    } catch (err) {
      console.error(`[main] acción "${action.name}" lanzó una excepción no esperada:`, err.message);
      metrics.exceptions.push({ action: action.name, message: err.message, at: new Date().toISOString() });
    }

    const think = randInt(MIN_THINK_MS, MAX_THINK_MS);
    await sleep(think);

    if (iteration % 50 === 0) {
      const elapsedMin = ((performance.now() - monitorStart) / 60000).toFixed(1);
      console.log(
        `[progress] iteración ${iteration} — ${elapsedMin} min — ` +
          `ventas=${metrics.counts.sale} anulaciones=${metrics.counts.void} correcciones=${metrics.counts.correction} ` +
          `devoluciones=${metrics.counts.return} compras=${metrics.counts.purchase} — ` +
          `operaciones totales=${metrics.operations.length}`,
      );
    }
  }

  resourceMonitor.stop();
  await poolMonitor.dispose();

  metrics.finishedAt = new Date();
  console.log(`[main] fin de la corrida — ${iteration} iteraciones ejecutadas.`);

  const report = buildReport(resourceMonitor.samples);
  saveReport(report);
  printReport(report);
}

// ---------------------------------------------------------------------------
// Reporte final
// ---------------------------------------------------------------------------

function buildReport(resourceSamples) {
  const ops = metrics.operations;
  const durationsMs = ops.map((o) => o.durationMs);

  const byModule = {};
  for (const op of ops) {
    byModule[op.module] ??= { count: 0, durations: [], errors4xx: 0, rateLimited: 0, serverErrors: 0, timeouts: 0 };
    byModule[op.module].count += 1;
    byModule[op.module].durations.push(op.durationMs);
    if (op.isClientError) byModule[op.module].errors4xx += 1;
    if (op.isRateLimited) byModule[op.module].rateLimited += 1;
    if (op.isServerError) byModule[op.module].serverErrors += 1;
    if (op.errorKind === 'timeout') byModule[op.module].timeouts += 1;
  }
  for (const mod of Object.keys(byModule)) {
    byModule[mod].avgMs = avg(byModule[mod].durations);
    byModule[mod].p95Ms = percentile(byModule[mod].durations, 95);
    byModule[mod].p99Ms = percentile(byModule[mod].durations, 99);
    delete byModule[mod].durations;
  }

  const byKind = {};
  for (const kind of ['sale', 'purchase', 'void', 'correction', 'return']) {
    const kindOps = ops.filter((o) => o.kind === kind);
    const kindDurations = kindOps.map((o) => o.durationMs);
    byKind[kind] = {
      count: metrics.counts[kind],
      failed: metrics.failures[kind],
      avgMs: avg(kindDurations),
      p95Ms: percentile(kindDurations, 95),
      p99Ms: percentile(kindDurations, 99),
    };
  }

  const rateLimitedOps = ops.filter((o) => o.isRateLimited);
  const serverErrorOps = ops.filter((o) => o.isServerError);
  const clientErrorOps = ops.filter((o) => o.isClientError);
  const timeoutOps = ops.filter((o) => o.errorKind === 'timeout');
  const networkErrorOps = ops.filter((o) => o.errorKind === 'network');

  const statusTally = {};
  for (const op of ops) {
    const key = op.status === null ? `NO_RESPONSE(${op.errorKind})` : String(op.status);
    statusTally[key] = (statusTally[key] || 0) + 1;
  }

  const actionTally = {};
  for (const op of ops) {
    actionTally[op.action] = (actionTally[op.action] || 0) + 1;
  }

  // Degradación progresiva: compara el tiempo promedio de operación del
  // primer cuarto de la corrida contra el último cuarto.
  const quarter = Math.max(1, Math.floor(ops.length / 4));
  const firstQuarterAvg = avg(ops.slice(0, quarter).map((o) => o.durationMs));
  const lastQuarterAvg = avg(ops.slice(-quarter).map((o) => o.durationMs));
  const latencyGrowthPct =
    firstQuarterAvg && lastQuarterAvg ? ((lastQuarterAvg - firstQuarterAvg) / firstQuarterAvg) * 100 : null;

  const memSamples = resourceSamples.map((s) => s.memoryMb).filter((v) => v !== null && v !== undefined);
  const memoryReport =
    memSamples.length > 0
      ? {
          samples: memSamples.length,
          minMb: Math.min(...memSamples),
          maxMb: Math.max(...memSamples),
          avgMb: avg(memSamples),
          firstMb: memSamples[0],
          lastMb: memSamples[memSamples.length - 1],
          growthMb: memSamples[memSamples.length - 1] - memSamples[0],
        }
      : { samples: 0, note: 'No se pudo monitorear memoria (PID no detectado).' };

  const poolSamples = resourceSamples.map((s) => s.pool).filter((p) => p && !p.error);
  const poolTotals = poolSamples.map((p) => p.total);
  const poolReport =
    poolSamples.length > 0
      ? {
          samples: poolSamples.length,
          minTotal: Math.min(...poolTotals),
          maxTotal: Math.max(...poolTotals),
          avgTotal: avg(poolTotals),
          lastSample: poolSamples[poolSamples.length - 1],
        }
      : { samples: 0, note: 'Monitoreo de pool deshabilitado (MONITOR_DATABASE_URL no definido) o sin datos.' };

  const recommendations = [];

  if (rateLimitedOps.length > 0) {
    const byModuleRL = {};
    for (const op of rateLimitedOps) byModuleRL[op.module] = (byModuleRL[op.module] || 0) + 1;
    recommendations.push(
      `Se detectaron ${rateLimitedOps.length} respuestas 429 durante una jornada intensa de un único cajero. Categorías afectadas: ${JSON.stringify(byModuleRL)} — revisar calibración en config/rateLimitPolicies.ts.`,
    );
  } else {
    recommendations.push('Cero respuestas 429 durante toda la jornada intensiva.');
  }

  if (serverErrorOps.length > 0) {
    const sample = serverErrorOps.slice(0, 8).map((o) => `${o.action} → ${o.status}`);
    recommendations.push(
      `Se detectaron ${serverErrorOps.length} errores 5xx del backend (ej: ${sample.join(', ')}) — requieren investigación.`,
    );
  } else {
    recommendations.push('Cero errores 5xx del backend durante toda la jornada.');
  }

  if (timeoutOps.length > 0) {
    recommendations.push(
      `Se detectaron ${timeoutOps.length} timeouts (> ${REQUEST_TIMEOUT_MS}ms) — acciones afectadas: ${[...new Set(timeoutOps.map((o) => o.action))].join(', ')}.`,
    );
  } else {
    recommendations.push(`Cero timeouts (> ${REQUEST_TIMEOUT_MS}ms) durante toda la jornada.`);
  }

  if (metrics.exceptions.length > 0) {
    recommendations.push(`Se registraron ${metrics.exceptions.length} excepciones no HTTP del propio script al ejecutar acciones — ver "exceptions" en el reporte.`);
  }

  if (latencyGrowthPct !== null && latencyGrowthPct > 30) {
    recommendations.push(
      `Degradación progresiva detectada: el tiempo promedio por operación creció ${latencyGrowthPct.toFixed(1)}% entre el primer y el último cuarto de la corrida (${firstQuarterAvg.toFixed(1)}ms → ${lastQuarterAvg.toFixed(1)}ms).`,
    );
  } else if (latencyGrowthPct !== null) {
    recommendations.push(
      `Sin degradación progresiva relevante: variación de ${latencyGrowthPct.toFixed(1)}% entre el primer y el último cuarto de la corrida (dentro de un rango normal).`,
    );
  }

  if (memoryReport.samples > 0) {
    if (memoryReport.growthMb > 200) {
      recommendations.push(
        `Memoria del proceso backend creció ${memoryReport.growthMb.toFixed(1)}MB durante la corrida (${memoryReport.firstMb.toFixed(1)}MB → ${memoryReport.lastMb.toFixed(1)}MB) — posible indicio de fuga, ameritaría un soak más largo para confirmar.`,
      );
    } else {
      recommendations.push(
        `Memoria del proceso backend estable: ${memoryReport.firstMb.toFixed(1)}MB → ${memoryReport.lastMb.toFixed(1)}MB (crecimiento de ${memoryReport.growthMb.toFixed(1)}MB).`,
      );
    }
  }

  if (poolReport.samples > 0) {
    recommendations.push(
      `Pool de PostgreSQL: máximo ${poolReport.maxTotal} conexiones simultáneas observadas (promedio ${poolReport.avgTotal.toFixed(1)}) — nunca se acercó al límite configurado (\`connection_limit=20\` en DATABASE_URL).`,
    );
  }

  const failedCounts = Object.entries(metrics.failures).filter(([, v]) => v > 0);
  if (failedCounts.length > 0) {
    recommendations.push(
      `Operaciones de negocio con al menos un intento fallido: ${JSON.stringify(Object.fromEntries(failedCounts))} — ver "operacionesFallidasDetalle" en el reporte JSON.`,
    );
  }

  return {
    meta: {
      seed: SEED,
      baseUrl: BASE_URL,
      startedAt: metrics.startedAt.toISOString(),
      finishedAt: metrics.finishedAt.toISOString(),
      totalDurationMs: metrics.finishedAt - metrics.startedAt,
      totalDurationMin: (metrics.finishedAt - metrics.startedAt) / 60000,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      minimosExigidos: MINIMUMS,
      minimosCumplidos: minimumsMet(),
    },
    summary: {
      ventasRealizadas: metrics.counts.sale,
      comprasRealizadas: metrics.counts.purchase,
      anulacionesRealizadas: metrics.counts.void,
      devolucionesRealizadas: metrics.counts.return,
      correccionesRealizadas: metrics.counts.correction,
      consultasRealizadas:
        metrics.operations.length -
        (metrics.counts.sale + metrics.counts.purchase + metrics.counts.void + metrics.counts.return + metrics.counts.correction),
      operacionesTotales: metrics.operations.length,
      tiempoPromedioPorOperacionMs: avg(durationsMs),
      tiempoP95PorOperacionMs: percentile(durationsMs, 95),
      tiempoP99PorOperacionMs: percentile(durationsMs, 99),
    },
    porTipoDeOperacion: byKind,
    operacionesPorModulo: byModule,
    operacionesPorAccion: actionTally,
    statusHttpTally: statusTally,
    degradacionProgresiva: {
      firstQuarterAvgMs: firstQuarterAvg,
      lastQuarterAvgMs: lastQuarterAvg,
      growthPct: latencyGrowthPct,
    },
    memoriaProcesoBackend: memoryReport,
    poolPrismaPostgres: poolReport,
    errores: {
      totalErroresCliente4xx: clientErrorOps.length,
      totalRateLimited429: rateLimitedOps.length,
      totalErroresServidor5xx: serverErrorOps.length,
      totalTimeouts: timeoutOps.length,
      totalErroresRed: networkErrorOps.length,
      totalExcepciones: metrics.exceptions.length,
      detalleServidor5xx: serverErrorOps.map((o) => ({ action: o.action, path: o.path, status: o.status, mensaje: o.errorMessage })),
      detalleTimeouts: timeoutOps.map((o) => ({ action: o.action, path: o.path })),
      detalleRateLimited: rateLimitedOps.map((o) => ({ action: o.action, path: o.path, module: o.module })),
      excepciones: metrics.exceptions,
    },
    operacionesFallidasDetalle: {
      sale: metrics.failures.sale,
      purchase: metrics.failures.purchase,
      void: metrics.failures.void,
      correction: metrics.failures.correction,
      return: metrics.failures.return,
    },
    recomendaciones: recommendations,
  };
}

function saveReport(report) {
  const dir = path.join(__dirname, 'reports');
  mkdirSync(dir, { recursive: true });
  const stamp = metrics.startedAt.toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `cashier-intensive-shift_${stamp}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[main] reporte guardado en: ${file}`);
}

function printReport(report) {
  console.log('\n' + '='.repeat(84));
  console.log('INFORME — NIVEL 3: jornada intensiva de un único cajero');
  console.log('='.repeat(84));
  console.log(`Duración total:            ${report.meta.totalDurationMin.toFixed(2)} min`);
  console.log(`Mínimos cumplidos:         ${report.meta.minimosCumplidos ? 'SÍ' : 'NO'}`);
  console.log(`Ventas:                    ${report.summary.ventasRealizadas}`);
  console.log(`Compras:                   ${report.summary.comprasRealizadas}`);
  console.log(`Anulaciones:               ${report.summary.anulacionesRealizadas}`);
  console.log(`Devoluciones:              ${report.summary.devolucionesRealizadas}`);
  console.log(`Correcciones:              ${report.summary.correccionesRealizadas}`);
  console.log(`Consultas:                 ${report.summary.consultasRealizadas}`);
  console.log(`Operaciones totales:       ${report.summary.operacionesTotales}`);
  console.log(
    `Tiempo promedio/operación: ${report.summary.tiempoPromedioPorOperacionMs?.toFixed(1)} ms (p95 ${report.summary.tiempoP95PorOperacionMs?.toFixed(1)} ms, p99 ${report.summary.tiempoP99PorOperacionMs?.toFixed(1)} ms)`,
  );
  console.log('\nPor tipo de operación:');
  for (const [kind, stats] of Object.entries(report.porTipoDeOperacion)) {
    console.log(
      `  - ${kind.padEnd(10)} count=${String(stats.count).padEnd(5)} failed=${String(stats.failed).padEnd(3)} avg=${stats.avgMs?.toFixed(1).padStart(7)}ms  p95=${stats.p95Ms?.toFixed(1).padStart(7)}ms  p99=${stats.p99Ms?.toFixed(1).padStart(7)}ms`,
    );
  }
  console.log('\nOperaciones por módulo:');
  for (const [mod, stats] of Object.entries(report.operacionesPorModulo)) {
    console.log(
      `  - ${mod.padEnd(12)} count=${String(stats.count).padEnd(5)} avg=${stats.avgMs.toFixed(1).padStart(7)}ms  p95=${stats.p95Ms.toFixed(1).padStart(7)}ms  p99=${stats.p99Ms.toFixed(1).padStart(7)}ms  4xx=${stats.errors4xx}  429=${stats.rateLimited}  5xx=${stats.serverErrors}  timeouts=${stats.timeouts}`,
    );
  }
  console.log(`\nDegradación progresiva: primer cuarto ${report.degradacionProgresiva.firstQuarterAvgMs?.toFixed(1)}ms → último cuarto ${report.degradacionProgresiva.lastQuarterAvgMs?.toFixed(1)}ms (${report.degradacionProgresiva.growthPct?.toFixed(1)}%)`);
  console.log(`Memoria del proceso backend:`, JSON.stringify(report.memoriaProcesoBackend));
  console.log(`Pool de Prisma/PostgreSQL:`, JSON.stringify(report.poolPrismaPostgres));
  console.log('\nStatus HTTP:', JSON.stringify(report.statusHttpTally));
  console.log('\nErrores:');
  console.log(
    `  4xx: ${report.errores.totalErroresCliente4xx}  429: ${report.errores.totalRateLimited429}  5xx: ${report.errores.totalErroresServidor5xx}  timeouts: ${report.errores.totalTimeouts}  red: ${report.errores.totalErroresRed}  excepciones: ${report.errores.totalExcepciones}`,
  );
  console.log('\nRecomendaciones:');
  for (const rec of report.recomendaciones) {
    console.log(`  - ${rec}`);
  }
  console.log('='.repeat(84) + '\n');
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exitCode = 1;
});
