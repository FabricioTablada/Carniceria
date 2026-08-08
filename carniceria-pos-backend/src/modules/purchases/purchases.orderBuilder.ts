/**
 * modules/purchases/purchases.orderBuilder.ts
 * -----------------------------------------------------------------------------
 * Motor de Documentos (`PURCHASE_ORDER`) -- espejo exacto de
 * `modules/sales/sales.receiptBuilder.ts` (primer y unico consumidor real
 * hasta ahora): transforma un `PurchaseResponse` (la forma que ya expone
 * `purchases.service.ts`) en `DocumentData`, la forma generica del motor --
 * implementa `DocumentBuilder<PurchaseResponse>` (`modules/documents`, API
 * publica).
 *
 * Completamente puro: no consulta Prisma, no hace llamadas HTTP, no accede a
 * ningun servicio externo. Recibe la compra YA CARGADA -- quien lo invoque
 * (`documents.service.ts`, via el `DocumentSourceLoader` registrado en
 * `modules/purchases/index.ts`) es responsable de haberla resuelto.
 *
 * Sin logica de presentacion: la fecha se serializa a ISO (mismo criterio
 * que `sales.receiptBuilder.ts`) y los montos quedan como `number` crudos --
 * eso es responsabilidad de `DocumentRenderer.tsx`/`documents.pdf.ts` (ya
 * implementados), no de este Builder.
 */
import type { DocumentBuilder, DocumentData } from '@/modules/documents';
import type { PurchaseResponse } from './types';

/** Traduccion de datos (enum interno -> etiqueta), mismo criterio que
 * `STATUS_LABELS` de `sales.receiptBuilder.ts` -- el motor no conoce ningun
 * enum de dominio (ver `documents.types.ts`). */
const STATUS_LABELS: Record<PurchaseResponse['status'], string> = {
  DRAFT: 'Borrador',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
};

export const purchaseOrderBuilder: DocumentBuilder<PurchaseResponse> = {
  build(purchase: PurchaseResponse): DocumentData {
    return {
      document: {
        type: 'PURCHASE_ORDER',
        number: purchase.documentNumber,
        status: STATUS_LABELS[purchase.status] ?? purchase.status,
        issuedAt: new Date(purchase.purchaseDate).toISOString(),
        reference: null,
      },
      company: {
        name: purchase.sucursal.name,
        identifier: purchase.sucursal.code,
        address: null,
        location: null,
      },
      // La contraparte de una compra es el PROVEEDOR, no un cliente --
      // mismo campo generico (`DocumentCustomer`) que Ventas usa para
      // "Publico General" (`documents.types.ts`: "cliente en una venta,
      // proveedor en una compra").
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
    };
  },
};
