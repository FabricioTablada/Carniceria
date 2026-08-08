/**
 * modules/purchases/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de compras.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`controller.ts`, `service.ts`, etc.) directamente.
 *
 * Motor de Documentos (`PURCHASE_ORDER`): al cargarse este modulo (una unica
 * vez -- Node cachea el modulo la primera vez que algo importa
 * `purchaseRoutes`, ver `modules/index.ts`), se registra el segundo
 * `DocumentType` del ERP, usando UNICAMENTE la API publica del motor
 * (`registerDefinition`/`registerBuilder`/`registerLoader`,
 * `modules/documents`) -- mismo patron EXACTO que `modules/sales/index.ts`
 * (unico registro existente hasta ahora); el motor no se modifica ni sabe
 * que este modulo existe.
 *
 * `capabilities`: preview/print/pdf ya funcionan de punta a punta
 * (`purchaseOrderBuilder` + `DocumentRenderer`/`documents.pdf.ts`, ya
 * implementados); electronicInvoice/xml/email no existen todavia (mismo
 * estado que Ventas), quedan en `false`.
 *
 * `requiredPermission`: 'purchases.view', el mismo permiso que ya exige
 * `GET /purchases/:id` (`routes.ts`) -- el motor recupera la compra el
 * mismo, por su `id`, reutilizando `findById` (la misma consulta que usa
 * ese endpoint, sin logica nueva).
 */
import { registerBuilder, registerDefinition, registerLoader } from '@/modules/documents';
import { purchaseOrderBuilder } from './purchases.orderBuilder';
import * as purchasesService from './service';

registerDefinition({
  type: 'PURCHASE_ORDER',
  label: 'Orden de compra',
  capabilities: {
    preview: true,
    print: true,
    pdf: true,
    electronicInvoice: false,
    xml: false,
    email: false,
  },
  requiredPermission: 'purchases.view',
});

registerBuilder('PURCHASE_ORDER', purchaseOrderBuilder);
registerLoader('PURCHASE_ORDER', purchasesService.findById);

export { purchaseRoutes } from './routes';

export { findMany } from './service';

export type {
  PurchaseItemProductSummary,
  PurchaseItemTaxSummary,
  PurchaseResponse,
  ListPurchasesResult,
} from './types';
