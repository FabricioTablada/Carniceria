/**
 * modules/sales/sales.receiptBuilder.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.3 — primer consumidor real del Motor de Documentos. Transforma
 * una `SaleResponse` (la forma que ya expone `sales.service.ts`) en
 * `DocumentData`, la forma generica del motor — implementa
 * `DocumentBuilder<SaleResponse>` (`modules/documents`, API publica).
 *
 * Completamente puro: no consulta Prisma, no hace llamadas HTTP, no accede
 * a ningun servicio externo. Recibe la venta YA CARGADA — quien lo invoque
 * (bloque futuro) es responsable de haberla resuelto por su cuenta.
 *
 * Sin logica de presentacion: la fecha se serializa a ISO (`toISOString()`,
 * el mismo criterio que ya usa toda la API para cruzar la frontera JSON —
 * no es un formato de VISUALIZACION) y los montos quedan como `number`
 * crudos, sin `Intl.NumberFormat` ni simbolo de moneda — eso es
 * responsabilidad de `DocumentRenderer.tsx`/`documents.pdf.ts` (ya
 * implementados), no de este Builder.
 *
 * Bloque 13.12 (fix): `sale.saleDate` esta tipado `Date` (`SaleResponse`,
 * cuando este builder corre dentro del propio backend con una venta recien
 * leida de Prisma) — pero este builder tambien se invoca desde
 * `POST /documents/pdf` (`documents.controller.ts`), donde `source` viaja
 * como JSON desde el frontend: ahi `saleDate` llega como STRING (el
 * frontend tipa `Sale.saleDate: string`, no hay tipo `Date` en JSON). Con
 * el `.toISOString()` de antes, sobre un string, `sale.saleDate.toISOString`
 * no existe -> `TypeError` sin capturar, que el `errorHandler` global
 * traducia a un 500 generico (por eso "Descargar PDF" fallaba siempre,
 * pero `window.print()` no: la impresion usa el builder DEL FRONTEND,
 * `saleReceiptBuilder.ts`, que nunca llama `.toISOString()` porque ya
 * recibe un string). `new Date(sale.saleDate)` acepta tanto un `Date` como
 * un string ISO — funciona para los dos origenes reales de `source`.
 *
 * Bloque 13.14 (fix de consistencia): `PAYMENT_METHOD_LABELS` (mas abajo)
 * — el metodo de pago tambien se traduce aca ahora, mismas etiquetas que
 * el builder del frontend, para que vista previa/impresion/PDF muestren
 * siempre el mismo texto para la misma venta.
 */
import type { DocumentBuilder, DocumentData } from '@/modules/documents';
import type { SaleAppliedPromotionResponse, SaleItemResponse, SaleResponse } from './types';

/**
 * Bloque "consistencia de descuentos" — mismo criterio EXACTO que
 * `features/sales/utils/saleDiscount.ts` (frontend): `SaleItemResponse.discount`
 * es EXCLUSIVAMENTE el descuento manual de esa linea; el monto de una
 * promocion automatica solo vive en `SaleAppliedPromotionResponse.amountApplied`
 * (filtrado por `saleItemId` para una linea puntual, o la suma completa
 * para toda la venta). Reimplementado aca (no importado desde el
 * frontend: este builder corre en el backend) para que
 * comprobante/impresion/PDF muestren el mismo monto/porcentaje que el
 * detalle/historial/reporte — ningun calculo de negocio nuevo, solo se
 * suman valores que `sales.service.ts`/el motor de promociones ya
 * persistieron.
 */
function isPercentagePromotion(promotion: SaleAppliedPromotionResponse): boolean {
  return promotion.effectType
    ? promotion.effectType === 'PERCENTAGE'
    : promotion.discountType === 'PERCENTAGE';
}

function getLineItemDiscount(
  item: SaleItemResponse,
  appliedPromotions: SaleAppliedPromotionResponse[],
): { amount: number; percent: number | null } {
  const linePromotions = appliedPromotions.filter((promotion) => promotion.saleItemId === item.id);
  const promotionAmount = linePromotions.reduce((sum, promotion) => sum + promotion.amountApplied, 0);
  const amount = item.discount + promotionAmount;

  const percent =
    item.discount === 0 && linePromotions.length === 1 && isPercentagePromotion(linePromotions[0])
      ? linePromotions[0].discountValue
      : null;

  return { amount, percent };
}

function getSaleTotalDiscount(
  items: SaleItemResponse[],
  appliedPromotions: SaleAppliedPromotionResponse[],
): { amount: number; percent: number | null } {
  const lineDiscountTotal = items.reduce((sum, item) => sum + item.discount, 0);
  const promotionAmountTotal = appliedPromotions.reduce((sum, promotion) => sum + promotion.amountApplied, 0);
  const amount = lineDiscountTotal + promotionAmountTotal;

  const percent =
    lineDiscountTotal === 0 &&
    appliedPromotions.length === 1 &&
    isPercentagePromotion(appliedPromotions[0])
      ? appliedPromotions[0].discountValue
      : null;

  return { amount, percent };
}

/** Traduccion de datos (enum interno -> etiqueta), no logica de
 * presentacion: `DocumentData.document.status` esta tipado como texto ya
 * legible a proposito — el motor no conoce ningun enum de dominio (ver
 * `documents.types.ts`), asi que quien construye el documento es quien
 * tiene que resolver esto. */
const STATUS_LABELS: Record<SaleResponse['status'], string> = {
  COMPLETED: 'Completada',
  CANCELLED: 'Anulada',
  REFUNDED: 'Reembolsada',
};

/**
 * Bloque 13.14 (fix de consistencia): mismo criterio que `STATUS_LABELS`
 * — `DocumentPayment.method` es texto libre a proposito (el motor no
 * conoce el enum `PaymentMethod`), asi que este Builder es quien tiene
 * que traducirlo. Antes NO se traducia aca (quedaba el valor crudo,
 * "CASH") mientras que el builder espejo del frontend
 * (`features/sales/utils/saleReceiptBuilder.ts`) SI lo traducia
 * ("Efectivo") — la misma venta mostraba un metodo de pago distinto segun
 * si se miraba en pantalla/impresion o en el PDF descargado. Mismas
 * etiquetas EXACTAS que `PAYMENT_METHOD_OPTIONS` (frontend,
 * `features/sales/utils/payment.ts`) para que los tres canales
 * (vista previa/impresion/PDF) digan lo mismo. */
const PAYMENT_METHOD_LABELS: Record<SaleResponse['paymentMethod'], string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  SINPE_MOVIL: 'SINPE Móvil',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
};

export const saleReceiptBuilder: DocumentBuilder<SaleResponse> = {
  build(sale: SaleResponse): DocumentData {
    return {
      document: {
        type: 'SALE_RECEIPT',
        number: sale.documentNumber,
        status: STATUS_LABELS[sale.status] ?? sale.status,
        issuedAt: new Date(sale.saleDate).toISOString(),
        reference: sale.paymentReference,
      },
      company: {
        name: sale.sucursal.name,
        identifier: sale.sucursal.code,
        address: null,
        location: null,
      },
      // Bloque 8.3: usa el cliente real asociado a la venta (modulo de
      // Clientes, Bloque 8.2) cuando existe — "Publico General" sigue
      // siendo el valor por defecto (`sale.customer === null`), mismo
      // criterio que antes de este bloque, ya no por falta de modelo de
      // datos sino porque nadie selecciono un cliente en esa venta.
      customer: sale.customer
        ? { name: sale.customer.name, identifier: sale.customer.identificationNumber }
        : { name: 'Público General' },
      issuedBy: {
        name: sale.user.fullName,
      },
      items: sale.items.map((item) => {
        const discount = getLineItemDiscount(item, sale.appliedPromotions);

        return {
          label: item.product.name,
          quantity: item.quantity,
          unit: item.product.unitOfMeasure,
          unitPrice: item.unitPrice,
          discount: discount.amount,
          discountPercent: discount.percent,
          subtotal: item.lineSubtotal,
          tax: item.tax
            ? {
                label: item.tax.name,
                rate: item.taxRate,
                amount: item.lineTax,
              }
            : null,
          total: item.lineTotal,
        };
      }),
      totals: (() => {
        const discount = getSaleTotalDiscount(sale.items, sale.appliedPromotions);

        return {
          subtotal: sale.subtotal,
          discount: discount.amount,
          discountPercent: discount.percent,
          tax: sale.taxTotal,
          total: sale.total,
        };
      })(),
      payments: [
        {
          method: PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
          amount: sale.amountPaid,
          reference: sale.paymentReference,
        },
      ],
      footer: {
        notes: sale.notes,
        legalText: null,
      },
      metadata: {
        saleId: sale.id,
        cashSessionId: sale.cashSessionId,
        changeGiven: sale.changeGiven,
      },
    };
  },
};
