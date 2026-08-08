/**
 * modules/sales/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de ventas.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`controller.ts`, `service.ts`, etc.) directamente.
 *
 * Bloque 13.3: al cargarse este modulo (una unica vez — Node cachea el
 * modulo la primera vez que algo importa `salesRoutes`, ver
 * `modules/index.ts`), se registra el primer `DocumentType` del ERP
 * (`SALE_RECEIPT`) en el Motor de Documentos, usando UNICAMENTE su API
 * publica (`registerDefinition`/`registerBuilder`, `modules/documents`) —
 * el motor no se modifica ni sabe que este modulo existe; es Sales quien
 * se registra en el, no al reves.
 *
 * Bloque 13.10: `capabilities` se corrige para reflejar lo que HOY esta
 * realmente implementado (no lo que el tipo de documento soportaria en
 * teoria) — `preview`/`print`/`pdf` ya funcionan de punta a punta
 * (`SaleReceiptDialog.tsx`/`SaleDetailContent.tsx`). El frontend
 * (`SaleDetailContent.tsx`) lee este mismo objeto via
 * `GET /documents/definitions/:type` para decidir que botones habilitar —
 * el dia que una capacidad pasa a `true` aca, ese boton se habilita solo,
 * sin tocar el frontend.
 *
 * Bloque 7.16: `electronicInvoice`/`xml` pasan a `true` — ya existen de
 * punta a punta (`modules/integrations/alegra`, Bloques 7.9/7.10/7.15:
 * `GET /integrations/alegra/sales/:saleId/invoice-pdf`/`-xml`, ambos
 * probados contra la cuenta real de Alegra). `SaleDetailContent.tsx`
 * ademas exige que la venta puntual tenga `Sale.alegraInvoiceId` (expuesto
 * en `SaleResponse`) antes de habilitar "Ver factura"/"Ver XML" — esta
 * capacidad dice que el TIPO de accion existe en el sistema, no que TODA
 * venta ya tenga su documento.
 *
 * Bloque 7.20: `email` pasa a `true` — `POST /integrations/alegra/sales/:saleId/email`
 * ya existe, reenvia la factura YA emitida (`developer.alegra.com/reference/post_invoices-id-email`),
 * sin volver a timbrar. Mismo criterio que `electronicInvoice`/`xml`:
 * `SaleDetailContent.tsx` exige ademas `Sale.alegraInvoiceId` antes de
 * habilitar el boton.
 *
 * Hallazgo de seguridad #2 (auditoria 31/07/2026): `requiredPermission`
 * ('sales.view', mismo permiso que ya exige `GET /sales/:id`) y
 * `registerLoader` — el Motor de Documentos ya no confia en la venta que
 * el cliente adjunta en el body; recupera la venta el mismo, por su `id`,
 * reutilizando `salesService.findById` (la misma consulta que usa
 * `GET /sales/:id`, sin logica nueva).
 */
import { registerBuilder, registerDefinition, registerLoader } from '@/modules/documents';
import { saleReceiptBuilder } from './sales.receiptBuilder';
import * as salesService from './service';

registerDefinition({
  type: 'SALE_RECEIPT',
  label: 'Comprobante de venta',
  capabilities: {
    preview: true,
    print: true,
    pdf: true,
    electronicInvoice: true,
    xml: true,
    email: true,
  },
  requiredPermission: 'sales.view',
});

registerBuilder('SALE_RECEIPT', saleReceiptBuilder);
registerLoader('SALE_RECEIPT', salesService.findById);

export { salesRoutes } from './routes';
