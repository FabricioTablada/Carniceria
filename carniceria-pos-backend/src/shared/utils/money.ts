/**
 * shared/utils/money.ts
 * -----------------------------------------------------------------------------
 * Manejo de dinero en Colones costarricenses (CRC).
 *
 * REGLA CRITICA (decision #6): el dinero JAMAS se representa con numeros de
 * punto flotante nativos de JavaScript. Se usa Prisma.Decimal (respaldado por
 * decimal.js) para evitar errores de redondeo en operaciones financieras.
 *
 * REDONDEO (QA motor de promociones, cierre de defecto #1): `roundMoney()` es
 * la UNICA fuente de verdad de redondeo monetario del lado `Prisma.Decimal`
 * del dominio de Ventas — 2 decimales (colones), mitad hacia arriba
 * (`ROUND_HALF_UP`). Antes de esto, ninguna operacion de `multiplyMoney`/
 * `toMoney` redondeaba: una division como "10% de un subtotal" podia producir
 * mas de 2 decimales, invisibles en `POST /sales` (Postgres los truncaba
 * silenciosamente al persistir, columna `Decimal(_,2)`) pero expuestos tal
 * cual en `POST /sales/quote` (nunca toca la base de datos) — rompiendo el
 * contrato "misma cotizacion = misma venta" para descuentos porcentuales
 * sobre subtotales no exactos. `sales/service.ts` ahora llama a
 * `roundMoney()` explicitamente en cada punto donde una multiplicacion o
 * division puede introducir mas de 2 decimales (`computeItems`,
 * `computeCartDiscountAmount`), en vez de depender del redondeo implicito de
 * la base de datos.
 *
 * MISMA REGLA, DOS IMPLEMENTACIONES (una por cada lado del dominio, no
 * duplicacion accidental): `shared/services/promotionEngine/calculation.ts`
 * ya redondeaba `number` con `roundCurrency()` (`Math.round(v*100)/100`,
 * matematicamente equivalente a "mitad hacia arriba" para montos siempre
 * positivos) desde el Bloque P.4 — el motor de promociones trabaja
 * deliberadamente con `number`, no con `Prisma.Decimal` (desacoplado de
 * `@prisma/client`, ver ese archivo). `roundMoney()` aplica la MISMA regla
 * del lado `Decimal`, para que ambos lados del dominio de Ventas redondeen
 * de forma identica sin que ninguno dependa del otro ni de Postgres.
 */
import { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal;

/** Crea un valor monetario seguro a partir de un numero o cadena. */
export function toMoney(value: number | string | Prisma.Decimal): Money {
  return new Prisma.Decimal(value);
}

export function addMoney(a: Money, b: Money): Money {
  return a.add(b);
}

export function multiplyMoney(amount: Money, quantity: number | string | Money): Money {
  return amount.mul(quantity);
}

/** Redondea a 2 decimales (colones), mitad hacia arriba — unica fuente de
 * verdad de redondeo monetario para `Prisma.Decimal` en todo el dominio de
 * Ventas (ver nota de cabecera). Debe aplicarse explicitamente despues de
 * cualquier `multiplyMoney`/`.div(...)` cuyo resultado se vaya a exponer
 * (respuesta HTTP) o a usar como base de un calculo posterior — no antes de
 * sumar/restar dos montos que ya son el resultado de `roundMoney()` (esa
 * operacion es exacta, no introduce nuevos decimales). */
export function roundMoney(value: Money): Money {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Formatea un monto como Colones: "\u20A1 1,250.00". */
export function formatCRC(value: number | string | Prisma.Decimal): string {
  const amount = new Prisma.Decimal(value).toNumber();
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
  }).format(amount);
}
