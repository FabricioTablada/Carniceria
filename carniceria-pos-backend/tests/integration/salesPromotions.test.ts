/**
 * tests/integration/salesPromotions.test.ts
 * -----------------------------------------------------------------------------
 * Deuda tecnica del motor de promociones, Bloque 1 ("red de seguridad antes
 * de tocar el modelo de datos"): congela, mediante el pipeline HTTP REAL
 * (`createApp()` en un servidor real, sin mocks de Express/Prisma), el
 * comportamiento ACTUAL de persistencia de `SaleAppliedPromotion` — incluido
 * el defecto ya documentado y aprobado para corregir en un bloque futuro
 * (`discountType`/`discountValue` colapsan la granularidad real de
 * `PromotionEffectType`; no hay `effectType`/`promotionId` en el modelo
 * todavia).
 *
 * Esta prueba NO valida que el comportamiento sea "correcto" — valida que
 * sea el que es HOY, para que cualquier cambio futuro (intencional o
 * accidental) al motor, al servicio de ventas o al esquema tenga que
 * pasar por aqui.
 *
 * ACTUALIZACION Bloque 2 (migracion aditiva aplicada): agregar
 * `effectType`/`promotionId` (nullable) a `SaleAppliedPromotion` rompio
 * el `Object.keys` de la primera prueba (Prisma ahora devuelve esas dos
 * columnas, siempre `null` en ese momento, en cada fila) — se actualizo
 * la lista esperada de columnas.
 *
 * ACTUALIZACION Bloque 3 (poblar ambos campos para promociones
 * automaticas): las dos aserciones que antes esperaban `null` para la
 * promocion AUTOMATICA ahora esperan el valor real (`effectType:
 * 'BUY_X_PAY_Y'`, `promotionId` de la promocion creada en este archivo);
 * se agregaron las mismas dos aserciones al caso MANUAL, confirmando que
 * ahi siguen en `null` (no es una regla de catalogo).
 *
 * ACTUALIZACION Bloque 4 (esta implementacion — exposicion via API):
 * se agregaron aserciones sobre `sale.json.data.appliedPromotions`
 * (la respuesta HTTP de `POST /sales`, no solo la fila cruda de base de
 * datos) confirmando que `effectType`/`promotionId` tambien llegan hasta
 * ahi — poblados para AUTOMATIC, `null` para MANUAL. Ninguna asercion
 * existente cambio: `discountType`, `discountValue`, `amountApplied` y
 * el resto del mapeo actual siguen verificados exactamente igual que en
 * el Bloque 1.
 *
 * Contra la base de datos REAL configurada en `DATABASE_URL` (mismo
 * criterio que `inventoryMovement.concurrency.test.ts`): sin esa conexion,
 * los tests se omiten con advertencia en vez de fallar, para no romper
 * entornos sin Postgres accesible.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { Application } from 'express';
import { CashSessionStatus, PromotionEffectType, PromotionScopeType } from '@prisma/client';
import { prisma } from '@/database';

let server: Server;
let baseUrl: string;
let dbAvailable = true;

let sucursalId: string;
let categoryId: string;
let taxId: string;
let cashRegisterId: string;
let cashSessionId: string;
let productId: string;
let promotionId: string;
let accessToken: string;

const PRODUCT_NAME = 'QA-PROMO — producto de prueba (eliminar si persiste)';
const CATEGORY_NAME = 'QA-PROMO — categoria de prueba (eliminar si persiste)';
const PROMOTION_NAME = 'QA-PROMO — TEST 2x1 congelado (eliminar si persiste)';
const UNIT_PRICE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- respuesta JSON generica de un helper de prueba, sin DTO propio.
async function api(path: string, init: RequestInit = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

beforeAll(async () => {
  try {
    const [sucursal, tax, cashRegister] = await Promise.all([
      prisma.sucursal.findFirst(),
      prisma.tax.findFirst(),
      prisma.cashRegister.findFirst(),
    ]);

    if (!sucursal || !tax || !cashRegister) {
      dbAvailable = false;
      return;
    }

    sucursalId = sucursal.id;
    taxId = tax.id;
    cashRegisterId = cashRegister.id;

    // Categoria desechable y aislada: reutilizar una categoria real del
    // catalogo (`findFirst()`) arriesga heredar una promocion CATEGORY ya
    // activa sembrada sobre ella (ej. "Carnes de Res 10%"), que interferiria
    // silenciosamente con la promocion de prueba de este archivo.
    const category = await prisma.category.create({
      data: { name: CATEGORY_NAME },
    });
    categoryId = category.id;

    // Producto desechable, aislado de cualquier stock/promocion real del
    // catalogo (mismo criterio que inventoryMovement.concurrency.test.ts).
    const product = await prisma.product.create({
      data: {
        categoryId,
        taxId,
        name: PRODUCT_NAME,
        salePrice: UNIT_PRICE,
        cost: UNIT_PRICE / 2,
      },
    });
    productId = product.id;

    await prisma.inventory.create({
      data: { productId, sucursalId, quantity: 100, reorderPoint: 0 },
    });

    // Sesion de caja: reutiliza una abierta si existe (no se puede abrir
    // una segunda para la misma caja), o abre una nueva desechable.
    const openSession = await prisma.cashSession.findFirst({
      where: { cashRegisterId, status: CashSessionStatus.OPEN },
    });

    if (openSession) {
      cashSessionId = openSession.id;
    } else {
      const admin = await prisma.user.findFirst({ where: { username: 'admin' } });
      if (!admin) {
        dbAvailable = false;
        return;
      }
      const session = await prisma.cashSession.create({
        data: {
          sucursalId,
          cashRegisterId,
          openedByUserId: admin.id,
          openingAmount: 50000,
        },
      });
      cashSessionId = session.id;
    }
  } catch (error) {
    dbAvailable = false;
    // eslint-disable-next-line no-console
    console.warn(
      '[salesPromotions] No se pudo conectar/preparar la base de datos; se omite la suite. Detalle:',
      error,
    );
    return;
  }

  const { createApp } = await import('@/app');
  const app: Application = createApp();
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('No se pudo obtener el puerto del servidor de pruebas.');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: process.env.SEED_ADMIN_PASSWORD }),
  });
  if (login.status !== 200) {
    throw new Error(`Login de prueba fallo: ${JSON.stringify(login.json)}`);
  }
  accessToken = login.json.data.accessToken;

  // Promocion 2x1 (BUY_X_PAY_Y) real, vía la API — es el caso mas
  // informativo del defecto conocido: `effectValue` es null para este
  // tipo, asi que `discountValue` termina igual a `amountApplied` (ver
  // service.ts, comentario junto al mapeo).
  const promo = await api('/promotions', {
    method: 'POST',
    body: JSON.stringify({
      name: PROMOTION_NAME,
      scopeType: PromotionScopeType.PRODUCT,
      effectType: PromotionEffectType.BUY_X_PAY_Y,
      buyQuantity: 2,
      payQuantity: 1,
      active: true,
      stackable: false,
      priority: 0,
      productIds: [{ productId }],
    }),
  });
  if (promo.status !== 201) {
    throw new Error(`Creacion de promocion de prueba fallo: ${JSON.stringify(promo.json)}`);
  }
  promotionId = promo.json.data.id;
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  if (!dbAvailable) return;

  if (promotionId) {
    await prisma.promotionProduct.deleteMany({ where: { promotionId } });
    await prisma.promotion.delete({ where: { id: promotionId } }).catch(() => {});
  }
  if (productId) {
    await prisma.saleItem.deleteMany({ where: { productId } });
    await prisma.inventoryMovement.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } }).catch(() => {});
  }
  if (categoryId) {
    await prisma.category.delete({ where: { id: categoryId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('SaleAppliedPromotion — comportamiento actual persistido (congelado, deuda tecnica Bloque 1)', () => {
  it('registra una promocion automatica BUY_X_PAY_Y (2x1) con el mapeo/campos exactos de hoy', async () => {
    if (!dbAvailable) {
      console.warn('[salesPromotions] Test omitido: sin conexion a base de datos.');
      return;
    }

    const sale = await api('/sales', {
      method: 'POST',
      body: JSON.stringify({
        cashSessionId,
        paymentMethod: 'CASH',
        amountPaid: UNIT_PRICE * 2,
        items: [{ productId, taxId, quantity: 2, unitPrice: UNIT_PRICE }],
      }),
    });

    expect(sale.status).toBe(201);
    const saleId = sale.json.data.id as string;
    const saleItemId = sale.json.data.items[0].id as string;

    // Calculo esperado del motor hoy: 2x1 sobre qty=2 -> 1 grupo completo,
    // 1 unidad gratis * UNIT_PRICE = descuento de UNIT_PRICE exacto.
    const expectedDiscount = UNIT_PRICE;
    expect(sale.json.data.subtotal).toBe(UNIT_PRICE * 2 - expectedDiscount);

    // Verificacion DIRECTA en base de datos (no solo la respuesta HTTP) —
    // la fuente de verdad real de "que quedo persistido".
    const rows = await prisma.saleAppliedPromotion.findMany({
      where: { saleId },
      orderBy: { createdAt: 'asc' },
    });

    expect(rows).toHaveLength(1);
    const row = rows[0];

    // Campos que el mapeo actual SI preserva correctamente.
    expect(row.saleId).toBe(saleId);
    expect(row.saleItemId).toBe(saleItemId);
    expect(row.source).toBe('AUTOMATIC');
    expect(row.appliedByUserId).toBeNull();
    expect(row.promotionNameSnapshot).toBe(PROMOTION_NAME);
    expect(Number(row.amountApplied)).toBe(expectedDiscount);

    // Comportamiento actual CONOCIDO Y DEFECTUOSO (documentado, no
    // corregido en este bloque): BUY_X_PAY_Y no tiene un valor propio en
    // `SaleDiscountType`, asi que colapsa a 'FIXED' — y como
    // `effectValue` es null para este tipo, `discountValue` termina
    // igual a `amountApplied`. Si este bloque llegara a "arreglar" esto
    // sin querer, esta asercion es la que debe fallar primero.
    expect(row.discountType).toBe('FIXED');
    expect(Number(row.discountValue)).toBe(expectedDiscount);
    expect(Number(row.discountValue)).toBe(Number(row.amountApplied));

    // Deuda tecnica, Bloque 2 (migracion aditiva): `effectType`/
    // `promotionId` existen como columnas nullable desde entonces —
    // Prisma las devuelve en cada fila. El `Object.keys` sigue
    // congelando el set completo de columnas (sin cambios respecto al
    // Bloque 2: ninguna columna nueva se agrego en este bloque).
    expect(Object.keys(row).sort()).toEqual(
      [
        'id',
        'saleId',
        'saleItemId',
        'source',
        'appliedByUserId',
        'promotionNameSnapshot',
        'discountType',
        'discountValue',
        'amountApplied',
        'effectType',
        'promotionId',
        'createdAt',
      ].sort(),
    );

    // Deuda tecnica, Bloque 3 (esta implementacion): `effectType`/
    // `promotionId` ahora SI quedan poblados para promociones
    // automaticas — complementan, sin reemplazar, `discountType`
    // (arriba, sigue colapsado a 'FIXED') y `promotionNameSnapshot`
    // (arriba, sigue siendo el nombre en texto). Esta es la primera vez
    // que es posible reconstruir, de forma estructurada, que esta fila
    // vino de una regla `BUY_X_PAY_Y` de ESTA promocion especifica.
    expect(row.effectType).toBe('BUY_X_PAY_Y');
    expect(row.promotionId).toBe(promotionId);

    // Deuda tecnica, Bloque 4 (exposicion via API): la respuesta HTTP de
    // `POST /sales` ahora TAMBIEN incluye ambos campos — no solo la fila
    // cruda de base de datos. Todos los campos que ya devolvia antes
    // (discountType, discountValue, amountApplied, promotionNameSnapshot,
    // etc.) siguen exactamente iguales; esto solo confirma que las dos
    // propiedades nuevas llegan tal cual hasta el consumidor de la API.
    const appliedFromResponse = sale.json.data.appliedPromotions[0];
    expect(appliedFromResponse.discountType).toBe('FIXED');
    expect(appliedFromResponse.amountApplied).toBe(expectedDiscount);
    expect(appliedFromResponse.effectType).toBe('BUY_X_PAY_Y');
    expect(appliedFromResponse.promotionId).toBe(promotionId);
  });

  it('registra un descuento manual de carrito (source MANUAL) con el mismo mapeo actual', async () => {
    if (!dbAvailable) {
      console.warn('[salesPromotions] Test omitido: sin conexion a base de datos.');
      return;
    }

    const sale = await api('/sales', {
      method: 'POST',
      body: JSON.stringify({
        cashSessionId,
        paymentMethod: 'CASH',
        amountPaid: UNIT_PRICE,
        items: [{ productId, taxId, quantity: 1, unitPrice: UNIT_PRICE }],
        discountType: 'FIXED',
        discountValue: 100,
      }),
    });

    expect(sale.status).toBe(201);
    const saleId = sale.json.data.id as string;

    const rows = await prisma.saleAppliedPromotion.findMany({ where: { saleId } });
    expect(rows).toHaveLength(1);
    const row = rows[0];

    expect(row.saleItemId).toBeNull();
    expect(row.source).toBe('MANUAL');
    expect(row.promotionNameSnapshot).toBe('Descuento manual');
    expect(row.discountType).toBe('FIXED');
    expect(Number(row.discountValue)).toBe(100);
    expect(Number(row.amountApplied)).toBe(100);

    // Bloque 3: un descuento manual no es una regla de promocion de
    // catalogo — `effectType`/`promotionId` deben seguir en `null`,
    // exactamente como antes de este bloque (el punto de insercion del
    // descuento MANUAL en `sales/service.ts` no se toco).
    expect(row.effectType).toBeNull();
    expect(row.promotionId).toBeNull();

    // Bloque 4: el descuento manual tambien expone ambos campos via API,
    // en `null` — mismo criterio que la fila de base de datos.
    const appliedFromResponse = sale.json.data.appliedPromotions[0];
    expect(appliedFromResponse.effectType).toBeNull();
    expect(appliedFromResponse.promotionId).toBeNull();
  });
});
