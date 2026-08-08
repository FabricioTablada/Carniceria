/**
 * load-tests/k6/scenarios/mixed-soak.js
 * -----------------------------------------------------------------------------
 * Escenario "turno de 8 horas comprimido" (Fase 15, Bloque D) — el mas
 * importante de los cuatro: es el unico pensado para correr el tiempo
 * suficiente (30-60 min por defecto, configurable) como para revelar
 * degradacion progresiva (fugas de memoria/conexiones, crecimiento de
 * latencia con el tiempo) que un escenario corto no puede mostrar.
 *
 * Combina, en paralelo, tres tipos de trafico real simultaneos:
 *  - `sales`: ventas continuas contra la sesion de caja (como
 *    `sales-load.js`, a un ritmo mas moderado y sostenido).
 *  - `purchases`: compras ocasionales (menos frecuentes que las ventas,
 *    igual que en un dia real).
 *  - `reports_poll`: una o mas "pantallas de Dashboard" abiertas
 *    consultando reportes repetidamente — el patron EXACTO que en el
 *    diagnostico original de la Fase 15 amplificaba el trafico via
 *    invalidaciones amplias de React Query (Bloque C). Aqui se simula
 *    directamente contra la API (sin pasar por el navegador) para medir
 *    el volumen de requests que el backend recibe cuando esa pantalla
 *    esta abierta mientras ocurren ventas/compras.
 *
 * Como la duracion supera los 15 min de vida del accessToken
 * (`JWT_EXPIRES_IN`), cada VU refresca su propio token periodicamente via
 * `POST /auth/refresh` (ver `lib/auth.js`) en vez de volver a loguearse.
 *
 * Ejecutar (ejemplo, 45 minutos, representando un turno comprimido):
 *   k6 run -e DURATION=45m -e SALES_VUS=15 -e PURCHASES_VUS=3 -e REPORT_VUS=2 \
 *     load-tests/k6/scenarios/mixed-soak.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { BASE_URL } from '../config.js'
import { loginAndBootstrap, authHeadersFor, refreshAccessToken } from '../lib/auth.js'

const rateLimited429 = new Counter('rate_limited_429')
const saleDuration = new Trend('sale_create_duration', true)
const purchaseDuration = new Trend('purchase_create_duration', true)
const reportDuration = new Trend('report_fetch_duration', true)

const DURATION = __ENV.DURATION || '30m'
const SALES_VUS = Number(__ENV.SALES_VUS || 10)
const PURCHASES_VUS = Number(__ENV.PURCHASES_VUS || 2)
const REPORT_VUS = Number(__ENV.REPORT_VUS || 2)

const TOKEN_MAX_AGE_MS = 10 * 60 * 1000 // refresca antes de los 15 min de expiracion

export const options = {
  scenarios: {
    sales: {
      executor: 'constant-vus',
      vus: SALES_VUS,
      duration: DURATION,
      exec: 'sellSomething',
    },
    purchases: {
      executor: 'constant-vus',
      vus: PURCHASES_VUS,
      duration: DURATION,
      exec: 'buySomething',
    },
    reports_poll: {
      executor: 'constant-vus',
      vus: REPORT_VUS,
      duration: DURATION,
      exec: 'watchDashboard',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    rate_limited_429: ['count==0'],
    sale_create_duration: ['p(95)<2000'],
    purchase_create_duration: ['p(95)<3000'],
    report_fetch_duration: ['p(95)<1500'],
  },
}

export function setup() {
  return loginAndBootstrap()
}

// Cada VU mantiene su propia copia mutable del contexto (VUs no comparten
// estado de JS entre si en k6) para poder refrescar su token sin afectar a
// los demas.
let localCtx = null

function ensureFreshToken(ctx) {
  if (!localCtx) {
    localCtx = ctx
  }

  if (Date.now() - localCtx.tokenIssuedAt > TOKEN_MAX_AGE_MS) {
    localCtx = refreshAccessToken(localCtx)
  }

  return localCtx
}

export function sellSomething(ctx) {
  const current = ensureFreshToken(ctx)
  const lineCount = 1 + Math.floor(Math.random() * 6)
  const items = Array.from({ length: lineCount }, () => ({
    productId: current.productId,
    taxId: current.taxId,
    quantity: 1 + Math.floor(Math.random() * 3),
    unitPrice: current.productPrice,
  }))
  const totalPaid = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  const res = http.post(
    `${BASE_URL}/sales`,
    JSON.stringify({
      cashSessionId: current.cashSessionId,
      paymentMethod: 'CASH',
      amountPaid: totalPaid,
      items,
    }),
    { headers: authHeadersFor(current) },
  )

  saleDuration.add(res.timings.duration)
  if (res.status === 429) rateLimited429.add(1)
  check(res, { 'sale: 201': (r) => r.status === 201 })

  sleep(2 + Math.random() * 3) // ritmo de ventas mas espaciado que sales-load.js
}

export function buySomething(ctx) {
  const current = ensureFreshToken(ctx)
  if (!current.supplierId) return

  const lineCount = 3 + Math.floor(Math.random() * 15)
  const items = Array.from({ length: lineCount }, () => ({
    productId: current.productId,
    taxId: current.taxId,
    quantity: 1 + Math.floor(Math.random() * 10),
    unitCost: current.productPrice * 0.6,
  }))

  const res = http.post(
    `${BASE_URL}/purchases`,
    JSON.stringify({ supplierId: current.supplierId, items }),
    { headers: authHeadersFor(current) },
  )

  purchaseDuration.add(res.timings.duration)
  if (res.status === 429) rateLimited429.add(1)
  check(res, { 'purchase: 201': (r) => r.status === 201 })

  sleep(20 + Math.random() * 40) // las compras son mucho menos frecuentes que las ventas
}

export function watchDashboard(ctx) {
  const current = ensureFreshToken(ctx)
  const headers = authHeadersFor(current)

  // Mismo conjunto que el Dashboard real monta a la vez (useDashboard +
  // useSalesByCategory + useSalesByDate, ver diagnostico original de la
  // Fase 15) — reproduce esa pantalla abierta durante todo el escenario.
  const responses = http.batch([
    ['GET', `${BASE_URL}/reports/dashboard`, null, { headers }],
    ['GET', `${BASE_URL}/reports/sales-by-category`, null, { headers }],
    ['GET', `${BASE_URL}/reports/sales-by-date`, null, { headers }],
  ])

  for (const res of responses) {
    reportDuration.add(res.timings.duration)
    if (res.status === 429) rateLimited429.add(1)
  }
  check(responses[0], { 'dashboard: 200': (r) => r.status === 200 })

  sleep(5 + Math.random() * 5) // un manager refrescando la pantalla cada pocos segundos
}
