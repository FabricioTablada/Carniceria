/**
 * features/documents/constants/organization.ts
 * -----------------------------------------------------------------------------
 * Document Design System — identidad corporativa fija del ERP, reutilizada
 * por CUALQUIER documento imprimible (Órdenes de Compra hoy; Facturas,
 * Cotizaciones, Devoluciones, Reportes, etc. a futuro). Deliberadamente
 * separada de `DocumentCompany` (`document.types.ts`, "quien EMITE el
 * documento — sucursal/almacén/caja") — esta constante es la MARCA del
 * negocio en sí, la misma en todos los documentos sin importar la
 * sucursal que los emita. Ningún Builder necesita poblarla: `DocumentRenderer`
 * (frontend) y `documents.pdf.ts` (backend, mismo valor duplicado a mano —
 * no hay forma de compartir código entre los dos repositorios) la aplican
 * directamente, sin tocar ningún Builder existente.
 *
 * `logoUrl: null` — preparado para incorporar un logo real más adelante
 * (`DocumentRenderer` ya reserva el espacio visual junto al nombre; ver
 * ese archivo) sin requerir ningún cambio de estructura cuando exista.
 */
export const ERP_ORGANIZATION = {
  name: 'Carnicería Pollo y Más',
  logoUrl: null as string | null,
} as const
