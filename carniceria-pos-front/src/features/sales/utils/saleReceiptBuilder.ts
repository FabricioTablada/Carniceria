import type { DocumentData } from '@/features/documents/types/document.types'
import { PAYMENT_METHOD_OPTIONS } from './payment'
import { getLineItemDiscount, getSaleTotalDiscount } from './saleDiscount'
import type { Sale } from '../types/sale.types'

const STATUS_LABELS: Record<Sale['status'], string> = {
  COMPLETED: 'Completada',
  CANCELLED: 'Anulada',
  REFUNDED: 'Reembolsada',
}

/**
 * features/sales/utils/saleReceiptBuilder.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.5 — espejo en el frontend de `sales.receiptBuilder.ts` (backend,
 * `modules/sales/`): transforma un `Sale` (ya cargado, sin ninguna consulta
 * propia) en `DocumentData` — mismo mapeo, misma intencion, ver ese archivo
 * para la version que corre en el servidor.
 *
 * Por que existe una copia aca: el `DocumentBuilder` real
 * (`saleReceiptBuilder`, backend) es codigo de servidor puro — no hay forma
 * de importarlo desde este repo, y este bloque no crea ningun endpoint
 * nuevo para pedirle al backend el `DocumentData` ya construido. Hasta que
 * ese endpoint exista, el POS (que ya tiene el `Sale` completo en memoria
 * apenas se confirma la venta, sin ningun viaje de red adicional) construye
 * su propio `DocumentData` localmente, con el mismo mapeo.
 *
 * Puro: no consulta la API, no usa hooks, no tiene efectos secundarios —
 * mismo criterio de pureza que el builder del backend.
 */
export function buildSaleDocumentData(sale: Sale): DocumentData {
  const paymentMethodLabel =
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === sale.paymentMethod)?.label ??
    sale.paymentMethod

  return {
    document: {
      type: 'SALE_RECEIPT',
      number: sale.documentNumber,
      status: STATUS_LABELS[sale.status] ?? sale.status,
      issuedAt: sale.saleDate,
      reference: sale.paymentReference,
    },
    company: {
      name: sale.sucursal.name,
      identifier: sale.sucursal.code,
      address: null,
      location: null,
    },
    // Bloque 8.3: usa el cliente real asociado a la venta (módulo de
    // Clientes, Bloque 8.2) cuando existe — mismo criterio que
    // `sales.receiptBuilder.ts` (backend). "Público General" sigue siendo
    // el valor por defecto (`sale.customer === null`).
    customer: sale.customer
      ? { name: sale.customer.name, identifier: sale.customer.identificationNumber }
      : { name: 'Público General' },
    issuedBy: {
      name: sale.user.fullName,
    },
    items: sale.items.map((item) => {
      // Bloque "consistencia de descuentos": `item.discount` por si solo
      // es EXCLUSIVAMENTE el descuento manual de esa línea — se suma con
      // las promociones automáticas atadas a ella (misma lógica ya usada
      // en el detalle/historial, ver `utils/saleDiscount.ts`) para que el
      // comprobante impreso muestre el mismo monto/porcentaje.
      const discount = getLineItemDiscount(item, sale.appliedPromotions)

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
      }
    }),
    totals: (() => {
      const discount = getSaleTotalDiscount(sale.items, sale.appliedPromotions)

      return {
        subtotal: sale.subtotal,
        discount: discount.amount,
        discountPercent: discount.percent,
        tax: sale.taxTotal,
        total: sale.total,
      }
    })(),
    payments: [
      {
        method: paymentMethodLabel,
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
  }
}
