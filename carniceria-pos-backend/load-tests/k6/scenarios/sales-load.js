/**
 * load-tests/k6/scenarios/sales-load.js
 * -----------------------------------------------------------------------------
 * Escenario "carga sostenida de ventas" (Fase 15, Bloque D).
 *
 * Objetivo: simular varias cajas POS creando ventas de forma continua y
 * concurrente contra la MISMA sesion de caja abierta, con carritos de
 * tamano variable (1 a 12 lineas, algunas repitiendo el mismo producto a
 * proposito — ejercita el camino de `recordMovements()` con lineas
 * duplicadas del Bloque B). Sirve para validar Bloques A y B bajo el tipo
 * de trafico que mas los estresa: transacciones de escritura concurrentes
 * sobre el pool de conexiones.
 *
 * Ejecutar:
 *   k6 run load-tests/k6/scenarios/sales-load.js
 *   k6 run -e BASE_URL=http://localhost:3000/api/v1 -e VUS=20 -e DURATION=5m load-tests/k6/scenarios/sales-load.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { BASE_URL } from '../config.js'
import { loginAndBootstrap, authHeadersFor } from '../lib/auth.js'

const rateLimited429 = new Counter('rate_limited_429')
const saleDuration = new Trend('sale_create_duration', true)

const VUS = Number(__ENV.VUS || 10)
const DURATION = __ENV.DURATION || '3m'

export const options = {
  scenarios: {
    sales_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS }, // ramp-up
        { duration: DURATION, target: VUS }, // carga sostenida
        { duration: '30s', target: 0 }, // ramp-down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Ver docs/LOAD_TESTING.md, seccion 5 (criterios de estabilidad) para
    // la justificacion de cada umbral.
    http_req_failed: ['rate<0.01'],
    rate_limited_429: ['count==0'],
    sale_create_duration: ['p(95)<1500', 'p(99)<3000'],
  },
}

export function setup() {
  return loginAndBootstrap()
}

function randomCartItems(ctx) {
  const lineCount = 1 + Math.floor(Math.random() * 12)
  const items = []

  for (let i = 0; i < lineCount; i++) {
    items.push({
      productId: ctx.productId,
      taxId: ctx.taxId,
      quantity: 1 + Math.floor(Math.random() * 3),
      unitPrice: ctx.productPrice,
    })
  }

  return items
}

export default function (ctx) {
  const items = randomCartItems(ctx)
  const totalPaid = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  const payload = JSON.stringify({
    cashSessionId: ctx.cashSessionId,
    paymentMethod: 'CASH',
    amountPaid: totalPaid,
    items,
  })

  const res = http.post(`${BASE_URL}/sales`, payload, { headers: authHeadersFor(ctx) })

  saleDuration.add(res.timings.duration)

  if (res.status === 429) {
    rateLimited429.add(1)
  }

  check(res, {
    'sale: 201': (r) => r.status === 201,
  })

  sleep(0.5 + Math.random()) // simula el ritmo de un cajero real, no una rafaga artificial
}
