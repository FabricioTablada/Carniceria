/**
 * tests/integration/inventoryMovement.concurrency.test.ts
 * -----------------------------------------------------------------------------
 * Sprint QA 3.6: valida, contra una base de datos PostgreSQL REAL (no
 * mockeada), si `recordMovement()` (`shared/services/inventoryMovement.service.ts`)
 * mantiene `Inventory.quantity` consistente bajo escritura concurrente.
 *
 * A diferencia de `tests/unit/*`, este archivo NO mockea Prisma: usa el
 * cliente real (`@/database`) contra `DATABASE_URL` (ver `.env`). Es
 * deliberadamente el unico test del proyecto que ejerce concurrencia real de
 * base de datos, porque el "lost update" que se busca reproducir/descartar
 * solo puede ocurrir (o no ocurrir) a nivel del motor de PostgreSQL — un
 * mock de Prisma no puede simular el locking de fila real.
 *
 * No modifica ninguna logica de produccion. Si la base de datos configurada
 * en `DATABASE_URL` no esta disponible, las pruebas se marcan como
 * omitidas (con advertencia) en lugar de fallar, para no romper entornos
 * (CI u otras maquinas) sin Postgres accesible.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InventoryMovementType } from '@prisma/client';
import { prisma } from '@/database';
import { recordMovement } from '@/shared/services/inventoryMovement.service';
import { InventoryReferenceType } from '@/shared/constants';

let dbAvailable = true;
let sucursalId: string;
let userId: string;
let productId: string;

beforeAll(async () => {
  try {
    const [sucursal, user, category, tax] = await Promise.all([
      prisma.sucursal.findFirst(),
      prisma.user.findFirst(),
      prisma.category.findFirst(),
      prisma.tax.findFirst(),
    ]);

    if (!sucursal || !user || !category || !tax) {
      dbAvailable = false;
      return;
    }

    sucursalId = sucursal.id;
    userId = user.id;

    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        taxId: tax.id,
        name: 'QA3.6 - producto de prueba de concurrencia (eliminar si persiste)',
        salePrice: 1000,
        cost: 500,
      },
    });
    productId = product.id;
  } catch (error) {
    dbAvailable = false;
    console.warn(
      '[QA3.6] No se pudo conectar a la base de datos configurada en DATABASE_URL; ' +
        'se omite el test de concurrencia real. Detalle:',
      error,
    );
  }
});

afterAll(async () => {
  if (!dbAvailable) return;

  await prisma.inventoryMovement.deleteMany({ where: { productId } });
  await prisma.inventory.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
  await prisma.$disconnect();
});

describe('recordMovement() bajo escritura concurrente (base de datos real)', () => {
  it('Escenario 1 — creacion inicial concurrente de Inventory para el mismo (productId, sucursalId)', async () => {
    if (!dbAvailable) {
      console.warn('[QA3.6] Escenario 1 omitido: sin conexion a base de datos.');
      return;
    }

    // Punto de partida: garantizado que NO existe fila de Inventory todavia
    // (el producto se creo en beforeAll, nunca tuvo movimientos).
    const before = await prisma.inventory.findFirst({ where: { productId, sucursalId } });
    expect(before).toBeNull();

    const fireOnce = () =>
      prisma.$transaction((tx) =>
        recordMovement({
          tx,
          sucursalId,
          productId,
          userId,
          type: InventoryMovementType.ADJUSTMENT,
          quantity: 5,
          referenceType: InventoryReferenceType.INVENTORY_ADJUSTMENT,
          reason: 'QA3.6 - escenario 1 (carrera de creacion)',
        }),
      );

    // Dos transacciones disparadas al mismo tiempo, ambas contra un
    // (productId, sucursalId) que todavia no tiene fila de Inventory.
    const results = await Promise.allSettled([fireOnce(), fireOnce()]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fireOnce>>> => r.status === 'fulfilled',
    );
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    console.log('[QA3.6] Escenario 1 - resultados:', results.map((r) => r.status));
    if (rejected.length > 0) {
      const reason = rejected[0].reason as { code?: string; message?: string };
      console.log('[QA3.6] Escenario 1 - motivo del rechazo:', reason?.code, reason?.message);
    }

    // Se documenta el resultado real, sin asumirlo de antemano: las dos
    // transacciones deben resolverse de una forma u otra (nunca perderse
    // silenciosamente).
    expect(fulfilled.length + rejected.length).toBe(2);

    // Cualquiera sea el desenlace, el saldo final en Inventory debe
    // corresponder exactamente a las transacciones que SI se aplicaron.
    const after = await prisma.inventory.findFirst({ where: { productId, sucursalId } });
    expect(Number(after?.quantity)).toBe(fulfilled.length * 5);
  });

  it('Escenario 2 — N incrementos concurrentes sobre una fila de Inventory ya existente', async () => {
    if (!dbAvailable) {
      console.warn('[QA3.6] Escenario 2 omitido: sin conexion a base de datos.');
      return;
    }

    // Punto de partida limpio y ya existente, fuera de la ventana de
    // carrera de creacion (probada por separado en el Escenario 1).
    await prisma.inventory.deleteMany({ where: { productId, sucursalId } });
    await prisma.inventory.create({ data: { productId, sucursalId, quantity: 0 } });

    const CONCURRENT_WRITES = 20;

    const calls = Array.from({ length: CONCURRENT_WRITES }, () =>
      prisma.$transaction((tx) =>
        recordMovement({
          tx,
          sucursalId,
          productId,
          userId,
          type: InventoryMovementType.ADJUSTMENT,
          quantity: 1,
          referenceType: InventoryReferenceType.INVENTORY_ADJUSTMENT,
          reason: 'QA3.6 - escenario 2 (incremento atomico concurrente)',
        }),
      ),
    );

    // Todas disparadas al mismo tiempo: la fila ya existe, por lo que no
    // hay ventana de creacion duplicada que pueda hacer fallar ninguna.
    const results = await Promise.all(calls);

    const finalInventory = await prisma.inventory.findFirst({ where: { productId, sucursalId } });
    const balances = results.map((r) => r.balanceAfter).sort((a, b) => a - b);

    console.log(
      '[QA3.6] Escenario 2 - quantity final:',
      finalInventory?.quantity.toString(),
      '| esperado:',
      CONCURRENT_WRITES,
    );
    console.log('[QA3.6] Escenario 2 - balanceAfter de cada escritura concurrente (ordenados):', balances);

    // (A) Si el incremento atomico (`quantity: { increment: delta }`) es
    // realmente seguro frente al "lost update": el saldo final debe ser
    // EXACTAMENTE 20 (ninguna escritura se pierde) y cada `balanceAfter`
    // debe ser un valor unico de 1 a 20, sin huecos ni duplicados (cada
    // transaccion vio el valor ya incrementado por las anteriores, nunca
    // un valor obsoleto).
    expect(Number(finalInventory?.quantity)).toBe(CONCURRENT_WRITES);
    expect(balances).toEqual(Array.from({ length: CONCURRENT_WRITES }, (_, i) => i + 1));
  });
});
