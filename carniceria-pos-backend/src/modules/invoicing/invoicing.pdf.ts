/**
 * modules/invoicing/invoicing.pdf.ts
 * -----------------------------------------------------------------------------
 * Genera la representacion grafica en PDF de un comprobante electronico
 * (Tiquete Electronico), a partir unicamente de los datos recibidos por
 * parametro. Sin acceso a base de datos, sin integracion con Hacienda, sin
 * envio de correo — esas responsabilidades viven en otros archivos del
 * modulo (`repository.ts`, `invoicing.hacienda.client.ts`,
 * `invoicing.mailer.ts` respectivamente).
 *
 * Reutiliza `TiqueteElectronicoData` de `invoicing.xml.builder.ts` como
 * forma de entrada — es el mismo comprobante que ya se uso para construir
 * el XML, no una copia duplicada de esos mismos campos.
 *
 * SOBRE LOS TIPOS DE `pdfkit`: el paquete no incluye declaraciones de
 * TypeScript propias, y no existe `@types/pdfkit` instalado (se verifico
 * antes de escribir este archivo: `import PDFDocument from 'pdfkit'` sin
 * tipos produce el error real TS7016). Declarar `pdfkit` como modulo
 * ambiental (`declare module 'pdfkit'`) tampoco funciona dentro de un
 * archivo `.ts` normal (produce TS2665: TypeScript no permite "aumentar"
 * un modulo sin ningun tipo previo fuera de un archivo `.d.ts` separado,
 * que seria un archivo nuevo). La alternativa que se usa aqui, sin
 * agregar ninguna dependencia ni ningun archivo nuevo, es tipar
 * localmente el resultado de `require('pdfkit')` — solo la porcion de la
 * API que este archivo usa, no una declaracion completa del paquete.
 */

import { Readable } from 'node:stream';
import type { EmisorData, LineaDetalle } from './invoicing.xml.builder';

interface PDFDocumentOptions {
  size?: string;
  margin?: number;
}

interface PDFTextOptions {
  align?: 'left' | 'center' | 'right';
}

interface PDFKitDocument extends Readable {
  fontSize(size: number): this;
  font(name: string): this;
  text(text: string, options?: PDFTextOptions): this;
  moveDown(lines?: number): this;
  end(): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as new (options?: PDFDocumentOptions) => PDFKitDocument;

/** Datos necesarios para generar el PDF. Mismo comprobante que
 * `invoicing.xml.builder.ts` usa para el XML — se reutiliza su forma para
 * no duplicar los mismos campos con otro nombre. */
export interface InvoicePdfData {
  clave: string;
  numeroConsecutivo: string;
  fechaEmision: Date;
  emisor: EmisorData;
  detalleServicio: LineaDetalle[];
  totalGravado: number;
  totalExento: number;
  totalVenta: number;
  totalDescuentos: number;
  totalVentaNeta: number;
  totalImpuesto: number;
  totalComprobante: number;
}

/** Formatea un monto en colones para su presentacion en el PDF (no exige
 * el formato de 5 decimales de Hacienda — eso es unicamente para el XML,
 * este es un documento para lectura humana). */
function formatColones(value: number): string {
  return `₡${value.toFixed(2)}`;
}

function buildLineaDetalleTexto(linea: LineaDetalle): string {
  return `${linea.cantidad} ${linea.unidadMedida}  x  ${linea.detalle}  —  ${formatColones(linea.montoTotalLinea)}`;
}

/**
 * Genera el PDF de la representacion grafica de un comprobante electronico
 * y devuelve sus bytes ya ensamblados. No escribe a disco, no depende de
 * ningun estado externo — el mismo `data` siempre produce el mismo PDF
 * (salvo la marca de tiempo interna que `pdfkit` agrega a los metadatos
 * del propio formato PDF, fuera del control de este archivo).
 */
export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (error: Error) => reject(error));

    doc.fontSize(14).font('Helvetica-Bold').text(data.emisor.nombre, { align: 'center' });

    if (data.emisor.nombreComercial) {
      doc.fontSize(10).font('Helvetica').text(data.emisor.nombreComercial, { align: 'center' });
    }

    doc.fontSize(9).font('Helvetica').text(`Cédula: ${data.emisor.numeroIdentificacion}`, { align: 'center' });
    doc.text(data.emisor.otrasSenas, { align: 'center' });
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text('TIQUETE ELECTRÓNICO');
    doc.fontSize(9).font('Helvetica');
    doc.text(`Clave: ${data.clave}`);
    doc.text(`Consecutivo: ${data.numeroConsecutivo}`);
    doc.text(`Fecha de emisión: ${data.fechaEmision.toLocaleString('es-CR')}`);
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('Detalle');
    doc.fontSize(9).font('Helvetica');

    for (const linea of data.detalleServicio) {
      doc.text(buildLineaDetalleTexto(linea));
    }

    doc.moveDown();

    doc.fontSize(9).font('Helvetica');
    doc.text(`Total gravado: ${formatColones(data.totalGravado)}`);
    doc.text(`Total exento: ${formatColones(data.totalExento)}`);
    doc.text(`Total venta: ${formatColones(data.totalVenta)}`);
    doc.text(`Total descuentos: ${formatColones(data.totalDescuentos)}`);
    doc.text(`Total venta neta: ${formatColones(data.totalVentaNeta)}`);
    doc.text(`Total impuesto: ${formatColones(data.totalImpuesto)}`);

    doc.moveDown();
    doc.fontSize(11).font('Helvetica-Bold').text(`TOTAL: ${formatColones(data.totalComprobante)}`);

    doc.end();
  });
}