/**
 * modules/documents/documents.pdf.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.7 — genera el PDF del COMPROBANTE INTERNO a partir,
 * unicamente, de `DocumentData` — la misma forma generica que consume
 * `DocumentRenderer` (frontend). Ningun campo de `Sale`/`Purchase`/etc.,
 * ninguna consulta a Prisma: recibe el documento YA CONSTRUIDO.
 *
 * Deliberadamente SEPARADO de `modules/invoicing/invoicing.pdf.ts` (el PDF
 * de la factura electronica/Tiquete de Hacienda) — no se importa nada de
 * ese modulo aca, ni al reves. Son dos documentos distintos con distinto
 * peso legal (ver Bloque 12, "Flujo de PDF"): este es el comprobante
 * interno generico del Motor de Documentos; el otro, cuando exista,
 * pertenece a la sub-area de facturacion electronica. Coincide que ambos
 * usan `pdfkit` (unica libreria de PDF del proyecto) y por eso repiten la
 * misma tecnica de tipado local (ver comentario abajo) — eso es
 * coincidencia de herramienta, no acoplamiento entre modulos.
 *
 * SOBRE LOS TIPOS DE `pdfkit`: el paquete no trae declaraciones de
 * TypeScript ni existe `@types/pdfkit` instalado — se tipa localmente solo
 * la porcion de la API que este archivo usa (mismo criterio ya usado en
 * `invoicing.pdf.ts`).
 *
 * Document Design System (autorizacion explicita y acotada del usuario:
 * "Autorizo modificar unicamente: modules/documents/documents.pdf.ts...
 * Unicamente modernizar el dibujo del PDF generado por pdfkit para que
 * tenga exactamente el mismo lenguaje visual que DocumentRenderer.tsx"):
 * este archivo pasa de una lista de `doc.text()` planos a un dibujo con
 * encabezado corporativo, tabla con columnas alineadas y bloque de
 * totales — replicando, con las primitivas de pdfkit (`rect`/`fill`/
 * `stroke`/posicionamiento por coordenadas), la MISMA composicion que
 * `DocumentRenderer.tsx` (frontend, Bloque 13.4 + este mismo bloque):
 * identidad de marca (`ERP_ORGANIZATION`, duplicada aqui a mano — no hay
 * forma de compartir codigo entre los dos repositorios), tipo de
 * documento traducido (`DOCUMENT_TYPE_LABELS`, mismo mapa que el
 * frontend), fechas via `Intl.DateTimeFormat('es-CR', ...)` (replica de
 * `src/utils/formatDateTime.ts`) en vez de ISO crudo, montos via
 * `Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'})`
 * (replica de `src/utils/formatCurrency.ts`, disponible en Node sin
 * paquetes adicionales) en vez de `₡${value.toFixed(2)}`, y el color de
 * marca aproximado a sRGB (`BRAND_COLOR = '#993333'`, calculado a mano
 * desde el token `--brand` = `oklch(0.4708 0.1367 24)` ya que pdfkit no
 * soporta oklch/variables CSS). CERO cambios de datos/calculo: mismos
 * campos de `DocumentData` de siempre, solo composicion visual.
 *
 * Revision tecnica posterior (fuente embebida): el usuario pidio
 * revisar si pdfkit podia mostrar el simbolo "₡" en vez del codigo
 * "CRC" usado en la primera version de este bloque. Se investigo y SI
 * es posible incorporando una fuente TrueType con el glifo (ver
 * `FONT_REGULAR`/`FONT_BOLD` mas abajo) — unica incorporacion de este
 * ajuste, sin tocar logica/datos/otros archivos.
 */
import { Readable } from 'node:stream';
import path from 'node:path';
import type { DocumentData, DocumentItem, DocumentPayment, DocumentType } from './documents.types';

interface PDFTextOptions {
  align?: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
  ellipsis?: boolean;
  lineBreak?: boolean;
  underline?: boolean;
}

interface PDFDocumentOptions {
  size?: string;
  margin?: number;
}

interface PDFKitDocument extends Readable {
  page: { width: number; height: number; margins: { top: number; bottom: number; left: number; right: number } };
  x: number;
  y: number;
  fontSize(size: number): this;
  font(name: string): this;
  registerFont(name: string, path: string): this;
  fillColor(color: string, opacity?: number): this;
  fillOpacity(opacity: number): this;
  strokeColor(color: string): this;
  lineWidth(width: number): this;
  rect(x: number, y: number, w: number, h: number): this;
  roundedRect(x: number, y: number, w: number, h: number, r: number): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  fill(color?: string): this;
  stroke(color?: string): this;
  text(text: string, x: number, y: number, options?: PDFTextOptions): this;
  text(text: string, options?: PDFTextOptions): this;
  moveDown(lines?: number): this;
  addPage(): this;
  end(): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as new (options?: PDFDocumentOptions) => PDFKitDocument;

/**
 * Fuente embebida (revision tecnica posterior al Bloque 13.7 original):
 * las 14 fuentes estandar de pdfkit (Helvetica, Times, etc.) usan
 * WinAnsiEncoding, que NO incluye el signo de colon costarricense
 * (U+20A1, "₡") — con ellas, pdfkit dibuja un glifo incorrecto en vez del
 * simbolo. `dejavu-fonts-ttf` (dependencia nueva, unica incorporacion no
 * puramente visual de este bloque, autorizada explicitamente por el
 * usuario: "unicamente incorporando una fuente adecuada al motor de
 * documentos") trae DejaVu Sans en formato TrueType — verificado con
 * `fontkit` (la libreria de parseo de fuentes que `pdfkit` ya trae como
 * dependencia propia) que SI tiene un glifo real para U+20A1, ademas de
 * cobertura completa de los caracteres acentuados del espanol. Licencia
 * Bitstream Vera (permisiva, permite uso y redistribucion comercial —
 * ver `node_modules/dejavu-fonts-ttf/LICENSE`).
 *
 * `doc.registerFont`/`doc.font` con una ruta a un .ttf es la forma
 * soportada por pdfkit de usar una fuente propia (no es un workaround);
 * se resuelve via `require.resolve('dejavu-fonts-ttf/package.json')`
 * para no depender de la estructura interna de `node_modules` en tiempo
 * de build/ejecucion.
 */
const FONT_REGULAR = 'DocumentBody';
const FONT_BOLD = 'DocumentBody-Bold';
const dejaVuPackageDir = path.dirname(require.resolve('dejavu-fonts-ttf/package.json'));
const FONT_REGULAR_PATH = path.join(dejaVuPackageDir, 'ttf', 'DejaVuSans.ttf');
const FONT_BOLD_PATH = path.join(dejaVuPackageDir, 'ttf', 'DejaVuSans-Bold.ttf');

/** Aproximacion sRGB del token `--brand` (`oklch(0.4708 0.1367 24)`) —
 * pdfkit no puede consumir oklch ni variables CSS, ver nota de bloque
 * arriba. Unica fuente de color de marca en este archivo. */
const BRAND_COLOR = '#993333';
const INK_COLOR = '#1f1f1f';
const MUTED_COLOR = '#6b6b6b';
const BORDER_COLOR = '#e2e2e2';
const PANEL_COLOR = '#f6f5f4';

const MARGIN = 40;

/** Mismo mapa que `DOCUMENT_TYPE_LABELS` en
 * `src/features/documents/components/DocumentRenderer.tsx` (frontend) —
 * duplicado a mano porque ambos repositorios no comparten codigo. Si se
 * agrega un `DocumentType` nuevo, actualizar ambos archivos. */
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SALE_RECEIPT: 'Comprobante de Venta',
  PURCHASE_ORDER: 'Orden de Compra',
  CASH_MOVEMENT: 'Movimiento de Caja',
  INVENTORY_MOVEMENT: 'Movimiento de Inventario',
  RETURN: 'Devolución',
  QUOTE: 'Cotización',
  ORDER: 'Pedido',
  CREDIT_NOTE: 'Nota de Crédito',
  DEBIT_NOTE: 'Nota de Débito',
};

/** Identidad corporativa fija — mismo valor que
 * `src/features/documents/constants/organization.ts` (frontend),
 * duplicado a mano por la misma razon de arriba. */
const ERP_ORGANIZATION = {
  name: 'Carnicería Pollo y Más',
};

/** Identico a `src/utils/formatCurrency.ts` (frontend) — mismo
 * locale/moneda/simbolo. Antes de embeber `FONT_REGULAR`/`FONT_BOLD`
 * (ver arriba) esto tenia que degradar a `currencyDisplay: 'code'`
 * ("CRC 1 500,00") porque las fuentes estandar de pdfkit no pueden
 * dibujar el simbolo "₡"; con DejaVu Sans embebida ya no hace falta —
 * PDF e impresion vuelven a mostrar exactamente el mismo formato. */
function formatAmount(value: number): string {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(value);
}

/** Replica de `src/utils/formatDateTime.ts` — mismo locale/zona/formato,
 * `'—'` para fechas invalidas. */
function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/Costa_Rica',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Replica de `formatDiscount()` en `DocumentRenderer.tsx`. */
function formatDiscount(amount?: number, percent?: number | null): string {
  if (!amount) {
    return '—';
  }
  return percent != null ? `${percent}% · -${formatAmount(amount)}` : `-${formatAmount(amount)}`;
}

/** Salta de pagina si lo que falta por dibujar no entra en el espacio
 * restante — el resto del archivo dibuja por coordenadas absolutas (no
 * flujo automatico de `doc.text`), asi que esta es la unica forma de
 * evitar contenido cortado a la mitad entre paginas. */
function ensureSpace(doc: PDFKitDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

interface TableColumns {
  label: number;
  labelW: number;
  qty: number;
  qtyW: number;
  price: number;
  priceW: number;
  discount: number;
  discountW: number;
  tax: number;
  taxW: number;
  total: number;
  totalW: number;
}

/** Anchos calibrados para que "CRC 12 345,00" (el formato mas largo que
 * puede aparecer, ver nota de `formatAmount`) quepa en una sola linea en
 * cualquier columna numerica — el resto del espacio va a la descripcion.
 * Cualquier celda que aun asi no quepa se trunca con elipsis (ver
 * `drawItemRow`) en vez de desbordar sobre la fila siguiente. */
function buildColumns(contentWidth: number): TableColumns {
  const qtyW = 48;
  const priceW = 88;
  const discountW = 90;
  const taxW = 78;
  const totalW = 78;
  const labelW = contentWidth - (qtyW + priceW + discountW + taxW + totalW);

  const label = MARGIN;
  const qty = label + labelW;
  const price = qty + qtyW;
  const discount = price + priceW;
  const tax = discount + discountW;
  const total = tax + taxW;

  return { label, labelW, qty, qtyW, price, priceW, discount, discountW, tax, taxW, total, totalW };
}

function drawHeader(doc: PDFKitDocument, data: DocumentData, contentWidth: number): void {
  const typeLabel = DOCUMENT_TYPE_LABELS[data.document.type] ?? data.document.type;
  const top = doc.y;

  doc.fontSize(16).font(FONT_BOLD).fillColor(INK_COLOR).text(ERP_ORGANIZATION.name, MARGIN, top, {
    width: contentWidth - 220,
  });
  let leftY = doc.y + 2;
  doc.fontSize(9).font(FONT_REGULAR).fillColor(MUTED_COLOR);
  doc.text(`Sucursal: ${data.company.name}`, MARGIN, leftY, { width: contentWidth - 220 });
  leftY = doc.y;
  if (data.company.identifier) {
    doc.text(data.company.identifier, MARGIN, leftY, { width: contentWidth - 220 });
    leftY = doc.y;
  }
  const locationLine = [data.company.address, data.company.location].filter(Boolean).join(' · ');
  if (locationLine) {
    doc.text(locationLine, MARGIN, leftY, { width: contentWidth - 220 });
    leftY = doc.y;
  }

  const rightX = MARGIN + contentWidth - 200;
  const rightWidth = 200;
  let rightY = top;
  doc.fontSize(9).font(FONT_BOLD).fillColor(BRAND_COLOR);
  doc.text(typeLabel.toUpperCase(), rightX, rightY, { width: rightWidth, align: 'right' });
  rightY = doc.y + 2;
  doc.fontSize(18).font(FONT_BOLD).fillColor(INK_COLOR);
  doc.text(data.document.number ?? '—', rightX, rightY, { width: rightWidth, align: 'right' });
  rightY = doc.y + 4;
  doc.fontSize(9).font(FONT_BOLD).fillColor(MUTED_COLOR);
  doc.text(data.document.status, rightX, rightY, { width: rightWidth, align: 'right' });
  rightY = doc.y + 2;
  doc.fontSize(9).font(FONT_REGULAR).fillColor(MUTED_COLOR);
  doc.text(formatDate(data.document.issuedAt), rightX, rightY, { width: rightWidth, align: 'right' });
  rightY = doc.y;
  if (data.document.reference) {
    doc.text(`Ref. ${data.document.reference}`, rightX, rightY, { width: rightWidth, align: 'right' });
    rightY = doc.y;
  }

  const dividerY = Math.max(leftY, rightY) + 12;
  doc.strokeColor(BRAND_COLOR).lineWidth(1.5);
  doc.moveTo(MARGIN, dividerY).lineTo(MARGIN + contentWidth, dividerY).stroke();
  doc.y = dividerY + 16;
}

function drawInfoPanel(doc: PDFKitDocument, x: number, width: number, title: string, lines: string[]): number {
  const paddingX = 10;
  const paddingY = 8;
  const lineHeight = 13;
  const height = paddingY * 2 + 11 + lines.length * lineHeight;
  const top = doc.y;

  doc.fillColor(PANEL_COLOR).rect(x, top, width, height).fill();
  doc.fontSize(8).font(FONT_BOLD).fillColor(MUTED_COLOR);
  doc.text(title.toUpperCase(), x + paddingX, top + paddingY, { width: width - paddingX * 2 });
  let lineY = top + paddingY + 12;
  doc.fontSize(9).font(FONT_REGULAR).fillColor(INK_COLOR);
  for (const line of lines) {
    doc.text(line, x + paddingX, lineY, { width: width - paddingX * 2 });
    lineY += lineHeight;
  }

  return height;
}

function drawInfoBlock(doc: PDFKitDocument, data: DocumentData, contentWidth: number): void {
  const gap = 12;
  const columnWidth = (contentWidth - gap) / 2;
  const top = doc.y;

  const customerLines = [data.customer.name, ...(data.customer.identifier ? [data.customer.identifier] : [])];
  const heightLeft = drawInfoPanel(
    doc,
    MARGIN,
    columnWidth,
    data.customer.identifier ? 'Proveedor' : 'Cliente',
    customerLines,
  );

  doc.y = top;
  const heightRight = drawInfoPanel(doc, MARGIN + columnWidth + gap, columnWidth, 'Responsable', [
    `Emitido por: ${data.issuedBy.name}`,
  ]);

  doc.y = top + Math.max(heightLeft, heightRight) + 20;
}

function drawTableHeader(doc: PDFKitDocument, cols: TableColumns, contentWidth: number): void {
  const top = doc.y;
  const height = 22;

  doc.fillColor(BRAND_COLOR, 0.08).rect(MARGIN, top, contentWidth, height).fill();
  doc.fillOpacity(1);
  doc.fontSize(8).font(FONT_BOLD).fillColor(INK_COLOR);
  const textY = top + 7;
  doc.text('DESCRIPCIÓN', cols.label + 8, textY, { width: cols.labelW - 12 });
  doc.text('CANTIDAD', cols.qty, textY, { width: cols.qtyW, align: 'right' });
  doc.text('PRECIO UNIT.', cols.price, textY, { width: cols.priceW, align: 'right' });
  doc.text('DESCUENTO', cols.discount, textY, { width: cols.discountW, align: 'right' });
  doc.text('IMPUESTO', cols.tax, textY, { width: cols.taxW, align: 'right' });
  doc.text('TOTAL', cols.total, textY, { width: cols.totalW, align: 'right' });

  doc.y = top + height;
}

function drawItemRow(doc: PDFKitDocument, item: DocumentItem, cols: TableColumns, contentWidth: number, index: number): void {
  const rowHeight = 22;
  const top = doc.y;

  if (index % 2 === 1) {
    doc.fillColor('#fafafa').rect(MARGIN, top, contentWidth, rowHeight).fill();
  }

  const textY = top + 6;
  const quantityLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;

  // `height`+`ellipsis`+`lineBreak: false` en cada celda numerica: un monto
  // como "10% · -CRC 500,00" puede no caber en el ancho de columna segun el
  // valor — sin esto, pdfkit lo envuelve a una segunda linea que se
  // superpone con la fila siguiente en vez de truncarse prolijamente.
  const numericCell = { height: 14, ellipsis: true, lineBreak: false } as const;

  doc.fontSize(9).font(FONT_REGULAR).fillColor(INK_COLOR);
  doc.text(item.label, cols.label + 8, textY, { width: cols.labelW - 12, ...numericCell });
  doc.fillColor(MUTED_COLOR);
  doc.text(quantityLabel, cols.qty, textY, { width: cols.qtyW, align: 'right', ...numericCell });
  doc.text(formatAmount(item.unitPrice), cols.price, textY, { width: cols.priceW, align: 'right', ...numericCell });
  doc.text(formatDiscount(item.discount, item.discountPercent), cols.discount, textY, {
    width: cols.discountW,
    align: 'right',
    ...numericCell,
  });
  doc.text(item.tax ? formatAmount(item.tax.amount) : '—', cols.tax, textY, {
    width: cols.taxW,
    align: 'right',
    ...numericCell,
  });
  doc.fillColor(INK_COLOR).font(FONT_BOLD);
  doc.text(formatAmount(item.total), cols.total, textY, { width: cols.totalW, align: 'right', ...numericCell });

  doc.y = top + rowHeight;
}

function drawTable(doc: PDFKitDocument, data: DocumentData, contentWidth: number): void {
  doc.fontSize(8).font(FONT_BOLD).fillColor(MUTED_COLOR);
  doc.text('DETALLE', MARGIN, doc.y);
  doc.y += 12;

  const cols = buildColumns(contentWidth);
  const tableTop = doc.y;

  ensureSpace(doc, 22);
  drawTableHeader(doc, cols, contentWidth);

  data.items.forEach((item, index) => {
    ensureSpace(doc, 22);
    if (doc.y === MARGIN) {
      // Se saltó de página: repetir el encabezado de la tabla.
      drawTableHeader(doc, cols, contentWidth);
    }
    drawItemRow(doc, item, cols, contentWidth, index);
  });

  const tableBottom = doc.y;
  doc.strokeColor(BORDER_COLOR).lineWidth(1);
  doc.rect(MARGIN, tableTop, contentWidth, tableBottom - tableTop).stroke();

  doc.y = tableBottom + 18;
}

function drawTotals(doc: PDFKitDocument, data: DocumentData, contentWidth: number): void {
  const blockWidth = 230;
  const x = MARGIN + contentWidth - blockWidth;
  let y = doc.y;

  const panelHeight = 66;
  doc.fillColor(PANEL_COLOR).rect(x, y, blockWidth, panelHeight).fill();
  const rows: Array<[string, string]> = [
    ['Subtotal', formatAmount(data.totals.subtotal)],
    ['Descuentos', formatDiscount(data.totals.discount, data.totals.discountPercent)],
    ['Impuestos', data.totals.tax ? formatAmount(data.totals.tax) : '—'],
  ];
  let rowY = y + 10;
  for (const [label, value] of rows) {
    doc.fontSize(9).font(FONT_REGULAR).fillColor(MUTED_COLOR).text(label, x + 12, rowY, { width: 100 });
    doc.fillColor(INK_COLOR).text(value, x + blockWidth - 112, rowY, { width: 100, align: 'right' });
    rowY += 17;
  }
  y = y + panelHeight + 8;

  const totalHeight = 34;
  doc.strokeColor(BRAND_COLOR).lineWidth(1);
  doc.fillColor(BRAND_COLOR, 0.06).roundedRect(x, y, blockWidth, totalHeight, 6).fill();
  doc.roundedRect(x, y, blockWidth, totalHeight, 6).stroke();
  doc.fillOpacity(1);
  doc.fontSize(10).font(FONT_BOLD).fillColor(BRAND_COLOR);
  doc.text('TOTAL', x + 14, y + 11, { width: 90 });
  doc.fontSize(15).font(FONT_BOLD).fillColor(BRAND_COLOR);
  doc.text(formatAmount(data.totals.total), x + blockWidth - 154, y + 8, { width: 140, align: 'right' });

  doc.y = y + totalHeight + 20;
}

function drawPayments(doc: PDFKitDocument, payments: DocumentPayment[], contentWidth: number): void {
  ensureSpace(doc, 20 + payments.length * 14);
  doc.fontSize(8).font(FONT_BOLD).fillColor(MUTED_COLOR).text('PAGOS', MARGIN, doc.y);
  let rowY = doc.y + 12;
  doc.fontSize(9).font(FONT_REGULAR).fillColor(INK_COLOR);
  for (const payment of payments) {
    const reference = payment.reference ? ` (${payment.reference})` : '';
    doc.text(`${payment.method}${reference}`, MARGIN, rowY, { width: contentWidth - 120 });
    doc.text(formatAmount(payment.amount), MARGIN, rowY, { width: contentWidth, align: 'right' });
    rowY += 14;
  }
  doc.y = rowY + 8;
}

function drawFooter(doc: PDFKitDocument, data: DocumentData, contentWidth: number): void {
  if (data.footer?.notes || data.footer?.legalText) {
    ensureSpace(doc, 40);
    doc.strokeColor(BORDER_COLOR).lineWidth(1);
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + contentWidth, doc.y).stroke();
    doc.y += 10;
    if (data.footer.notes) {
      doc.fontSize(8).font(FONT_BOLD).fillColor(MUTED_COLOR).text('NOTAS', MARGIN, doc.y);
      doc.y += 11;
      doc.fontSize(9).font(FONT_REGULAR).fillColor(INK_COLOR).text(data.footer.notes, MARGIN, doc.y, {
        width: contentWidth,
      });
      doc.y += 6;
    }
    if (data.footer.legalText) {
      doc.fontSize(8).font(FONT_REGULAR).fillColor(MUTED_COLOR).text(data.footer.legalText, MARGIN, doc.y, {
        width: contentWidth,
      });
      doc.y += 6;
    }
  }

  ensureSpace(doc, 34);
  const typeLabel = DOCUMENT_TYPE_LABELS[data.document.type] ?? data.document.type;
  doc.y = doc.page.height - doc.page.margins.bottom - 26;
  doc.strokeColor(BORDER_COLOR).lineWidth(1);
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + contentWidth, doc.y).stroke();
  doc.y += 8;
  doc.fontSize(8).font(FONT_BOLD).fillColor(MUTED_COLOR).text(ERP_ORGANIZATION.name, MARGIN, doc.y, {
    width: contentWidth,
    align: 'center',
  });
  doc.y += 10;
  doc.fontSize(7).font(FONT_REGULAR).fillColor(MUTED_COLOR).text(
    `Documento generado por el sistema — ${typeLabel}`,
    MARGIN,
    doc.y,
    { width: contentWidth, align: 'center' },
  );
}

/**
 * Genera el PDF del comprobante interno y devuelve sus bytes ya
 * ensamblados. No escribe a disco, no depende de ningun estado externo —
 * el mismo `data` siempre produce el mismo PDF.
 */
export function renderDocumentPdf(data: DocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    const contentWidth = doc.page.width - MARGIN * 2;

    doc.registerFont(FONT_REGULAR, FONT_REGULAR_PATH);
    doc.registerFont(FONT_BOLD, FONT_BOLD_PATH);
    doc.font(FONT_REGULAR);

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (error: Error) => reject(error));

    drawHeader(doc, data, contentWidth);
    drawInfoBlock(doc, data, contentWidth);
    drawTable(doc, data, contentWidth);

    if (data.payments && data.payments.length > 0) {
      ensureSpace(doc, 30);
      drawPayments(doc, data.payments, contentWidth);
    }

    ensureSpace(doc, 120);
    drawTotals(doc, data, contentWidth);

    drawFooter(doc, data, contentWidth);

    doc.end();
  });
}
