/**
 * modules/invoicing/invoicing.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de facturacion electronica.
 * Define unicamente formas de datos; no contiene logica de negocio, acceso
 * a base de datos, ni construccion de XML (eso vive en `service.ts`,
 * `repository.ts` e `invoicing.xml.builder.ts` respectivamente, todos
 * bloques posteriores del roadmap).
 *
 * NOTA DE ALCANCE: alineado con el modelo `Invoice` ya agregado a
 * `schema.prisma` y con `TiqueteElectronicoData` de
 * `invoicing.xml.builder.ts` — no introduce ningun campo nuevo que esos
 * dos archivos no respalden.
 */

/** Espejo del enum `InvoiceStatus` de `schema.prisma`. */
export type InvoiceStatus = 'PENDIENTE' | 'ENVIADO' | 'ACEPTADO' | 'RECHAZADO' | 'ERROR';

/** Forma publica de un comprobante electronico ya persistido. */
export interface InvoiceResponse {
  id: string;
  saleId: string;
  /** Clave numerica de 50 digitos (ver `invoicing.numbering.ts`). */
  clave: string;
  /** Consecutivo de 20 digitos (ver `invoicing.numbering.ts`). */
  consecutivo: string;
  /** XML sin firmar (ver `invoicing.xml.builder.ts`). */
  xml: string;
  /** XML firmado (XAdES). `null` hasta que exista el bloque de firma
   * digital — todavia no implementado. */
  xmlFirmado: string | null;
  /** Respuesta cruda de la API de Hacienda. `null` hasta que exista el
   * bloque de envio — todavia no implementado. */
  respuestaHacienda: string | null;
  status: InvoiceStatus;
  fechaEmision: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Datos minimos de una venta que este modulo necesita leer para construir
 * un comprobante. Deliberadamente un subconjunto de `Sale` (solo lectura):
 * este modulo no importa el tipo completo de Sales, para no acoplarse a
 * los detalles internos de ese modulo (mismo criterio de desacople ya
 * aplicado en `invoicing.numbering.ts`/`invoicing.xml.builder.ts`, que
 * tampoco dependen de ningun tipo de Sales).
 */
export interface SaleForInvoicing {
  id: string;
  sucursalId: string;
  saleDate: Date;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  items: SaleItemForInvoicing[];
}

/**
 * Datos minimos de una linea de venta (`SaleItem` + `Product` relacionado)
 * necesarios para una linea de `LineaDetalle` del XML.
 *
 * HALLAZGO DE ALCANCE, documentado y no resuelto en este bloque: Hacienda
 * exige un codigo CABYS de 13 digitos por linea (`LineaDetalle.codigoCabys`
 * en `invoicing.xml.builder.ts`), pero el modelo `Product` de
 * `schema.prisma` no tiene ningun campo para ese codigo hoy. Este tipo
 * declara `codigoCabys` como parte del contrato porque el XML lo exige,
 * pero de donde sale ese valor en la practica (nuevo campo en `Product`,
 * tabla de mapeo aparte, u otro mecanismo) es una decision pendiente, para
 * cuando se implemente `repository.ts`.
 */
export interface SaleItemForInvoicing {
  productId: string;
  productName: string;
  /** Codigo CABYS de 13 digitos. Ver hallazgo de alcance arriba. */
  codigoCabys: string;
  /** Unidad de medida ya traducida al codigo que exige Hacienda (no el
   * valor crudo del enum `UnitOfMeasure` de Prisma) — esa traduccion es
   * logica, no forma parte de este archivo. */
  unidadMedida: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}