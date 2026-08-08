/**
 * load-tests/k6/scenarios/smoke.js
 * -----------------------------------------------------------------------------
 * Prueba de humo (Fase 15, Bloque D): 1 VU, pocas iteraciones. Objetivo
 * unico: confirmar que el entorno de prueba esta bien configurado (login
 * funciona, hay producto/proveedor/caja sembrados, la API responde) ANTES
 * de correr cualquiera de los escenarios de carga real. Correr esto primero
 * siempre.
 *
 * Ejecutar:
 *   k6 run load-tests/k6/scenarios/smoke.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL } from '../config.js'
import { loginAndBootstrap, authHeadersFor } from '../lib/auth.js'

export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    http_req_failed: ['rate==0'],
  },
}

export function setup() {
  return loginAndBootstrap()
}

export default function (ctx) {
  const headers = authHeadersFor(ctx)

  const saleRes = http.post(
    `${BASE_URL}/sales`,
    JSON.stringify({
      cashSessionId: ctx.cashSessionId,
      paymentMethod: 'CASH',
      amountPaid: ctx.productPrice,
      items: [{ productId: ctx.productId, taxId: ctx.taxId, quantity: 1, unitPrice: ctx.productPrice }],
    }),
    { headers },
  )
  check(saleRes, { 'sale: 201': (r) => r.status === 201 })

  const dashboardRes = http.get(`${BASE_URL}/reports/dashboard`, { headers })
  check(dashboardRes, { 'dashboard: 200': (r) => r.status === 200 })

  sleep(1)
}
