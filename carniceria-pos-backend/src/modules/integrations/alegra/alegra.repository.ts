/**
 * modules/integrations/alegra/alegra.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos de la configuracion persistida de Alegra (Bloque 7.4). Es
 * infraestructura pura: no cifra/descifra (eso vive en `alegra.crypto.ts`)
 * ni valida reglas de negocio (eso vive en `alegra.service.ts`).
 *
 * `AlegraConfig` es una fila unica ("singleton"), por eso no hay `findMany`
 * ni filtros — solo `getConfig`/`upsertConfig` sobre el id fijo.
 *
 * Bloque 7.5: `setGenericClientId` persiste el ID (de Alegra) del contacto
 * "Cliente General" ya resuelto — una vez guardado, `resolveGenericClient`
 * (`alegra.service.ts`) nunca vuelve a llamar a la API de Alegra para
 * resolverlo.
 *
 * Bloque 7.6: `findProductForAlegra`/`setProductAlegraId` acceden a
 * `Product` directamente (mismo criterio ya usado por otros modulos del
 * backend — `categories`, `promotions`, `purchases`, `reports`, `sales`,
 * `taxes` ya consultan `prisma.product` sin pasar por `modules/products`),
 * asi que esta vinculacion permanente no necesita cruzar a otro modulo.
 *
 * Bloque 7.7: `findSaleForAlegra`/`setSaleInvoiceInfo`, mismo criterio de
 * acceso directo pero sobre `Sale`/`SaleItem`.
 *
 * Bloque 7.8: `findSaleInvoiceStatus`/`updateSaleInvoiceStatus` — mismo
 * criterio, acotado a los 3 campos que `checkInvoiceStatus`
 * (`alegra.service.ts`) puede actualizar.
 *
 * Bloque 7.9/7.10: `findSaleForInvoiceFile` — solo lectura, sin escritura
 * (ni el PDF ni el XML se persisten nunca, se descargan de Alegra en cada
 * solicitud), compartida por ambos formatos.
 */
import { prisma } from '@/database';

const SINGLETON_ID = 'singleton';

export function getConfig() {
  return prisma.alegraConfig.findUnique({ where: { id: SINGLETON_ID } });
}

export function upsertConfig(data: { email: string; token: string; baseUrl: string }) {
  return prisma.alegraConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}

export function setGenericClientId(genericClientId: string) {
  return prisma.alegraConfig.update({
    where: { id: SINGLETON_ID },
    data: { genericClientId },
  });
}

/** Bloque 7.19: persiste el `id` de cuenta de Alegra resuelto para "cash" o
 * "bank" (`resolveAlegraAccountId`, `alegra.service.ts`) — mismo criterio
 * que `setGenericClientId`, una sola escritura, nunca se vuelve a resolver
 * despues. */
export function setPaymentAccountId(kind: 'cashAccountId' | 'bankAccountId', accountId: string) {
  return prisma.alegraConfig.update({
    where: { id: SINGLETON_ID },
    data: { [kind]: accountId },
  });
}

export function findProductForAlegra(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      sku: true,
      name: true,
      salePrice: true,
      unitOfMeasure: true,
      alegraProductId: true,
      // Bloque 7.12: enviado como `productKey` al crear el item en Alegra
      // (`createProductInAlegra`) — exigido por Hacienda Costa Rica.
      cabysCode: true,
    },
  });
}

export function setProductAlegraId(productId: string, alegraProductId: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { alegraProductId },
  });
}

/** Bloque 8.4: mismo criterio exacto que `findProductForAlegra` — solo los
 * campos que `resolveCustomerAlegraId` necesita para buscar/crear el
 * contacto real en Alegra (`alegra.service.ts`). */
export function findCustomerForAlegra(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      identificationType: true,
      identificationNumber: true,
      email: true,
      address: true,
      alegraContactId: true,
    },
  });
}

export function setCustomerAlegraId(customerId: string, alegraContactId: string) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { alegraContactId },
  });
}

export function findSaleForAlegra(saleId: string) {
  return prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      saleDate: true,
      paymentMethod: true,
      // Fix (04/08/2026, incidente de emision duplicada real durante
      // QA.16A): `emitInvoice` (`alegra.service.ts`) necesita este campo
      // para poder rechazar, ANTES de llamar a Alegra, una venta que ya
      // tiene un comprobante electronico emitido.
      alegraInvoiceId: true,
      // Fix (05/08/2026, timeout real de emision): distinto de `null`
      // cuando un intento anterior quedo con resultado incierto —
      // `emitInvoice` reconcilia contra Alegra antes de permitir un nuevo
      // `POST /invoices` para esta venta. Ver comentario del campo en
      // `schema.prisma`.
      alegraEmissionUncertainAt: true,
      // Fix (07/08/2026, decision de negocio): `emitInvoice` exige cliente
      // identificado (`customerId` no nulo) para toda emision — ver
      // `emitInvoice`, `alegra.service.ts`.
      customerId: true,
      // Bloque 7.18: monto a registrar como pago (`payments[].amount`) para
      // que la factura quede completamente pagada en la misma llamada —
      // ver `emitInvoice`, `alegra.service.ts`.
      total: true,
      items: {
        // Bloque 7.15: `taxRate` (snapshot ya existente en `SaleItem`,
        // Bloque 14.2) — necesario para resolver el impuesto real de
        // Alegra por porcentaje (`emitInvoice`, `alegra.service.ts`).
        select: { productId: true, quantity: true, unitPrice: true, taxRate: true },
      },
    },
  });
}

export function setSaleInvoiceInfo(
  saleId: string,
  data: {
    alegraInvoiceId: string;
    alegraInvoiceNumber: string | null;
    alegraElectronicKey: string | null;
    alegraInvoiceStatus: string | null;
    alegraIssuedAt: Date;
  },
) {
  return prisma.sale.update({
    where: { id: saleId },
    // Fix (05/08/2026): toda emision que termina persistiendo un
    // `alegraInvoiceId` (ya sea por una respuesta normal de `POST /invoices`
    // o por una reconciliacion tras un timeout) limpia cualquier duda previa
    // — la fila ya tiene la confirmacion real de Alegra.
    data: { ...data, alegraEmissionUncertainAt: null },
  });
}

/** Fix (05/08/2026, timeout real de emision): marca la venta con resultado
 * incierto — ver comentario del campo `alegraEmissionUncertainAt` en
 * `schema.prisma`. Se llama unicamente desde el `catch` de `emitInvoice`
 * cuando la llamada a Alegra vencio por timeout, nunca ante un rechazo
 * explicito (esos ya vienen confirmados como "no se creo nada"). */
export function markEmissionUncertain(saleId: string) {
  return prisma.sale.update({
    where: { id: saleId },
    data: { alegraEmissionUncertainAt: new Date() },
  });
}

/** Fix (05/08/2026): limpia la marca de incertidumbre sin tocar ningun otro
 * campo — usado cuando la reconciliacion confirma que Alegra NUNCA creo la
 * factura (seguro volver a intentar una emision normal). */
export function clearEmissionUncertain(saleId: string) {
  return prisma.sale.update({
    where: { id: saleId },
    data: { alegraEmissionUncertainAt: null },
  });
}

export function findSaleInvoiceStatus(saleId: string) {
  return prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      alegraInvoiceId: true,
      alegraInvoiceStatus: true,
      alegraElectronicKey: true,
      alegraIssuedAt: true,
    },
  });
}

export function updateSaleInvoiceStatus(
  saleId: string,
  data: Partial<{
    alegraInvoiceStatus: string;
    alegraElectronicKey: string;
    alegraIssuedAt: Date;
  }>,
) {
  return prisma.sale.update({
    where: { id: saleId },
    data,
  });
}

/** Compartida por PDF (Bloque 7.9) y XML (Bloque 7.10) — ambos necesitan
 * exactamente los mismos 3 campos, asi que es el mismo selector para las
 * dos descargas (punto 7 del Bloque 7.10: "mismo repositorio"). */
export function findSaleForInvoiceFile(saleId: string) {
  return prisma.sale.findUnique({
    where: { id: saleId },
    select: { id: true, alegraInvoiceId: true, alegraInvoiceNumber: true },
  });
}
