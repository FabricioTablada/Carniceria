import type { DocumentData } from '@/features/documents/types/document.types'
import type { Purchase } from '../types/purchase.types'

const STATUS_LABELS: Record<Purchase['status'], string> = {
  DRAFT: 'Borrador',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
}

/**
 * features/purchases/utils/purchaseOrderBuilder.ts
 * -----------------------------------------------------------------------------
 * Espejo en el frontend de `purchases.orderBuilder.ts` (backend,
 * `modules/purchases/`) — mismo criterio que
 * `features/sales/utils/saleReceiptBuilder.ts`: la compra ya está cargada
 * en memoria (`usePurchase`, detalle de compra) así que la vista previa se
 * arma localmente, sin ningún viaje de red adicional; "Descargar PDF" sigue
 * yendo al backend (`documentsApi.downloadPdf`), que reconstruye el mismo
 * `DocumentData` de forma autoritativa y valida el permiso
 * ("purchases.view") antes de generarlo.
 *
 * Puro: sin llamadas a la API, sin hooks, sin efectos secundarios.
 */
export function buildPurchaseOrderDocumentData(purchase: Purchase): DocumentData {
  return {
    document: {
      type: 'PURCHASE_ORDER',
      number: purchase.documentNumber,
      status: STATUS_LABELS[purchase.status] ?? purchase.status,
      issuedAt: purchase.purchaseDate,
      reference: null,
    },
    company: {
      name: purchase.sucursal.name,
      identifier: purchase.sucursal.code,
      address: null,
      location: null,
    },
    customer: {
      name: purchase.supplier.name,
    },
    issuedBy: {
      name: purchase.user.fullName,
    },
    items: purchase.items.map((item) => ({
      label: item.product.name,
      quantity: item.quantity,
      unit: item.product.unitOfMeasure,
      unitPrice: item.unitCost,
      subtotal: item.lineSubtotal,
      tax: item.tax
        ? {
            label: item.tax.name,
            rate: item.taxRate,
            amount: item.lineTax,
          }
        : null,
      total: item.lineTotal,
    })),
    totals: {
      subtotal: purchase.subtotal,
      tax: purchase.taxTotal,
      total: purchase.total,
    },
    footer: {
      notes: purchase.notes,
      legalText: null,
    },
    metadata: {
      purchaseId: purchase.id,
      supplierId: purchase.supplierId,
    },
  }
}
