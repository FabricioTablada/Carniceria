/**
 * modules/documents/documents.types.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.2 — Motor de Documentos (ERP-wide, no exclusivo de Ventas).
 * Modelo base (Bloque 13.1, replicado aca — el backend no importa tipos del
 * frontend, mismo criterio que el resto del proyecto: cada lado mantiene su
 * propia copia, misma forma) mas `DocumentBuilder<T>`, la unica pieza de
 * comportamiento (una interfaz, no una implementacion) que agrega este
 * bloque.
 *
 * Nada de este archivo depende de Sales/Purchases/Cash/Inventory ni de
 * Prisma — son formas de datos puras.
 */

/** Identifica de que TIPO de documento se trata. Lista cerrada a los 9 tipos
 * ya previstos; se amplia agregando un valor mas aca cuando haga falta. */
export type DocumentType =
  | 'SALE_RECEIPT'
  | 'PURCHASE_ORDER'
  | 'CASH_MOVEMENT'
  | 'INVENTORY_MOVEMENT'
  | 'RETURN'
  | 'QUOTE'
  | 'ORDER'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

/** Que acciones tienen sentido para un `DocumentType` dado — el frontend
 * siempre muestra las mismas 6 acciones y usa esto solo para decidir cuales
 * quedan habilitadas, nunca para ocultar ninguna. */
export interface DocumentCapabilities {
  preview: boolean;
  print: boolean;
  pdf: boolean;
  electronicInvoice: boolean;
  xml: boolean;
  email: boolean;
}

/** Descriptor de UN tipo de documento — como se llama en UI y que puede
 * hacerse con el. No referencia ningun Builder ni entidad de dominio
 * concreta: esa asociacion vive en el Registry, no en el tipo.
 *
 * `requiredPermission` (hallazgo de seguridad #2, auditoria 31/07/2026):
 * codigo de permiso (mismo catalogo que `authorizePermission`) que el
 * usuario debe tener para generar ESTE tipo de documento. Antes
 * `POST /documents/pdf` no exigia ningun permiso puntual porque confiaba en
 * que `source` ya habia sido cargado (y por lo tanto autorizado) por quien
 * invocaba — pero el motor nunca revalidaba eso, permitiendo fabricar un
 * `source` arbitrario. Ahora el motor vuelve a cargar la entidad por su
 * cuenta (ver `DocumentSourceLoader`) y por eso necesita saber, el mismo,
 * que permiso exigir antes de hacerlo. */
export interface DocumentDefinition {
  type: DocumentType;
  label: string;
  capabilities: DocumentCapabilities;
  requiredPermission: string;
}

/** Una linea de un documento — generica: "label" en vez de "nombre de
 * producto", "unit" opcional en vez de asumir una unidad de medida fija. */
export interface DocumentItem {
  label: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  /** Porcentaje unico del descuento de esta linea, cuando es determinable
   * sin ambiguedad (una sola fuente de descuento, de tipo porcentual) —
   * `null`/ausente cuando no aplica, en cuyo caso solo se muestra
   * `discount` (el monto). Mismo criterio que el frontend
   * (`features/sales/utils/saleDiscount.ts`). */
  discountPercent?: number | null;
  subtotal: number;
  tax?: {
    label: string;
    rate: number;
    amount: number;
  } | null;
  total: number;
}

/** Totales agregados de un documento — mismos 4 numeros para cualquier tipo. */
export interface DocumentTotals {
  subtotal: number;
  discount?: number;
  /** Mismo criterio que `DocumentItem.discountPercent`, a nivel del
   * documento completo. */
  discountPercent?: number | null;
  tax?: number;
  total: number;
}

/** Un pago aplicado al documento. Arreglo (no un campo unico): soporta pagos
 * mixtos, aplica igual a una venta, una compra o un movimiento de caja. */
export interface DocumentPayment {
  method: string;
  amount: number;
  reference?: string | null;
}

/** Quien EMITE el documento — el punto de emision (sucursal, almacen, caja,
 * segun corresponda), nunca "sucursal de venta" especificamente. */
export interface DocumentCompany {
  name: string;
  identifier?: string | null;
  address?: string | null;
  location?: string | null;
}

/** La contraparte del documento — cliente en una venta, proveedor en una
 * compra, el mismo cliente de la venta original en una devolucion. */
export interface DocumentCustomer {
  name: string;
  identifier?: string | null;
}

/** Escotilla de escape: datos especificos de UN tipo de documento que no
 * entran en la forma generica (ej. clave/consecutivo de Hacienda para una
 * factura electronica, o el id de la entidad de origen). Quien la escribe
 * (un Builder) y quien la lee (una vista especifica) son los unicos que
 * conocen sus claves reales. */
export type DocumentMetadata = Record<string, unknown>;

/** Forma completa y GENERICA de un documento del ERP — la salida de
 * cualquier `DocumentBuilder` y, mas adelante, la entrada de cualquier
 * renderizado (vista previa, impresion, PDF). Ningun campo exclusivo de
 * Ventas. */
export interface DocumentData {
  document: {
    type: DocumentType;
    number: string | null;
    /** Etiqueta de estado YA resuelta a texto legible — quien construye
     * `DocumentData` traduce el enum de su propio dominio; este tipo no
     * conoce ningun enum de negocio. */
    status: string;
    issuedAt: string;
    reference: string | null;
  };
  company: DocumentCompany;
  customer: DocumentCustomer;
  issuedBy: {
    name: string;
  };
  items: DocumentItem[];
  totals: DocumentTotals;
  payments?: DocumentPayment[];
  footer?: {
    notes?: string | null;
    legalText?: string | null;
  };
  metadata: DocumentMetadata;
}

/**
 * Transforma UNA entidad de dominio (`T` — `Sale`, `Purchase`, etc., nunca
 * conocida por el motor) en `DocumentData`. Cada modulo dueño implementa la
 * suya (ej. `saleReceiptBuilder`, `modules/sales/sales.receiptBuilder.ts`,
 * ya implementado) y la registra en `DocumentRegistry` — el motor solo
 * conoce esta interfaz.
 *
 * Debe ser puro: sin consultas a Prisma, sin llamadas HTTP, sin ningun
 * efecto secundario. Recibe la entidad YA CARGADA por quien lo invoca.
 */
export interface DocumentBuilder<T> {
  build(source: T): DocumentData;
}

/**
 * Recupera la entidad de dominio `T` correspondiente a un `DocumentType`, a
 * partir UNICAMENTE de su `id` (hallazgo de seguridad #2, auditoria
 * 31/07/2026). Cada modulo dueño implementa el suyo reutilizando su propio
 * service (ej. `salesService.findById`, `modules/sales/index.ts`) y lo
 * registra junto a su `DocumentBuilder` — el motor nunca construye la
 * consulta, solo la invoca. Debe lanzar si la entidad no existe (mismo
 * criterio que el resto de los `findById` del proyecto).
 *
 * Reemplaza el diseño anterior, donde `source` viajaba completo desde el
 * cliente y nunca se revalidaba contra la base de datos.
 */
export type DocumentSourceLoader<T> = (id: string) => Promise<T>;
