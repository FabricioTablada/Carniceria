#!/usr/bin/env node
/**
 * load-tests/realistic-session/cashier-realistic-session.mjs
 * -----------------------------------------------------------------------------
 * Prueba de USO REAL (no de concurrencia, no de volumen masivo): simula un
 * único cajero operando el ERP durante ~10-15 minutos, con una secuencia
 * ALEATORIA y realista de acciones (búsqueda de productos, armar/editar
 * carrito, cotizar, confirmar venta, revisar historial, Dashboard, Reportes,
 * movimientos de caja, volver al POS) en vez de un patrón fijo repetido.
 *
 * Complementa (no reemplaza) los escenarios de `load-tests/k6/` — esos
 * atacan concurrencia/volumen (`sales-load.js`, `stress-to-429.js`,
 * `mixed-soak.js`); este script valida el patrón de tráfico de UN cajero
 * real a lo largo del tiempo, con un reporte detallado (tiempo promedio por
 * operación/por venta, errores HTTP, timeouts, hits del Rate Limiter,
 * errores 5xx del backend), no solo un resumen de throughput.
 *
 * OBLIGATORIO correr contra una base de datos de pruebas aislada (nunca
 * contra desarrollo/producción) — ver `docs/LOAD_TESTING.md`. Este script no
 * fuerza eso por código (igual que `load-tests/k6/`): es responsabilidad de
 * quien lo ejecuta apuntar `BASE_URL` a un backend ya levantado contra esa
 * base aislada.
 *
 * Variables de entorno (todas opcionales, con default):
 *   BASE_URL      - default http://localhost:3002/api/v1
 *   ADMIN_USER    - default 'admin'
 *   ADMIN_PASS    - default 'Admin123!' (= SEED_ADMIN_PASSWORD del .env)
 *   DURATION_MS   - default 720000 (12 min, dentro del rango pedido 10-15 min)
 *   MIN_THINK_MS / MAX_THINK_MS - pausa entre acciones (default 300 / 2500)
 *   REQUEST_TIMEOUT_MS - default 10000
 *   SEED          - semilla del generador pseudoaleatorio (reproducibilidad)
 *
 * Nota sobre alcance (no inventa funcionalidad que no existe): el ERP no
 * tiene módulo de clientes (`Cliente` siempre es "Público general" en el
 * POS, ver `CLAUDE.md` del frontend) — "buscar clientes" del pedido original
 * se omite deliberadamente, documentado en el informe final, en vez de
 * simular una llamada a un endpoint inexistente.
 *
 * Uso: node load-tests/realistic-session/cashier-realistic-session.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002/api/v1';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin123!';
const DURATION_MS = Number(process.env.DURATION_MS || 12 * 60 * 1000);
const MIN_THINK_MS = Number(process.env.MIN_THINK_MS || 300);
const MAX_THINK_MS = Number(process.env.MAX_THINK_MS || 2500);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 10000);
const SEED = Number(process.env.SEED || Date.now());

// PRNG determinístico (mulberry32) — permite repetir la misma secuencia de
// acciones con la misma SEED si hace falta reproducir un hallazgo puntual.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const randFloat = (min, max) => rng() * (max - min) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Cliente HTTP mínimo (fetch nativo de Node 24, sin dependencias nuevas)
// ---------------------------------------------------------------------------

let accessToken = null;

async function request(method, urlPath, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const start = performance.now();
  let status = null;
  let json = null;
  let errorKind = null; // 'timeout' | 'network' | null

  try {
    const res = await fetch(`${BASE_URL}${urlPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    status = res.status;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      errorKind = 'timeout';
    } else {
      errorKind = 'network';
    }
  } finally {
    clearTimeout(timer);
  }

  const durationMs = performance.now() - start;
  return { status, json, errorKind, durationMs, method, path: urlPath };
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

const metrics = {
  startedAt: null,
  finishedAt: null,
  operations: [], // { action, module, method, path, status, durationMs, errorKind, isRateLimited, isServerError }
  salesCompleted: 0,
  salesFailed: 0,
  cartLinesAdded: 0,
};

function recordOperation({ action, module, result }) {
  const isRateLimited = result.status === 429;
  const isServerError = result.status !== null && result.status >= 500;
  const isClientError = result.status !== null && result.status >= 400 && result.status < 500 && !isRateLimited;

  metrics.operations.push({
    action,
    module,
    method: result.method,
    path: result.path,
    status: result.status,
    durationMs: result.durationMs,
    errorKind: result.errorKind,
    isRateLimited,
    isServerError,
    isClientError,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Bootstrap: login, catálogo, caja
// ---------------------------------------------------------------------------

async function bootstrap() {
  console.log(`[bootstrap] BASE_URL=${BASE_URL}`);
  console.log(`[bootstrap] login como "${ADMIN_USER}"...`);

  const loginRes = await request('POST', '/auth/login', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });

  if (loginRes.status !== 200) {
    throw new Error(
      `Login falló (status ${loginRes.status}): ${JSON.stringify(loginRes.json)}. ` +
        `Verificá que BASE_URL apunte a un backend levantado contra la base de pruebas aislada.`,
    );
  }
  accessToken = loginRes.json.data.accessToken;
  const user = loginRes.json.data.user;
  console.log(`[bootstrap] login OK — usuario "${user.fullName}" (${user.role}).`);

  const sucursalId = JSON.parse(
    Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
  ).sucursalId;

  const productsRes = await request('GET', '/products?limit=40&active=true');
  const products = productsRes.json?.data?.items ?? productsRes.json?.data ?? [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No se encontraron productos activos — ¿corrió prisma/seed.ts contra esta base?');
  }
  console.log(`[bootstrap] catálogo cargado: ${products.length} productos.`);

  const cashRegistersRes = await request('GET', '/cash-registers?active=true&limit=5');
  const cashRegisters =
    cashRegistersRes.json?.data?.items ?? cashRegistersRes.json?.data ?? [];
  const cashRegister = cashRegisters[0];
  if (!cashRegister) {
    throw new Error('No se encontró ninguna caja registradora activa.');
  }

  let cashSession = null;
  const existingSessionsRes = await request(
    'GET',
    `/cash/sessions?cashRegisterId=${cashRegister.id}&status=OPEN&limit=1`,
  );
  const existingSessions =
    existingSessionsRes.json?.data?.items ?? existingSessionsRes.json?.data ?? [];
  if (existingSessions[0]) {
    cashSession = existingSessions[0];
    console.log(`[bootstrap] reutilizando sesión de caja ya abierta: ${cashSession.id}`);
  } else {
    const openRes = await request('POST', '/cash/sessions', {
      cashRegisterId: cashRegister.id,
      openingAmount: 50000,
    });
    if (openRes.status !== 201) {
      throw new Error(`No se pudo abrir sesión de caja (status ${openRes.status}): ${JSON.stringify(openRes.json)}`);
    }
    cashSession = openRes.json.data;
    console.log(`[bootstrap] sesión de caja abierta: ${cashSession.id}`);
  }

  const searchTerms = Array.from(
    new Set(
      products
        .map((p) => p.name?.split(' ')[0])
        .filter(Boolean)
        .concat(products.map((p) => p.sku).filter(Boolean)),
    ),
  );

  return { sucursalId, products, cashRegister, cashSession, searchTerms };
}

// ---------------------------------------------------------------------------
// Estado de carrito (en memoria, igual que el POS del frontend)
// ---------------------------------------------------------------------------

function makeCartLine(product) {
  const isKg = product.unitOfMeasure === 'KILOGRAM';
  return {
    productId: product.id,
    taxId: product.taxId ?? null,
    unitPrice: product.salePrice ?? product.price ?? 1000,
    quantity: isKg ? Number(randFloat(0.2, 3).toFixed(3)) : randInt(1, 5),
  };
}

// ---------------------------------------------------------------------------
// Acciones simuladas — cada una hace 1+ requests reales y se auto-registra
// ---------------------------------------------------------------------------

async function actionSearchProduct(ctx) {
  const term = pick(ctx.searchTerms);
  const res = await request('GET', `/products?search=${encodeURIComponent(term)}&limit=10`);
  recordOperation({ action: 'searchProduct', module: 'products', result: res });
}

async function actionAddToCart(ctx, cart) {
  const product = pick(ctx.products);
  cart.push(makeCartLine(product));
  metrics.cartLinesAdded += 1;
  if (cart.length === 0) return;
  const res = await request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'quoteAfterAddToCart', module: 'salesQuote', result: res });
}

async function actionChangeQuantity(ctx, cart) {
  if (cart.length === 0) return actionAddToCart(ctx, cart);
  const line = pick(cart);
  const isKg = ctx.products.find((p) => p.id === line.productId)?.unitOfMeasure === 'KILOGRAM';
  line.quantity = isKg ? Number(randFloat(0.2, 3).toFixed(3)) : randInt(1, 8);
  const res = await request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'quoteAfterChangeQuantity', module: 'salesQuote', result: res });
}

async function actionRemoveFromCart(ctx, cart) {
  if (cart.length === 0) return;
  cart.splice(randInt(0, cart.length - 1), 1);
  if (cart.length === 0) return;
  const res = await request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'quoteAfterRemoveFromCart', module: 'salesQuote', result: res });
}

async function actionRequestQuote(ctx, cart) {
  if (cart.length === 0) return actionAddToCart(ctx, cart);
  const res = await request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'requestQuote', module: 'salesQuote', result: res });
}

async function actionConfirmSale(ctx, cart) {
  if (cart.length === 0) {
    await actionAddToCart(ctx, cart);
    if (cart.length === 0) return;
  }

  const quoteRes = await request('POST', '/sales/quote', { items: cart });
  recordOperation({ action: 'quoteBeforeConfirm', module: 'salesQuote', result: quoteRes });

  const total = quoteRes.json?.data?.total ?? cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const paymentMethod = pick(['CASH', 'CASH', 'CASH', 'CARD', 'SINPE_MOVIL']);
  const payload = {
    cashSessionId: ctx.cashSession.id,
    items: cart,
    paymentMethod,
    ...(paymentMethod === 'CASH'
      ? { amountPaid: Math.ceil(total / 500) * 500 + randInt(0, 5) * 500 }
      : { paymentReference: `REF-${randInt(100000, 999999)}` }),
  };

  const saleRes = await request('POST', '/sales', payload);
  recordOperation({ action: 'confirmSale', module: 'sales', result: saleRes });

  if (saleRes.status === 201) {
    metrics.salesCompleted += 1;
  } else {
    metrics.salesFailed += 1;
  }

  cart.length = 0; // "volver al POS" — carrito vacío para la próxima venta
}

async function actionViewSalesHistory() {
  const res = await request('GET', '/sales?limit=20');
  recordOperation({ action: 'viewSalesHistory', module: 'sales', result: res });
}

async function actionViewDashboard() {
  // Réplica deliberada del patrón real documentado en la investigación del
  // 03/08/2026 (ver `docs/AUDIT_REPORT.md` sección 16.2): el Dashboard del
  // frontend dispara varias queries de golpe al montarse.
  const endpoints = [
    '/reports/dashboard',
    '/reports/sales-by-date',
    '/reports/sales-by-category',
    '/reports/low-stock',
    '/notifications',
  ];
  for (const ep of endpoints) {
    const res = await request('GET', ep);
    recordOperation({ action: `dashboard:${ep}`, module: 'dashboard', result: res });
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
  ]);
  const res = await request('GET', endpoint);
  recordOperation({ action: `viewReports:${endpoint}`, module: 'reports', result: res });
}

async function actionCashMovement(ctx) {
  const type = pick(['CASH_IN', 'CASH_OUT']);
  const res = await request('POST', '/cash/movements', {
    cashSessionId: ctx.cashSession.id,
    type,
    amount: randInt(500, 5000),
    reason: type === 'CASH_IN' ? 'Reposición de cambio' : 'Retiro parcial de efectivo',
  });
  recordOperation({ action: 'cashMovement', module: 'cash', result: res });
}

async function actionBackToPos(ctx) {
  // Vuelta al catálogo del POS — recarga la primera página, como haría el
  // frontend al desmontar/remontar `SalesPOSPage.tsx`.
  const res = await request('GET', '/products?limit=20&active=true');
  recordOperation({ action: 'backToPos', module: 'products', result: res });
}

// ---------------------------------------------------------------------------
// Distribución de acciones (pesos ~ frecuencia real de un cajero)
// ---------------------------------------------------------------------------

const ACTIONS = [
  { name: 'searchProduct', weight: 20, run: (ctx, cart) => actionSearchProduct(ctx) },
  { name: 'addToCart', weight: 18, run: (ctx, cart) => actionAddToCart(ctx, cart) },
  { name: 'changeQuantity', weight: 10, run: (ctx, cart) => actionChangeQuantity(ctx, cart) },
  { name: 'removeFromCart', weight: 4, run: (ctx, cart) => actionRemoveFromCart(ctx, cart) },
  { name: 'requestQuote', weight: 8, run: (ctx, cart) => actionRequestQuote(ctx, cart) },
  { name: 'confirmSale', weight: 10, run: (ctx, cart) => actionConfirmSale(ctx, cart) },
  { name: 'viewSalesHistory', weight: 6, run: () => actionViewSalesHistory() },
  { name: 'viewDashboard', weight: 8, run: () => actionViewDashboard() },
  { name: 'viewReports', weight: 6, run: () => actionViewReports() },
  { name: 'cashMovement', weight: 3, run: (ctx) => actionCashMovement(ctx) },
  { name: 'backToPos', weight: 7, run: (ctx) => actionBackToPos(ctx) },
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

// ---------------------------------------------------------------------------
// Loop principal
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[main] SEED=${SEED} DURATION_MS=${DURATION_MS} (~${(DURATION_MS / 60000).toFixed(1)} min)`);
  const ctx = await bootstrap();
  const cart = [];

  metrics.startedAt = new Date();
  const deadline = performance.now() + DURATION_MS;
  let iteration = 0;

  while (performance.now() < deadline) {
    iteration += 1;
    const action = pickAction();
    try {
      await action.run(ctx, cart);
    } catch (err) {
      console.error(`[main] acción "${action.name}" lanzó una excepción no esperada:`, err.message);
    }

    const think = randInt(MIN_THINK_MS, MAX_THINK_MS);
    await sleep(think);

    if (iteration % 25 === 0) {
      const elapsedMin = ((performance.now() - (deadline - DURATION_MS)) / 60000).toFixed(1);
      console.log(
        `[progress] iteración ${iteration} — ${elapsedMin} min transcurridos — ` +
          `${metrics.salesCompleted} ventas, ${metrics.operations.length} operaciones totales`,
      );
    }
  }

  metrics.finishedAt = new Date();
  console.log(`[main] duración cumplida — ${iteration} iteraciones ejecutadas.`);

  const report = buildReport(ctx);
  saveReport(report);
  printReport(report);
}

// ---------------------------------------------------------------------------
// Reporte final
// ---------------------------------------------------------------------------

function avg(nums) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function percentile(nums, p) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function buildReport(ctx) {
  const ops = metrics.operations;
  const durationsMs = ops.map((o) => o.durationMs);

  const byModule = {};
  for (const op of ops) {
    byModule[op.module] ??= { count: 0, durations: [], errors: 0, rateLimited: 0, serverErrors: 0, timeouts: 0 };
    byModule[op.module].count += 1;
    byModule[op.module].durations.push(op.durationMs);
    if (op.isClientError) byModule[op.module].errors += 1;
    if (op.isRateLimited) byModule[op.module].rateLimited += 1;
    if (op.isServerError) byModule[op.module].serverErrors += 1;
    if (op.errorKind === 'timeout') byModule[op.module].timeouts += 1;
  }
  for (const mod of Object.keys(byModule)) {
    byModule[mod].avgMs = avg(byModule[mod].durations);
    byModule[mod].p95Ms = percentile(byModule[mod].durations, 95);
    delete byModule[mod].durations;
  }

  const saleOps = ops.filter((o) => o.action === 'confirmSale');
  const saleDurations = saleOps.map((o) => o.durationMs);

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

  const recommendations = [];

  if (rateLimitedOps.length > 0) {
    const byModuleRL = {};
    for (const op of rateLimitedOps) byModuleRL[op.module] = (byModuleRL[op.module] || 0) + 1;
    recommendations.push(
      `Se detectaron ${rateLimitedOps.length} respuestas 429 (Rate Limiter) durante una sesión de un ` +
        `único cajero — no debería ocurrir bajo uso normal. Categorías afectadas: ${JSON.stringify(byModuleRL)}. ` +
        `Revisar la calibración de esas categorías en config/rateLimitPolicies.ts.`,
    );
  } else {
    recommendations.push(
      'Cero respuestas 429 durante toda la sesión — el Rate Limiter no interfirió con un patrón de uso real de un único cajero.',
    );
  }

  if (serverErrorOps.length > 0) {
    const sample = serverErrorOps.slice(0, 5).map((o) => `${o.action} → ${o.status}`);
    recommendations.push(
      `Se detectaron ${serverErrorOps.length} errores 5xx del backend (ej: ${sample.join(', ')}) — requieren investigación, no son un límite de tráfico legítimo.`,
    );
  } else {
    recommendations.push('Cero errores 5xx del backend durante toda la sesión.');
  }

  if (timeoutOps.length > 0) {
    recommendations.push(
      `Se detectaron ${timeoutOps.length} timeouts (> ${REQUEST_TIMEOUT_MS}ms sin respuesta) — posible indicio de contención (pool de conexiones, transacción larga). Acciones afectadas: ${[...new Set(timeoutOps.map((o) => o.action))].join(', ')}.`,
    );
  } else {
    recommendations.push(`Cero timeouts (> ${REQUEST_TIMEOUT_MS}ms) durante toda la sesión.`);
  }

  const slowestModule = Object.entries(byModule).sort((a, b) => (b[1].avgMs ?? 0) - (a[1].avgMs ?? 0))[0];
  if (slowestModule && slowestModule[1].avgMs > 500) {
    recommendations.push(
      `El módulo "${slowestModule[0]}" tuvo el mayor tiempo promedio por operación (${slowestModule[1].avgMs.toFixed(0)}ms, p95 ${slowestModule[1].p95Ms.toFixed(0)}ms) — posible cuello de botella a revisar si se repite en corridas futuras.`,
    );
  }

  if (metrics.salesFailed > 0) {
    recommendations.push(
      `${metrics.salesFailed} de ${metrics.salesCompleted + metrics.salesFailed} intentos de venta fallaron — revisar los detalles en "operaciones fallidas" del reporte JSON.`,
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
    },
    summary: {
      ventasRealizadas: metrics.salesCompleted,
      ventasFallidas: metrics.salesFailed,
      consultasRealizadas: metrics.operations.length - saleOps.length,
      operacionesTotales: metrics.operations.length,
      tiempoPromedioPorOperacionMs: avg(durationsMs),
      tiempoP95PorOperacionMs: percentile(durationsMs, 95),
      tiempoPromedioPorVentaMs: avg(saleDurations),
      tiempoP95PorVentaMs: percentile(saleDurations, 95),
    },
    operacionesPorModulo: byModule,
    operacionesPorAccion: actionTally,
    statusHttpTally: statusTally,
    errores: {
      totalErroresCliente4xx: clientErrorOps.length,
      totalRateLimited429: rateLimitedOps.length,
      totalErroresServidor5xx: serverErrorOps.length,
      totalTimeouts: timeoutOps.length,
      totalErroresRed: networkErrorOps.length,
      detalleServidor5xx: serverErrorOps.map((o) => ({ action: o.action, path: o.path, status: o.status })),
      detalleTimeouts: timeoutOps.map((o) => ({ action: o.action, path: o.path })),
      detalleRateLimited: rateLimitedOps.map((o) => ({ action: o.action, path: o.path, module: o.module })),
    },
    recomendaciones: recommendations,
  };
}

function saveReport(report) {
  const dir = path.join(__dirname, 'reports');
  mkdirSync(dir, { recursive: true });
  const stamp = metrics.startedAt.toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `cashier-realistic-session_${stamp}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[main] reporte guardado en: ${file}`);
}

function printReport(report) {
  console.log('\n' + '='.repeat(78));
  console.log('INFORME — Prueba de uso real del ERP (sesión de cajero simulada)');
  console.log('='.repeat(78));
  console.log(`Duración total:            ${report.meta.totalDurationMin.toFixed(2)} min`);
  console.log(`Ventas realizadas:         ${report.summary.ventasRealizadas}`);
  console.log(`Ventas fallidas:           ${report.summary.ventasFallidas}`);
  console.log(`Consultas realizadas:      ${report.summary.consultasRealizadas}`);
  console.log(`Operaciones totales:       ${report.summary.operacionesTotales}`);
  console.log(`Tiempo promedio/operación: ${report.summary.tiempoPromedioPorOperacionMs?.toFixed(1)} ms (p95 ${report.summary.tiempoP95PorOperacionMs?.toFixed(1)} ms)`);
  console.log(`Tiempo promedio/venta:     ${report.summary.tiempoPromedioPorVentaMs?.toFixed(1)} ms (p95 ${report.summary.tiempoP95PorVentaMs?.toFixed(1)} ms)`);
  console.log('\nOperaciones por módulo:');
  for (const [mod, stats] of Object.entries(report.operacionesPorModulo)) {
    console.log(
      `  - ${mod.padEnd(14)} count=${String(stats.count).padEnd(5)} avg=${stats.avgMs.toFixed(1).padStart(7)}ms  p95=${stats.p95Ms.toFixed(1).padStart(7)}ms  errores4xx=${stats.errors}  429=${stats.rateLimited}  5xx=${stats.serverErrors}  timeouts=${stats.timeouts}`,
    );
  }
  console.log('\nStatus HTTP:', JSON.stringify(report.statusHttpTally));
  console.log('\nErrores:');
  console.log(`  4xx: ${report.errores.totalErroresCliente4xx}  429: ${report.errores.totalRateLimited429}  5xx: ${report.errores.totalErroresServidor5xx}  timeouts: ${report.errores.totalTimeouts}  red: ${report.errores.totalErroresRed}`);
  console.log('\nRecomendaciones:');
  for (const rec of report.recomendaciones) {
    console.log(`  - ${rec}`);
  }
  console.log('='.repeat(78) + '\n');
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exitCode = 1;
});
