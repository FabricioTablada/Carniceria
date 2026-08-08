/**
 * load-tests/realistic-session/lib/common.mjs
 * -----------------------------------------------------------------------------
 * Helpers compartidos entre los escenarios de `load-tests/realistic-session/`
 * (Nivel 2 — `cashier-realistic-session.mjs` — y Nivel 3 —
 * `cashier-intensive-shift.mjs`). Extraído del Nivel 2 al aprobar ese nivel,
 * por pedido explícito de reutilizar toda la infraestructura ya creada en
 * vez de rearmarla para cada escenario nuevo: cliente HTTP mínimo (fetch
 * nativo, sin dependencias nuevas), autenticación + bootstrap de fixtures,
 * PRNG determinístico y utilidades estadísticas (avg/percentile).
 *
 * Nada de este directorio se importa desde el código de la aplicación — es
 * infraestructura de prueba, aislada del backend real (mismo criterio que
 * `load-tests/k6/`).
 */

// ---------------------------------------------------------------------------
// PRNG determinístico (mulberry32) — misma secuencia de acciones reproducible
// con la misma SEED.
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRandomHelpers(seed) {
  const rng = mulberry32(seed);
  const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
  const randFloat = (min, max) => rng() * (max - min) + min;
  const pick = (arr) => arr[randInt(0, arr.length - 1)];
  return { rng, randInt, randFloat, pick };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Cliente HTTP mínimo (fetch nativo de Node 24)
// ---------------------------------------------------------------------------

export function createHttpClient({ baseUrl, requestTimeoutMs }) {
  let accessToken = null;

  async function request(method, urlPath, body, extraHeaders) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    const start = performance.now();
    let status = null;
    let json = null;
    let errorKind = null; // 'timeout' | 'network' | null
    let errorMessage = null;
    let setCookies = [];

    try {
      const res = await fetch(`${baseUrl}${urlPath}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(extraHeaders ?? {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      status = res.status;
      setCookies = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers.get('set-cookie')].filter(Boolean);
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
      errorMessage = err.message;
    } finally {
      clearTimeout(timer);
    }

    const durationMs = performance.now() - start;
    return { status, json, errorKind, errorMessage, durationMs, method, path: urlPath, setCookies };
  }

  return {
    request,
    setAccessToken: (token) => {
      accessToken = token;
    },
    getAccessToken: () => accessToken,
  };
}

/** Extrae el valor de la cookie `refreshToken` (httpOnly) de un arreglo de
 * cabeceras `Set-Cookie` — mismo criterio que `load-tests/k6/lib/auth.js`
 * (`loginRes.cookies?.refreshToken?.[0]?.value`), adaptado a fetch nativo. */
export function extractRefreshCookie(setCookies) {
  for (const cookie of setCookies ?? []) {
    const match = /^refreshToken=([^;]+)/.exec(cookie);
    if (match) return match[1];
  }
  return null;
}

/**
 * Refresca el accessToken usando la cookie de refresh capturada en el
 * login (`POST /auth/refresh`, fuera del `loginRateLimiter` estricto — ver
 * `src/middlewares/rateLimit.middleware.ts`). Necesario para corridas más
 * largas que `JWT_EXPIRES_IN` (15 min por defecto): sin esto, el token
 * expira a mitad de una jornada intensiva y el resto de la corrida se
 * contamina con 401 en cascada (no es un defecto del backend — es un
 * requisito del cliente de la prueba, mismo criterio ya documentado para
 * `mixed-soak.js` en `load-tests/k6/lib/auth.js`).
 */
export async function refreshAccessToken(http, baseUrl, refreshCookie) {
  if (!refreshCookie) return { ok: false, refreshCookie };
  const res = await http.request('POST', '/auth/refresh', undefined, {
    Cookie: `refreshToken=${refreshCookie}`,
  });
  if (res.status !== 200 || !res.json?.data?.accessToken) {
    return { ok: false, refreshCookie };
  }
  http.setAccessToken(res.json.data.accessToken);
  const newCookie = extractRefreshCookie(res.setCookies) ?? refreshCookie;
  return { ok: true, refreshCookie: newCookie };
}

// ---------------------------------------------------------------------------
// Bootstrap: login, catálogo, caja, proveedores
// ---------------------------------------------------------------------------

export async function bootstrap(http, { adminUser, adminPass, withSuppliers = false }) {
  console.log(`[bootstrap] login como "${adminUser}"...`);

  const loginRes = await http.request('POST', '/auth/login', {
    username: adminUser,
    password: adminPass,
  });

  if (loginRes.status !== 200) {
    throw new Error(
      `Login falló (status ${loginRes.status}): ${JSON.stringify(loginRes.json)}. ` +
        `Verificá que BASE_URL apunte a un backend levantado contra la base de pruebas aislada.`,
    );
  }
  http.setAccessToken(loginRes.json.data.accessToken);
  const user = loginRes.json.data.user;
  const refreshCookie = extractRefreshCookie(loginRes.setCookies);
  console.log(`[bootstrap] login OK — usuario "${user.fullName}" (${user.role}).`);

  const sucursalId = JSON.parse(
    Buffer.from(loginRes.json.data.accessToken.split('.')[1], 'base64url').toString('utf8'),
  ).sucursalId;

  const productsRes = await http.request('GET', '/products?limit=40&active=true');
  const products = productsRes.json?.data?.items ?? productsRes.json?.data ?? [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No se encontraron productos activos — ¿corrió prisma/seed.ts contra esta base?');
  }
  console.log(`[bootstrap] catálogo cargado: ${products.length} productos.`);

  const cashRegistersRes = await http.request('GET', '/cash-registers?active=true&limit=5');
  const cashRegisters = cashRegistersRes.json?.data?.items ?? cashRegistersRes.json?.data ?? [];
  const cashRegister = cashRegisters[0];
  if (!cashRegister) {
    throw new Error('No se encontró ninguna caja registradora activa.');
  }

  let cashSession = null;
  const existingSessionsRes = await http.request(
    'GET',
    `/cash/sessions?cashRegisterId=${cashRegister.id}&status=OPEN&limit=1`,
  );
  const existingSessions = existingSessionsRes.json?.data?.items ?? existingSessionsRes.json?.data ?? [];
  if (existingSessions[0]) {
    cashSession = existingSessions[0];
    console.log(`[bootstrap] reutilizando sesión de caja ya abierta: ${cashSession.id}`);
  } else {
    const openRes = await http.request('POST', '/cash/sessions', {
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

  const ctx = {
    sucursalId,
    products,
    cashRegister,
    cashSession,
    searchTerms,
    refreshCookie,
    tokenIssuedAt: Date.now(),
  };

  if (withSuppliers) {
    const suppliersRes = await http.request('GET', '/suppliers?active=true&limit=20');
    const suppliers = suppliersRes.json?.data?.items ?? suppliersRes.json?.data ?? [];
    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      throw new Error('No se encontraron proveedores activos — ¿corrió prisma/seed.ts contra esta base?');
    }
    console.log(`[bootstrap] proveedores cargados: ${suppliers.length}.`);
    ctx.suppliers = suppliers;
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------

export function avg(nums) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function percentile(nums, p) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

// ---------------------------------------------------------------------------
// Carrito (mismo criterio que el POS del frontend)
// ---------------------------------------------------------------------------

export function makeCartLine(product, { randInt, randFloat }) {
  const isKg = product.unitOfMeasure === 'KILOGRAM';
  return {
    productId: product.id,
    taxId: product.taxId ?? null,
    unitPrice: product.salePrice ?? product.price ?? 1000,
    quantity: isKg ? Number(randFloat(0.2, 3).toFixed(3)) : randInt(1, 5),
  };
}
