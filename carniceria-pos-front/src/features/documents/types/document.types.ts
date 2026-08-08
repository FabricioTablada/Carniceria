// src/features/documents/types/document.types.ts
/**
 * features/documents/types/document.types.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.1 — Modelo base del Motor de Documentos (ERP-wide, no exclusivo de
 * Ventas). Este archivo define UNICAMENTE las formas de datos del motor.
 * Los bloques siguientes ya construyeron el resto sobre esta base: Registry
 * (13.2, backend), Builder de Ventas (13.3, `sales.receiptBuilder.ts`),
 * `DocumentRenderer` (13.4), impresion (13.6), PDF (13.7), integracion real
 * con `SaleReceiptDialog.tsx`/`SaleDetailContent.tsx` (13.5/13.10) — todo
 * consume estos mismos tipos, sin ninguno propio.
 *
 * Diseño (ver Bloque 12, "Arquitectura del Motor de Documentos"): estas
 * estructuras son deliberadamente GENERICAS — ningun campo aca representa un
 * concepto exclusivo de Ventas (nada de "cajero", "sucursal de venta",
 * "cliente de venta", etc. con ese nombre). Cualquier modulo del ERP (Ventas,
 * Compras, Caja, Inventario, Devoluciones, Cotizaciones, Pedidos, Notas de
 * credito, Notas de debito) debe poder producir un `DocumentData` valido sin
 * que este archivo sepa que ese modulo existe.
 *
 * Sin logica: solo `interface`/`type` — el Builder, el Registry y el
 * Renderer viven en sus propios archivos (ver arriba), nunca aca.
 */

/**
 * Identifica de que TIPO de documento se trata — el motor y el frontend
 * (botones/capacidades) razonan sobre esta union, nunca sobre el nombre de un
 * modulo especifico. Lista inicial cerrada a los 9 tipos de documento
 * mencionados en el objetivo del bloque; se amplia agregando un valor mas
 * aca, sin tocar el resto de las estructuras genericas.
 */
export type DocumentType =
  | 'SALE_RECEIPT'
  | 'PURCHASE_ORDER'
  | 'CASH_MOVEMENT'
  | 'INVENTORY_MOVEMENT'
  | 'RETURN'
  | 'QUOTE'
  | 'ORDER'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'

/**
 * Que acciones tienen sentido para un `DocumentType` dado. El frontend
 * siempre muestra las mismas 6 acciones (vista previa/imprimir/PDF/factura
 * electronica/XML/reenviar) para cualquier documento del ERP — nunca las
 * oculta — y usa estas banderas unicamente para decidir cuales quedan
 * habilitadas. Todas booleanas, sin excepciones ni casos especiales por tipo.
 */
export interface DocumentCapabilities {
  preview: boolean
  print: boolean
  pdf: boolean
  electronicInvoice: boolean
  xml: boolean
  email: boolean
}

/**
 * Descriptor de UN tipo de documento: como se llama para mostrarlo en UI y
 * que puede hacerse con el. No referencia ningun Builder ni ninguna entidad
 * de dominio concreta — eso se resuelve en el Registry (backend,
 * `modules/documents/documents.registry.ts`), no en el tipo en si.
 */
export interface DocumentDefinition {
  type: DocumentType
  /** Nombre para mostrar en UI, ej. "Comprobante de venta", "Orden de compra". */
  label: string
  capabilities: DocumentCapabilities
}

/**
 * Una linea de un documento (producto, servicio, concepto de un movimiento de
 * caja, etc.) — generica a proposito: "label" en vez de "nombre de
 * producto", "unit" opcional en vez de asumir siempre una unidad de medida.
 */
export interface DocumentItem {
  label: string
  quantity: number
  unit?: string
  unitPrice: number
  discount?: number
  /** Porcentaje único del descuento de esta línea, cuando es determinable
   * sin ambigüedad (una sola fuente de descuento, de tipo porcentual) —
   * `null`/ausente cuando no aplica, en cuyo caso solo se muestra
   * `discount` (el monto). Mismo criterio que `SaleDetailContent.tsx`/
   * `SalesTable.tsx` (ver `features/sales/utils/saleDiscount.ts`). */
  discountPercent?: number | null
  subtotal: number
  tax?: {
    label: string
    rate: number
    amount: number
  } | null
  total: number
}

/** Totales agregados de un documento — mismos 4 numeros para cualquier tipo. */
export interface DocumentTotals {
  subtotal: number
  discount?: number
  /** Mismo criterio que `DocumentItem.discountPercent`, a nivel del
   * documento completo. */
  discountPercent?: number | null
  tax?: number
  total: number
}

/** Un pago aplicado al documento. Arreglo (no un campo unico) para soportar
 * pagos mixtos de entrada — el mismo concepto aplica tanto a una venta como,
 * a futuro, a un movimiento de caja o una compra pagada parcialmente. */
export interface DocumentPayment {
  method: string
  amount: number
  reference?: string | null
}

/** Quien EMITE el documento — el punto de emision (sucursal, almacen, caja,
 * lo que corresponda segun el tipo de documento), nunca "sucursal de venta"
 * especificamente. */
export interface DocumentCompany {
  name: string
  identifier?: string | null
  address?: string | null
  location?: string | null
}

/** La contraparte del documento — en una venta seria el cliente, en una
 * compra el proveedor, en una devolucion el mismo cliente de la venta
 * original. Nombre generico a proposito. */
export interface DocumentCustomer {
  name: string
  identifier?: string | null
}

/**
 * Escotilla de escape: datos especificos de UN tipo de documento que no
 * entran en la forma generica de arriba (ej. clave/consecutivo de Hacienda
 * para una factura electronica, o el id de la entidad de origen) — sin esto,
 * cada tipo de documento nuevo forzaria a agregar campos opcionales a
 * `DocumentData` que solo tienen sentido para el. `Record<string, unknown>`:
 * quien lo escribe (un Builder, ej. `saleReceiptBuilder` en el backend) y
 * quien lo lee (una vista especifica) son los unicos que conocen sus
 * claves reales.
 */
export type DocumentMetadata = Record<string, unknown>

/**
 * Forma completa y GENERICA de un documento del ERP — la salida de
 * cualquier Builder (ej. `saleReceiptBuilder`, backend) y la entrada de
 * `DocumentRenderer` (vista previa, impresion) y `documents.pdf.ts` (PDF),
 * ambos ya implementados. Ningun campo de esta interfaz es exclusivo de
 * Ventas.
 */
export interface DocumentData {
  document: {
    type: DocumentType
    /** Numero de documento generico (ej. consecutivo interno) — `null` si
     * el documento todavia no tiene uno asignado. */
    number: string | null
    /** Etiqueta de estado YA resuelta a texto legible — quien construye
     * `DocumentData` traduce el enum de su propio dominio, este tipo no
     * conoce ningun enum de negocio. */
    status: string
    issuedAt: string
    reference: string | null
  }
  company: DocumentCompany
  customer: DocumentCustomer
  /** Quien genero el documento (cajero, usuario comprador, responsable de
   * un movimiento de caja, etc.) — deliberadamente el tipo mas simple
   * posible, sin campo dedicado propio por no requerirlo el bloque. */
  issuedBy: {
    name: string
  }
  items: DocumentItem[]
  totals: DocumentTotals
  payments?: DocumentPayment[]
  footer?: {
    notes?: string | null
    legalText?: string | null
  }
  metadata: DocumentMetadata
}
