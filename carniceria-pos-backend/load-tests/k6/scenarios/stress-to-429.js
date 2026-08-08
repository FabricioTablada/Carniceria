/**
 * load-tests/k6/scenarios/stress-to-429.js
 * -----------------------------------------------------------------------------
 * Escenario "encontrar el techo" (Fase 15, Bloque D). A diferencia de los
 * otros tres (pensados para validar que el sistema SE MANTIENE estable bajo
 * una carga realista), este escenario sube la concurrencia deliberadamente
 * hasta que aparezcan 429/errores, para:
 *  1. Confirmar en que punto exacto el rate limiter empieza a actuar (y que
 *     lo hace de forma controlada, sin que el proceso completo deje de
 *     responder — la degradacion esperada es "429 con mensaje claro", no
 *     un cuelgue).
 *  2. Verificar que, una vez pasado el pico de carga (ultima etapa del
 *     ramp-down), el sistema se recupera solo (latencia y tasa de error
 *     vuelven a la normalidad) sin necesitar un reinicio manual — la
 *     pregunta central que motivo toda la Fase 15.
 *
 * A proposito NO tiene thresholds que hagan fallar el run por 429: se
 * espera que aparezcan. Lo que importa es leer manualmente el resumen al
 * final (ver docs/LOAD_TESTING.md, seccion de criterios de estabilidad).
 *
 * Ejecutar:
 *   k6 run load-tests/k6/scenarios/stress-to-429.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { BASE_URL } from '../config.js'
import { loginAndBootstrap, authHeadersFor } from '../lib/auth.js'

const rateLimited429 = new Counter('rate_limited_429')
const serverErrors5xx = new Counter('server_errors_5xx')
const requestDuration = new Trend('request_duration', true)

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 30 },
        { duration: '1m', target: 60 },
        { duration: '1m', target: 100 }, // punto donde se espera cruzar el limite del rate limiter
        { duration: '1m', target: 10 }, // recuperacion: debe volver a responder normal
        { duration: '30s', target: 0 },
      ],
    },
  },
  // Sin thresholds de error: este escenario existe precisamente para
  // observar donde aparecen. El unico threshold real es que NUNCA debe
  // haber 5xx (el rate limiter debe responder 429, controlado, nunca un
  // error de servidor / conexion agotada sin manejar).
  thresholds: {
    server_errors_5xx: ['count==0'],
  },
}

export function setup() {
  return loginAndBootstrap()
}

export default function (ctx) {
  const headers = authHeadersFor(ctx)
  const items = [
    { productId: ctx.productId, taxId: ctx.taxId, quantity: 1, unitPrice: ctx.productPrice },
  ]

  const res = http.post(
    `${BASE_URL}/sales`,
    JSON.stringify({
      cashSessionId: ctx.cashSessionId,
      paymentMethod: 'CASH',
      amountPaid: ctx.productPrice,
      items,
    }),
    { headers },
  )

  requestDuration.add(res.timings.duration)

  if (res.status === 429) {
    rateLimited429.add(1)
  } else if (res.status >= 500) {
    serverErrors5xx.add(1)
  }

  check(res, {
    'no 5xx': (r) => r.status < 500,
  })

  sleep(0.1) // deliberadamente agresivo: se busca saturar, no simular ritmo real
}
