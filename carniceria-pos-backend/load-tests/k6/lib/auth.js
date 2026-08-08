/**
 * load-tests/k6/lib/auth.js
 * -----------------------------------------------------------------------------
 * Login y bootstrap de contexto compartido para los escenarios de carga.
 *
 * IMPORTANTE sobre el rate limiter: `POST /auth/login` tiene su propio
 * limiter estricto (`LOGIN_RATE_LIMIT_MAX`, 5 intentos/15min, por IP — ver
 * `src/middlewares/rateLimit.middleware.ts`). Por eso el login se hace UNA
 * SOLA VEZ, dentro de `setup()` (que k6 ejecuta una unica vez antes de
 * levantar los VUs, nunca por-VU ni por-iteracion), y el `accessToken`
 * resultante se reutiliza en todas las iteraciones de todos los VUs durante
 * toda la duracion del escenario. Ningun escenario de este directorio debe
 * llamar a `login()` fuera de `setup()`.
 *
 * `JWT_EXPIRES_IN` (.env del backend) es 15 minutos por defecto. Los
 * escenarios cortos (smoke, sales-load, purchases-load, stress-to-429) estan
 * pensados para correr en menos de ese tiempo. El unico escenario mas largo
 * (`mixed-soak.js`, pensado para simular un turno de 8h comprimido) refresca
 * el token periodicamente via `POST /auth/refresh` (fuera del limiter de
 * login, bajo el limiter general) en vez de repetir el login.
 */
import http from 'k6/http'
import { check, fail } from 'k6'
import { BASE_URL, ADMIN_USER, ADMIN_PASS, JSON_HEADERS, PRODUCT_SKU, SUPPLIER_INDEX } from '../config.js'

/**
 * Login + resolucion de fixtures minimas para poder crear ventas/compras:
 * un producto activo (por SKU), un proveedor activo, y la caja registradora
 * de la sucursal del usuario (para abrir/reutilizar una sesion de caja).
 * Todo esto ya debe existir por `prisma/seed.ts` (el seed principal del
 * proyecto) — este script NO crea catalogos, solo los consulta.
 *
 * `options.openSession` (default `true`): la mayoria de los escenarios
 * necesitan UNA sesion ya abierta y compartida entre todos los VUs
 * (`sales-load.js`, `purchases-load.js`, `mixed-soak.js`, `stress-to-429.js`
 * — todos venden contra la misma sesion concurrentemente, a proposito). El
 * unico que NO: `cashier-workday.js`, que simula el ciclo de vida COMPLETO
 * de una jornada (abre su propia sesion al inicio de cada turno y la cierra
 * al final) — ese escenario pasa `openSession: false` para que `setup()`
 * no abra una sesion que el propio escenario va a abrir y cerrar por su
 * cuenta en cada iteracion.
 */
export function loginAndBootstrap(options = {}) {
  const { openSession = true } = options
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    { headers: JSON_HEADERS },
  )

  check(loginRes, { 'login: 200': (r) => r.status === 200 }) ||
    fail(`login fallo (status ${loginRes.status}): ${loginRes.body}`)

  const accessToken = loginRes.json('data.accessToken')
  const refreshCookie = loginRes.cookies?.refreshToken?.[0]?.value

  const authHeaders = { ...JSON_HEADERS, Authorization: `Bearer ${accessToken}` }

  const productRes = http.get(`${BASE_URL}/products?search=${PRODUCT_SKU}&limit=1`, {
    headers: authHeaders,
  })
  check(productRes, { 'products: 200': (r) => r.status === 200 })
  const product = productRes.json('data.items.0') || productRes.json('data.0')

  if (!product) {
    fail(
      `No se encontro el producto con SKU "${PRODUCT_SKU}". Verifica que ` +
        `prisma/seed.ts ya corrio contra esta base de datos.`,
    )
  }

  const supplierRes = http.get(`${BASE_URL}/suppliers?active=true&limit=10`, {
    headers: authHeaders,
  })
  check(supplierRes, { 'suppliers: 200': (r) => r.status === 200 })
  const supplier =
    supplierRes.json('data.items')?.[SUPPLIER_INDEX] || supplierRes.json('data')?.[SUPPLIER_INDEX]

  const cashRegistersRes = http.get(`${BASE_URL}/cash-registers?active=true&limit=1`, {
    headers: authHeaders,
  })
  check(cashRegistersRes, { 'cash-registers: 200': (r) => r.status === 200 })
  const cashRegister =
    cashRegistersRes.json('data.items.0') || cashRegistersRes.json('data.0')

  if (!cashRegister) {
    fail('No se encontro ninguna caja registradora activa (revisa prisma/seed.ts).')
  }

  // `Inventory` no expone su propio endpoint de busqueda por SKU — se
  // resuelve por (productId, sucursalId), necesario para `useUpdateInventory`
  // (ajustes manuales) en `cashier-workday.js`.
  const inventoryRes = http.get(
    `${BASE_URL}/inventory?productId=${product.id}&sucursalId=${cashRegister.sucursalId}&limit=1`,
    { headers: authHeaders },
  )
  check(inventoryRes, { 'inventory: 200': (r) => r.status === 200 })
  const inventory = inventoryRes.json('data.items.0') || inventoryRes.json('data.0')

  const baseCtx = {
    accessToken,
    refreshCookie,
    sucursalId: cashRegister.sucursalId,
    cashRegisterId: cashRegister.id,
    productId: product.id,
    productPrice: product.price ?? product.unitPrice ?? 1000,
    taxId: product.taxId ?? null,
    supplierId: supplier ? supplier.id : null,
    inventoryId: inventory ? inventory.id : null,
    tokenIssuedAt: Date.now(),
  }

  if (!openSession) {
    return baseCtx
  }

  // Reutiliza una sesion ya abierta para esa caja si existe (permite
  // relanzar el escenario sin cerrar sesiones manualmente); si no, abre una
  // nueva. Todas las ventas del escenario se registran contra ESTA MISMA
  // sesion desde todos los VUs a la vez — es intencional: es exactamente el
  // patron de concurrencia real que se quiere estresar (varias cajas/POS
  // vendiendo contra la misma sesion abierta).
  const existingSessionsRes = http.get(
    `${BASE_URL}/cash/sessions?cashRegisterId=${cashRegister.id}&status=OPEN&limit=1`,
    { headers: authHeaders },
  )
  let cashSession =
    existingSessionsRes.json('data.items.0') || existingSessionsRes.json('data.0')

  if (!cashSession) {
    const openRes = http.post(
      `${BASE_URL}/cash/sessions`,
      JSON.stringify({ cashRegisterId: cashRegister.id, openingAmount: 50000 }),
      { headers: authHeaders },
    )
    check(openRes, { 'open cash session: 201': (r) => r.status === 201 }) ||
      fail(`No se pudo abrir sesion de caja (status ${openRes.status}): ${openRes.body}`)
    cashSession = openRes.json('data')
  }

  return { ...baseCtx, cashSessionId: cashSession.id }
}

/** Refresca el accessToken de un contexto usando la cookie de refresh
 * capturada en `loginAndBootstrap()`. Usado solo por `mixed-soak.js`
 * (duracion > 15 min). No pasa por `loginRateLimiter`. */
export function refreshAccessToken(ctx) {
  const res = http.post(`${BASE_URL}/auth/refresh`, null, {
    headers: { Cookie: `refreshToken=${ctx.refreshCookie}` },
  })

  if (res.status !== 200) {
    return ctx // si falla, se sigue usando el token anterior hasta que expire
  }

  return {
    ...ctx,
    accessToken: res.json('data.accessToken'),
    refreshCookie: res.cookies?.refreshToken?.[0]?.value || ctx.refreshCookie,
    tokenIssuedAt: Date.now(),
  }
}

export function authHeadersFor(ctx) {
  return { ...JSON_HEADERS, Authorization: `Bearer ${ctx.accessToken}` }
}

/**
 * Abre una sesion de caja nueva sobre `ctx.cashRegisterId`. Usada por
 * `cashier-workday.js` al inicio de cada turno simulado — a diferencia de
 * `loginAndBootstrap()`, esta SIEMPRE abre una sesion nueva (no reutiliza
 * una existente): un turno real siempre empieza con una apertura.
 */
export function openCashSession(ctx, openingAmount = 50000) {
  const res = http.post(
    `${BASE_URL}/cash/sessions`,
    JSON.stringify({ cashRegisterId: ctx.cashRegisterId, openingAmount }),
    { headers: authHeadersFor(ctx) },
  )

  check(res, { 'open cash session: 201': (r) => r.status === 201 }) ||
    fail(`No se pudo abrir sesion de caja (status ${res.status}): ${res.body}`)

  return res.json('data')
}

/** Cierra la sesion de caja `cashSessionId` declarando `closingAmount`. */
export function closeCashSession(ctx, cashSessionId, closingAmount) {
  return http.patch(
    `${BASE_URL}/cash/sessions/${cashSessionId}/close`,
    JSON.stringify({ closingAmount }),
    { headers: authHeadersFor(ctx) },
  )
}
