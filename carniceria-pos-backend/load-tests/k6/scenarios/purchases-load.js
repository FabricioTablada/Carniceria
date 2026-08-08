/**
 * load-tests/k6/scenarios/purchases-load.js
 * -----------------------------------------------------------------------------
 * Escenario "compras grandes concurrentes" (Fase 15, Bloque D). A diferencia
 * de `sales-load.js`, las compras no dependen de una sesion de caja
 * (`Purchase` no tiene `cashSessionId` en el esquema) — se usa para validar
 * especificamente que la invalidacion granular de reportes (Bloque C) y la
 * transaccion batched (Bloque B) de `createPurchase` se comportan bien con
 * carritos deliberadamente grandes (hasta 30 lineas).
 *
 * Ejecutar:
 *   k6 run load-tests/k6/scenarios/purchases-load.js
 *   k6 run -e VUS=8 -e DURATION=3m load-tests/k6/scenarios/purchases-load.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { BASE_URL } from '../config.js'
import { loginAndBootstrap, authHeadersFor } from '../lib/auth.js'

const rateLimited429 = new Counter('rate_limited_429')
const purchaseDuration = new Trend('purchase_create_duration', true)

const VUS = Number(__ENV.VUS || 5)
const DURATION = __ENV.DURATION || '3m'

export const options = {
  scenarios: {
    purchases_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    rate_limited_429: ['count==0'],
    purchase_create_duration: ['p(95)<2500', 'p(99)<5000'],
  },
}

export function setup() {
  return loginAndBootstrap()
}

function randomPurchaseItems(ctx) {
  // Carritos deliberadamente grandes (hasta 30 lineas): es el caso que mas
  // ronda de escrituras secuenciales genera dentro de la transaccion
  // (recordMovements por linea), el escenario que motivo el Bloque B.
  const lineCount = 5 + Math.floor(Math.random() * 25)
  const items = []

  for (let i = 0; i < lineCount; i++) {
    items.push({
      productId: ctx.productId,
      taxId: ctx.taxId,
      quantity: 1 + Math.floor(Math.random() * 20),
      unitCost: ctx.productPrice * 0.6, // costo estimado, no el precio de venta
    })
  }

  return items
}

export default function (ctx) {
  if (!ctx.supplierId) {
    // Sin proveedor sembrado no se puede probar este escenario — falla
    // ruidoso a proposito en vez de silencioso.
    throw new Error('No hay proveedor disponible (revisa prisma/seed.ts).')
  }

  const payload = JSON.stringify({
    supplierId: ctx.supplierId,
    items: randomPurchaseItems(ctx),
  })

  const res = http.post(`${BASE_URL}/purchases`, payload, { headers: authHeadersFor(ctx) })

  purchaseDuration.add(res.timings.duration)

  if (res.status === 429) {
    rateLimited429.add(1)
  }

  check(res, {
    'purchase: 201': (r) => r.status === 201,
  })

  sleep(1 + Math.random() * 2)
}
