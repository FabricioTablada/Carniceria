/**
 * load-tests/k6/scenarios/cashier-workday.js
 * -----------------------------------------------------------------------------
 * Escenario FUNCIONAL (Fase 15, Bloque D — agregado a pedido antes de
 * ejecutar las pruebas): a diferencia de los demas escenarios (pensados
 * para generar volumen/concurrencia), este simula el flujo de trabajo
 * COMPLETO y en orden de un unico cajero durante una jornada real:
 *
 *   1. Apertura de caja
 *   2. Ventas (varias, tamano de carrito variable)
 *   3. Compras (reposicion de mercaderia)
 *   4. Devoluciones (contra ventas ya registradas en este mismo turno)
 *   5. Ajuste manual de inventario
 *   6. Merma
 *   7. Consulta de reportes (dashboard, ventas, bajo stock, caja) — lo que
 *      un cajero/encargado revisaria antes de cuadrar caja
 *   8. Cierre de caja
 *
 * No es un escenario de estres: `VUS=1` por defecto y sin `sleep`
 * artificialmente cortos entre pasos — el objetivo es CORRECCION FUNCIONAL
 * de punta a punta bajo los Bloques A/B/C ya aplicados, no volumen. Sirve
 * ademas como humo mas completo que `smoke.js` (ese solo prueba una venta
 * y el dashboard; este ejercita los ocho pasos de un turno real).
 *
 * LIMITE CONOCIDO: solo hay UNA caja registradora sembrada por defecto
 * (`prisma/seed.ts`, "Caja Principal") y una `CashSession` no puede tener
 * mas de una sesion ABIERTA a la vez para la misma caja (indice unico
 * parcial en `schema.prisma`). Por eso este escenario corre con `VUS=1`
 * por defecto: cada iteracion (turno) abre y CIERRA su sesion antes de que
 * la siguiente iteracion abra la suya. Correr con mas de 1 VU en paralelo
 * requiere sembrar cajas registradoras adicionales (fuera de alcance de
 * este bloque, que no modifica seeds de produccion) — con `VUS=1` e
 * `ITERATIONS>1` SI se puede validar varios turnos consecutivos.
 *
 * Ejecutar:
 *   k6 run load-tests/k6/scenarios/cashier-workday.js
 *   k6 run -e ITERATIONS=5 load-tests/k6/scenarios/cashier-workday.js   # 5 turnos consecutivos
 */
import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { BASE_URL } from '../config.js'
import {
  loginAndBootstrap,
  authHeadersFor,
  openCashSession,
  closeCashSession,
} from '../lib/auth.js'

const rateLimited429 = new Counter('rate_limited_429')
const workdayDuration = new Trend('cashier_workday_duration', true)
// Declaradas en el ambito de modulo (init context) — k6 exige que las
// metricas custom se creen aqui, nunca dentro de la funcion default/exec.
const saleDuration = new Trend('workday_sale_duration', true)
const purchaseDuration = new Trend('workday_purchase_duration', true)
const returnDuration = new Trend('workday_return_duration', true)

const VUS = Number(__ENV.VUS || 1)
const ITERATIONS = Number(__ENV.ITERATIONS || 1)
const SALES_PER_SHIFT = Number(__ENV.SALES_PER_SHIFT || 20)
const PURCHASES_PER_SHIFT = Number(__ENV.PURCHASES_PER_SHIFT || 3)
const RETURNS_PER_SHIFT = Number(__ENV.RETURNS_PER_SHIFT || 4)

export const options = {
  scenarios: {
    cashier_workday: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: ITERATIONS,
      maxDuration: '30m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    rate_limited_429: ['count==0'],
  },
}

export function setup() {
  // `openSession: false`: este escenario controla el ciclo de vida completo
  // de su propia sesion de caja (abre al inicio de cada turno, cierra al
  // final) — ver comentario de `loginAndBootstrap()` en lib/auth.js.
  return loginAndBootstrap({ openSession: false })
}

function track(res, trendMetric) {
  trendMetric.add(res.timings.duration)
  if (res.status === 429) rateLimited429.add(1)
  return res
}

export default function (ctx) {
  const shiftStart = Date.now()
  const headers = authHeadersFor(ctx)

  let cashCollected = 0

  group('1. Apertura de caja', () => {
    const openingAmount = 50000
    const session = openCashSession(ctx, openingAmount)
    ctx.cashSessionId = session.id
    cashCollected = openingAmount
  })

  const createdSales = []

  group('2. Ventas', () => {
    for (let i = 0; i < SALES_PER_SHIFT; i++) {
      const lineCount = 1 + Math.floor(Math.random() * 6)
      const items = Array.from({ length: lineCount }, () => ({
        productId: ctx.productId,
        taxId: ctx.taxId,
        quantity: 1 + Math.floor(Math.random() * 3),
        unitPrice: ctx.productPrice,
      }))
      const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      const paymentMethod = Math.random() < 0.7 ? 'CASH' : 'CARD'

      const payload = {
        cashSessionId: ctx.cashSessionId,
        paymentMethod,
        amountPaid: total,
        items,
      }
      if (paymentMethod === 'CARD') {
        payload.paymentReference = `VOUCHER-${i}-${Date.now()}`
      }

      const res = track(
        http.post(`${BASE_URL}/sales`, JSON.stringify(payload), { headers }),
        saleDuration,
      )

      if (check(res, { 'sale: 201': (r) => r.status === 201 })) {
        const sale = res.json('data')
        createdSales.push(sale)
        if (paymentMethod === 'CASH') cashCollected += total
      }

      sleep(0.2 + Math.random() * 0.5)
    }
  })

  group('3. Compras (reposicion)', () => {
    if (!ctx.supplierId) return // sin proveedor sembrado, se omite (ver auth.js)

    for (let i = 0; i < PURCHASES_PER_SHIFT; i++) {
      const lineCount = 3 + Math.floor(Math.random() * 10)
      const items = Array.from({ length: lineCount }, () => ({
        productId: ctx.productId,
        taxId: ctx.taxId,
        quantity: 5 + Math.floor(Math.random() * 20),
        unitCost: ctx.productPrice * 0.6,
      }))

      const res = track(
        http.post(
          `${BASE_URL}/purchases`,
          JSON.stringify({ supplierId: ctx.supplierId, items }),
          { headers },
        ),
        purchaseDuration,
      )
      check(res, { 'purchase: 201': (r) => r.status === 201 })

      sleep(0.5 + Math.random())
    }
  })

  group('4. Devoluciones', () => {
    const returnCount = Math.min(RETURNS_PER_SHIFT, createdSales.length)

    for (let i = 0; i < returnCount; i++) {
      const sale = createdSales[i]
      const firstItem = sale.items?.[0]
      if (!firstItem) continue

      const returnQuantity = Math.max(1, Math.floor(firstItem.quantity / 2))

      const res = track(
        http.post(
          `${BASE_URL}/returns`,
          JSON.stringify({
            saleId: sale.id,
            cashSessionId: ctx.cashSessionId,
            refundMethod: sale.paymentMethod === 'CARD' ? 'CARD' : 'CASH',
            reason: 'Cliente devolvio parte del pedido (prueba funcional de carga)',
            items: [{ saleItemId: firstItem.id, quantity: returnQuantity, restock: true }],
          }),
          { headers },
        ),
        returnDuration,
      )

      if (check(res, { 'return: 201': (r) => r.status === 201 }) && sale.paymentMethod !== 'CARD') {
        cashCollected -= returnQuantity * firstItem.unitPrice
      }

      sleep(0.3)
    }
  })

  group('5. Ajuste manual de inventario', () => {
    if (!ctx.inventoryId) return // sin fila de Inventory resuelta (ver auth.js)

    const res = http.patch(
      `${BASE_URL}/inventory/${ctx.inventoryId}`,
      JSON.stringify({ reorderPoint: 10 + Math.floor(Math.random() * 10) }),
      { headers },
    )
    check(res, { 'inventory adjust: 200': (r) => r.status === 200 })
    if (res.status === 429) rateLimited429.add(1)
  })

  group('6. Merma', () => {
    const res = http.post(
      `${BASE_URL}/inventory/waste`,
      JSON.stringify({
        sucursalId: ctx.sucursalId,
        productId: ctx.productId,
        reason: 'DAMAGED',
        notes: 'Merma registrada por el escenario funcional cashier-workday.js',
        quantity: 1 + Math.floor(Math.random() * 2),
      }),
      { headers },
    )
    check(res, { 'waste: 201': (r) => r.status === 201 })
    if (res.status === 429) rateLimited429.add(1)
  })

  group('7. Consulta de reportes antes de cuadrar caja', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/reports/dashboard`, null, { headers }],
      ['GET', `${BASE_URL}/reports/sales`, null, { headers }],
      ['GET', `${BASE_URL}/reports/low-stock`, null, { headers }],
      ['GET', `${BASE_URL}/reports/cash`, null, { headers }],
    ])
    for (const res of responses) {
      if (res.status === 429) rateLimited429.add(1)
    }
    check(responses[0], { 'dashboard: 200': (r) => r.status === 200 })
  })

  group('8. Cierre de caja', () => {
    const res = closeCashSession(ctx, ctx.cashSessionId, Math.max(0, cashCollected))
    check(res, { 'close cash session: 200': (r) => r.status === 200 })
    if (res.status === 429) rateLimited429.add(1)
  })

  workdayDuration.add(Date.now() - shiftStart)
}
