import { useState } from 'react'
import { toast } from 'sonner'
import {
  Ban,
  Download,
  FileCode,
  FileText,
  Pencil,
  Printer,
  RefreshCw,
  Send,
  Undo2,
  UserCog,
} from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Can } from '@/components/common/Can'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/Tabs'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelContent,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
  WorkspacePanelDescription,
} from '@/components/ui/WorkspacePanel'
import { PERMISSIONS } from '@/constants/permissions'
import { DocumentRenderer } from '@/features/documents/components/DocumentRenderer'
import { useDocumentDefinition } from '@/features/documents/hooks/useDocumentDefinition'
import type { DocumentCapabilities } from '@/features/documents/types/document.types'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatQuantity } from '@/utils/formatQuantity'
import { CustomerSearchDialog } from '@/features/customers/components/CustomerSearchDialog'
import { useSale } from '../hooks/useSale'
import { useSaleDocumentActions } from '../hooks/useSaleDocumentActions'
import { useUpdateSale } from '../hooks/useUpdateSale'
import { SaleCorrectForm } from './SaleCorrectForm'
import { SaleResendDialog } from './SaleResendDialog'
import { SaleVoidPanel } from './SaleVoidPanel'
import { SaleReturnForm } from './SaleReturnForm'
import { SaleReturnHistory } from './SaleReturnHistory'
import { SalePaymentPanel } from './SalePaymentPanel'
import { SaleTimeline } from './SaleTimeline'
import { PAYMENT_METHOD_OPTIONS } from '../utils/payment'
import { formatDiscountCell, getLineItemDiscount } from '../utils/saleDiscount'
import { getSaleErrorMessage } from '../utils/saleErrors'
import type { SaleAppliedPromotion, SaleItem } from '../types/sale.types'
import type { LookupItem } from '@/types/lookup'

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completada',
  CANCELLED: 'Anulada',
  REFUNDED: 'Reembolsada',
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  REFUNDED: 'muted',
}

/** Corrección de consistencia (aprobado, "copiar literalmente Compras"):
 * mismo par etiqueta/valor que `PurchaseDetailPage.tsx` repite a mano en
 * su banda de identidad (`text-xs font-semibold uppercase
 * text-muted-foreground` + `text-sm`) — acá se extrae como helper LOCAL
 * (no exportado, no es un componente nuevo del Design System) porque
 * Ventas necesita 8 campos en vez de 3; el HTML resultante es idéntico
 * al de Compras. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

/** Deuda tecnica del motor de promociones, Bloque 5: etiquetas comerciales
 * por `PromotionEffectType`, para la columna "Detalle" de
 * `promotionColumns` de abajo. Solo se usan cuando `effectType` viene
 * poblado (Bloque 3+, promociones automaticas) — nunca reemplazan
 * `discountType`, solo dan una lectura mas clara del tipo real de regla. */
const EFFECT_TYPE_LABELS: Record<string, string> = {
  BUY_X_PAY_Y: '2x1 / Lleve N y pague M',
  SPECIAL_PRICE: 'Precio especial',
  FIXED_PRICE: 'Precio fijo',
  PERCENTAGE: 'Descuento porcentual',
  FIXED_AMOUNT: 'Descuento fijo',
}

interface SaleDetailContentProps {
  saleId: string
  /** Se dispara cuando el detalle "termina" (accion de anular/corregir/
   * devolver completada con exito) — el contenedor (`Dialog` o
   * `WorkspacePanel`) decide que significa exactamente: `SaleDetailDialog.tsx`
   * lo cierra; `SessionSalesDialog.tsx` vuelve a la lista de ventas. */
  onClose: () => void
}

type ViewMode = 'detail' | 'void' | 'correct' | 'return'

/**
 * features/sales/components/SaleDetailContent.tsx
 * -----------------------------------------------------------------------------
 * Bloque 3 (revision de UX): el detalle de solo lectura deja de ser el
 * layout que traia de `Dialog` (grilla de texto chica dentro de una caja
 * con borde, tabla HTML cruda, todo apretado a ~672px) y pasa a usar el
 * ancho real disponible como un espacio de trabajo — sin bifurcar el
 * componente por contenedor ni duplicar el layout.
 *
 * La adaptacion se resuelve con CONTAINER QUERIES de Tailwind v4 (`@container`
 * en el contenedor raiz de la vista "detail", variantes `@sm:`/`@lg:` en los
 * hijos) en vez de un prop de variante o un `if (isPanel)`: el layout
 * responde al ANCHO REAL de quien lo aloje — angosto en `SaleDetailDialog.tsx`
 * (`max-w-2xl`, Reportes), ancho en `SessionSalesDialog.tsx`
 * (`WorkspacePanelContent size="xl"`, POS) — sin que este archivo sepa en
 * cual de los dos esta. Cero duplicacion, cero rama de codigo por
 * contenedor.
 *
 * Reutiliza componentes YA existentes del Design System en vez de
 * reinventar markup: `KpiCard` (`size="compact"`, la misma tarjeta que ya
 * usa el Dashboard) reemplaza la grilla de texto plano para
 * Fecha/Hora/Cajero/Sucursal/Metodo de pago; `DataTable` (el mismo
 * componente que usan las 20 tablas de listado del proyecto) reemplaza el
 * `<table>` HTML crudo que tenia esta vista.
 *
 * Bloque 11 (rediseño integral de Ventas):
 *  - Grilla de informacion general ampliada a 9 campos fijos (Fecha/Hora/
 *    Estado/Cliente/Cajero/Sucursal/Caja/Metodo de pago/Referencia) — ver
 *    el bloque de `KpiCard`s mas abajo para el detalle de cada uno.
 *    Bloque 8.3: "Cliente" muestra `sale.customer?.name`, con "Público
 *    General" como valor por defecto (venta sin cliente asociado) — antes
 *    de este bloque era siempre "Público General" a secas, porque el
 *    modulo de Clientes no existia.
 *  - Tabla de Productos: gana su PROPIO scroll acotado (`max-h-72
 *    overflow-y-auto`, ~5-6 filas antes de aparecer scrollbar) — antes,
 *    con una venta de 30-50 lineas, la tabla crecia sin limite y el
 *    `Dialog` (sin `max-h` propio) no tenia ninguna forma de hacer
 *    scroll, dejando el resto invisible. El limite de alto real del
 *    dialog se agrega en `SaleDetailDialog.tsx` (unicamente ahi, ver ese
 *    archivo) como red de seguridad para el resto del contenido
 *    (Descuentos/Devoluciones en ventas con mucho historial) — el scroll
 *    que el usuario va a usar dia a dia sigue siendo el de Productos.
 *  - Total del resumen: `text-brand` -> `text-foreground` (texto normal,
 *    sin color de marca ni de alerta — pedido explicito).
 *
 * Bloque 11.1 (refinamiento final — "centro de gestion de una venta", no
 * un modal de informacion):
 *  - La cabecera (`DialogHeader`) pasa a ser una barra de acciones fija
 *    (`sticky top-0`, `-mx-5 -mt-5` compensa el padding ambiente del
 *    contenedor para quedar al ras arriba, mismo criterio que ya se usaba
 *    para el footer del Bloque 11 — solo que ahora es el turno del borde
 *    superior): numero + estado a la izquierda, Devolver/Corregir venta/
 *    Anular venta a la derecha, SIEMPRE visibles sin importar cuanto se
 *    scrollee — son las acciones mas importantes del modulo. Ya NO existe
 *    ningun bloque de acciones al final (eliminado el `DialogFooter`
 *    inferior del Bloque 11) — unica ubicacion: la cabecera. Botones
 *    `size="sm"`, no los CTA grandes de antes — se leen como acciones
 *    administrativas, no como el foco visual de la pantalla (ese lugar es
 *    de Productos).
 *  - Informacion general: se quita "Sucursal" (la venta ya pertenece a la
 *    caja activa, dato redundante) y las tarjetas pasan a `size="xs"`
 *    (nueva variante aditiva de `KpiCard.tsx`) — 2 filas de 4 en vez de 9
 *    tarjetas sueltas: Fecha/Hora/Estado/Cliente, luego Cajero/Caja/
 *    Metodo de pago/Referencia.
 *  - Productos: la tabla gana `stickyHeader` (nueva prop aditiva de
 *    `DataTable.tsx`) — el encabezado de columnas ya no se pierde al
 *    scrollear las 5-6 filas visibles. Nombre de producto truncado con
 *    `title` (tooltip nativo) para que uno muy largo nunca rompa el
 *    layout. Todas las columnas numericas (Cantidad/P. unitario/
 *    Descuento/Subtotal/Impuesto/Total) alineadas a la derecha, encabezado
 *    incluido.
 *  - Resumen: "Descuento" pasa a ser una fila FIJA (antes se ocultaba en
 *    `0`, ahora muestra "—", mismo criterio que el resto de la grilla) y
 *    pierde su color `text-destructive` — un descuento no es una alerta,
 *    es un dato financiero mas. Total: `text-lg font-bold` ->
 *    `text-xl font-extrabold`, sigue en `text-foreground` (negro), nunca
 *    color de marca/alerta.
 *  - "Documentos y comprobantes" (nueva seccion, `FormSection` compartido
 *    — mismo componente que ya usan los formularios del ERP, ninguno
 *    nuevo): Imprimir/PDF/Factura electronica/XML/Reenviar. Seccion
 *    independiente, no mezclada con las acciones operativas de la
 *    cabecera. Bloque 13.10: Imprimir/PDF conectados al Motor de
 *    Documentos (`documentActions`, mas abajo en el componente) —
 *    "Reenviar" sigue deshabilitado, por `DocumentDefinition.capabilities`,
 *    no por un `disabled` a mano (ver ese bloque para el detalle completo).
 *    Bloque 7.16: "Factura electronica"/"XML" (documento REAL de Hacienda,
 *    `modules/integrations/alegra`) ya estan conectados (Badge "Emitido"/
 *    "Pendiente" junto a los botones, usando los campos de Alegra que
 *    `SaleResponse` ya expone).
 *    Bloque 7.17: la emision YA NO es automatica al confirmar la venta
 *    (removida de `sales/service.ts`) — "Factura electronica" hace doble
 *    funcion: sin documento, dispara la emision BAJO PEDIDO ("Emitir
 *    comprobante electrónico"); con documento, descarga la factura real
 *    ("Ver factura"). "XML" sigue siendo un visor puro, solo habilitado una
 *    vez que el documento existe.
 *    Bloque 7.20: "Reenviar" tambien conectado — abre `SaleResendDialog.tsx`
 *    (pide el correo de destino, sin guardarlo) y llama a
 *    `POST /integrations/alegra/sales/:saleId/email`, que reenvia el
 *    comprobante YA emitido sin volver a timbrar. Mismo criterio que "XML":
 *    solo habilitado una vez que el documento existe.
 *  - Espaciado general mas denso (`gap-6` -> `gap-4` en el contenedor
 *    raiz, tarjetas de resumen/KpiCard con menos padding) — pedido
 *    explicito de que esto se sienta como un ERP profesional, no un
 *    formulario web.
 *  - Reutilizable a proposito (pedido explicito, "sin estilos exclusivos
 *    para Ventas"): la variante `size="xs"` de `KpiCard` y la prop
 *    `stickyHeader` de `DataTable` son cambios ADITIVOS a componentes
 *    compartidos — cualquier detalle de registro futuro (Compras, Caja,
 *    Movimientos) puede reusar exactamente el mismo patron (cabecera fija
 *    con acciones + grilla `xs` + tabla con `stickyHeader`) sin duplicar
 *    nada de esto.
 *
 * Rediseño de Ventas (Administración) — "centro de trabajo, no un modal":
 *  - La grilla de KPIs (ahora 12 tarjetas: se agregan Total/Descuento
 *    aplicado/Impuestos/Vuelto) y la fila de acciones rápidas de
 *    documentos quedan FUERA de las pestañas — se renderizan una sola vez,
 *    visibles sin importar en qué pestaña se esté (pedido explícito).
 *  - El resto del detalle se organiza en `Tabs` (`components/ui/Tabs.tsx`,
 *    ya construido para Compras/Productos/Inventario): Resumen/Productos y
 *    pagos/Documentos/Devoluciones y auditoría — mismo contenido de
 *    siempre, reorganizado, sin ninguna sección nueva de cálculo.
 *  - Anular/Corregir/Devolver YA NO reemplazan este contenido: abren
 *    `WorkspacePanel` (mismo primitivo compartido que ya usa
 *    `ProductDrawer.tsx`/`BatchDrawer.tsx`) como panel lateral — el detalle
 *    de la venta (KPIs, pestañas) sigue montado y visible detrás (atenuado
 *    por el backdrop del panel, nunca reemplazado). `SaleVoidPanel`/
 *    `SaleCorrectForm`/`SaleReturnForm` se reutilizan sin ningún cambio de
 *    props/lógica, solo cambia su contenedor.
 *  - "Productos y pagos" agrega `SalePaymentPanel.tsx` (panel lateral:
 *    resumen de pago/descuentos/volumen) junto a la tabla de productos.
 *  - "Devoluciones y auditoría" agrega `SaleTimeline.tsx` (línea de tiempo
 *    unificada: creación, corrección, devoluciones, auditoría) arriba de
 *    `SaleReturnHistory.tsx` (sin cambios, se mantiene el detalle
 *    itemizado ya existente).
 */
export function SaleDetailContent({ saleId, onClose }: SaleDetailContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('detail')
  // Bloque 7.20: controla el dialogo de "Reenviar" (pide el correo de
  // destino) — no vive dentro de `useSaleDocumentActions` porque, a
  // diferencia de las demas acciones del hook, esta necesita mostrar un
  // formulario propio antes de poder llamar a la API.
  const [isResendDialogOpen, setIsResendDialogOpen] = useState(false)
  // Version 1.0.5, Bloque 1: mismo patron que `isResendDialogOpen` — un
  // dialogo controlado, montado como hermano, sin logica propia mas alla
  // de abrir/cerrar. `CustomerSearchDialog` (ya usado en el POS) se
  // reutiliza tal cual, sin cambios.
  const [isAssignCustomerDialogOpen, setIsAssignCustomerDialogOpen] = useState(false)
  const { mutate: updateSale, isPending: isAssigningCustomer } = useUpdateSale()
  const { data: sale, isLoading, isError, error } = useSale(saleId)

  // Vuelve siempre al detalle de solo lectura cuando se muestra una venta
  // distinta — sin esto, navegar a otra venta mientras se estaba en medio
  // de "Anular"/"Corregir" podria arrancar directamente en ese panel de
  // accion. Ajuste de estado durante el render (en vez de un useEffect) —
  // mismo patron ya documentado y usado en este proyecto para evitar el
  // lint `react-hooks/set-state-in-effect`.
  const [previousSaleId, setPreviousSaleId] = useState(saleId)
  if (saleId !== previousSaleId) {
    setPreviousSaleId(saleId)
    setViewMode('detail')
  }

  const handleActionSuccess = () => {
    onClose()
  }

  const paymentMethodLabel = sale
    ? (PAYMENT_METHOD_OPTIONS.find((option) => option.value === sale.paymentMethod)?.label ??
      sale.paymentMethod)
    : ''

  const canManage = sale ? sale.status !== 'CANCELLED' && !sale.correctedBySale : false

  // Bloque 13.10: mismo hook que usa `SaleReceiptDialog.tsx` — una sola
  // implementacion del Motor de Documentos, dos consumidores. `capabilities`
  // viene del `DocumentDefinition` YA REGISTRADO en el backend
  // (`modules/sales/index.ts`) via el `DocumentRegistry` — este componente
  // no hardcodea que esta implementado y que no, solo lee la respuesta.
  //
  // Bloque 7.16: `hasElectronicDocument`/`isDownloadingInvoicePdf`/
  // `isDownloadingInvoiceXml`/`handleDownloadInvoicePdf`/
  // `handleDownloadInvoiceXml` — mismo hook, ahora tambien cubre "Ver
  // factura"/"Ver XML" (documento REAL de Hacienda, `modules/integrations/alegra`,
  // distinto del comprobante interno de "PDF" de arriba).
  //
  // Bloque 7.17: la emision ya NO es automatica al confirmar la venta
  // (Bloque 7.11, removido); "Emitir Factura Electrónica" dispara la
  // emision BAJO PEDIDO cuando la venta todavia no tiene documento (ver el
  // bloque de JSX propio mas abajo, ya no vive en `documentActions`). Fix
  // (07/08/2026, decisión de negocio): el ERP ya no soporta Tiquete
  // Electrónico — `isEmittingInvoice` vuelve a ser un booleano simple, una
  // sola acción de emisión posible.
  const {
    documentData,
    hasElectronicDocument,
    isDownloadingPdf,
    isDownloadingInvoicePdf,
    isDownloadingInvoiceXml,
    isEmittingInvoice,
    isCheckingInvoiceStatus,
    handlePrint,
    handleDownloadPdf,
    handleDownloadInvoicePdf,
    handleDownloadInvoiceXml,
    handleEmitInvoice,
    handleCheckInvoiceStatus,
  } = useSaleDocumentActions(sale)
  const { data: documentDefinition } = useDocumentDefinition('SALE_RECEIPT')
  const capabilities = documentDefinition?.capabilities

  // Version 1.0.5, Bloque 1: mismas 3 condiciones aprobadas — la 4ta
  // guarda real (venta CANCELLED) ya la cubre `canManage`. El backend
  // vuelve a validar las 3 igual (409 si no se cumplen) — esto solo evita
  // mostrar un botón que fallaría.
  const canAssignCustomer = canManage && !hasElectronicDocument && !sale?.alegraEmissionUncertainAt

  const handleAssignCustomer = (customer: LookupItem | null) => {
    if (!sale) return
    setIsAssignCustomerDialogOpen(false)
    updateSale(
      { id: sale.id, dto: { customerId: customer?.id ?? null } },
      {
        onSuccess: () => {
          toast.success(
            customer ? `Cliente "${customer.label}" asignado a la venta.` : 'Venta actualizada a "Público General".',
          )
        },
        onError: (mutationError) => {
          toast.error(getSaleErrorMessage(mutationError))
        },
      },
    )
  }

  /** Los 6 botones son SIEMPRE los mismos, en el mismo orden — ninguno se
   * oculta nunca (pedido explicito, Bloque 11.1 lo ya establecia). Lo que
   * cambia es `disabled`, que ahora depende UNICAMENTE de
   * `capabilities[capabilityKey]` (Bloque 13.10) — cuando
   * `electronicInvoice`/`xml`/`email` pasen a `true` en el backend, estos
   * botones se habilitan solos, sin volver a tocar este archivo (aunque
   * conectar su `onClick` real siga siendo trabajo de un bloque futuro,
   * cuando esas funcionalidades existan). */
  const documentActions: {
    icon: typeof Printer
    label: string
    description: string
    actionLabel: string
    capabilityKey: keyof DocumentCapabilities
    onClick?: () => void
  }[] = [
    {
      icon: Printer,
      label: 'Comprobante',
      description: 'Imprimir el comprobante de esta venta.',
      actionLabel: 'Imprimir',
      capabilityKey: 'print',
      onClick: handlePrint,
    },
    {
      icon: Download,
      label: 'PDF',
      description: 'Descargar el comprobante en formato PDF.',
      actionLabel: isDownloadingPdf ? 'Generando...' : 'Descargar PDF',
      capabilityKey: 'pdf',
      onClick: handleDownloadPdf,
    },
    // Mientras la venta NO tiene documento todavia, esta entrada no
    // dispara la emision — vive como boton propio ("Emitir Factura
    // Electrónica", JSX bespoke mas abajo, junto a `documentActions.map`)
    // porque necesita su propio texto/estado de carga. Una vez emitido
    // (`hasElectronicDocument`), esta entrada SI sigue en el array: "Ver
    // factura" vuelve a ser una unica accion, sin ambigüedad.
    ...(hasElectronicDocument
      ? [
          {
            icon: FileText,
            label: 'Factura electrónica',
            description: 'Ver la factura electrónica asociada a esta venta.',
            actionLabel: isDownloadingInvoicePdf ? 'Generando...' : 'Ver factura',
            capabilityKey: 'electronicInvoice' as const,
            onClick: handleDownloadInvoicePdf,
          },
        ]
      : []),
    {
      icon: FileCode,
      label: 'XML',
      description: 'Ver el archivo XML de la factura electrónica.',
      actionLabel: isDownloadingInvoiceXml ? 'Generando...' : 'Ver XML',
      capabilityKey: 'xml',
      onClick: handleDownloadInvoiceXml,
    },
    {
      // Bloque 7.20: "Reenviar" abre `SaleResendDialog.tsx` en vez de
      // llamar directo a la API — solo tiene sentido una vez que la venta
      // ya tiene un comprobante emitido para reenviar. Bloque 8.4: le pasa
      // `sale.customer?.email` — con un cliente asociado que tenga correo
      // cargado, el dialogo lo usa automáticamente sin pedirlo a mano;
      // Público General (o cliente sin correo) sigue pidiéndolo.
      icon: Send,
      label: 'Reenviar',
      description: 'Reenviar el comprobante por correo electrónico.',
      actionLabel: 'Reenviar',
      capabilityKey: 'email',
      onClick: () => setIsResendDialogOpen(true),
    },
  ]

  // QA (impuestos/descuentos, Bloque A): orden de columnas replica el
  // recorrido real del calculo (`sales/service.ts`, `computeItems`) —
  // P. unitario -> Descuento -> Subtotal (`lineSubtotal`, ya con el
  // descuento restado) -> Impuesto (`lineTax`, calculado SOBRE ese
  // subtotal) -> Total (`lineTotal` = subtotal + impuesto) — para que el
  // usuario pueda seguir "como se llego al total" leyendo la fila de
  // izquierda a derecha, sin hacer ninguna cuenta manual. Antes, la ultima
  // columna decia "Subtotal" pero mostraba `lineTotal` (con impuesto
  // incluido) y ni `lineSubtotal` ni `lineTax` se mostraban en ningun
  // lado — el dato siempre existio en la API, solo faltaba pedirselo.
  const itemColumns: DataTableColumn<SaleItem>[] = [
    {
      header: 'Producto',
      // Corrección de consistencia (aprobado, "evitar que el nombre del
      // producto se trunque innecesariamente"): ya no fuerza un
      // `max-w-[16rem] truncate` — con el panel lateral reducido al
      // mínimo, la columna tiene espacio real de sobra. `title` (tooltip
      // nativo) se mantiene igual: inofensivo, y sigue siendo útil si
      // algún nombre puntual es más largo que el espacio disponible.
      render: (item) => <span title={item.product.name}>{item.product.name}</span>,
      className: 'font-medium',
    },
    {
      header: 'Cantidad',
      render: (item) => formatQuantity(item.quantity, item.product.unitOfMeasure),
      className: 'text-right whitespace-nowrap tabular-nums text-muted-foreground',
      headerClassName: 'text-right',
    },
    {
      header: 'P. unitario',
      render: (item) => formatCurrency(item.unitPrice),
      className: 'text-right whitespace-nowrap tabular-nums text-muted-foreground',
      headerClassName: 'text-right',
    },
    {
      header: 'Descuento',
      // `item.discount` sigue siendo EXCLUSIVAMENTE el descuento manual de
      // esa línea (sin cambios, ver comentario de `promotionColumns` mas
      // abajo) — `getLineItemDiscount` (compartida con `SalesTable.tsx`/
      // `saleReceiptBuilder.ts`, ver `utils/saleDiscount.ts`) le suma las
      // promociones automáticas atadas a esta línea
      // (`sale.appliedPromotions`, filtrado por `saleItemId`, dato que la
      // API ya devolvía antes de este bloque). `lineSubtotal`/`lineTotal`
      // (columnas de al lado) siguen siendo EXACTAMENTE los mismos valores
      // ya calculados por el backend, sin tocar.
      render: (item) =>
        formatDiscountCell(getLineItemDiscount(item, sale?.appliedPromotions ?? [])),
      className: 'text-right whitespace-nowrap tabular-nums text-muted-foreground',
      headerClassName: 'text-right',
    },
    {
      header: 'Subtotal',
      render: (item) => formatCurrency(item.lineSubtotal),
      className: 'text-right whitespace-nowrap tabular-nums',
      headerClassName: 'text-right',
    },
    {
      header: 'Impuesto',
      render: (item) =>
        item.tax ? (
          <div className="flex flex-col items-end text-right whitespace-nowrap">
            <span>
              {item.tax.name} ({item.taxRate}%)
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatCurrency(item.lineTax)}
            </span>
          </div>
        ) : (
          <span className="block text-right whitespace-nowrap">Sin impuesto</span>
        ),
      className: 'text-right whitespace-nowrap text-muted-foreground',
      headerClassName: 'text-right',
    },
    {
      header: 'Total',
      render: (item) => formatCurrency(item.lineTotal),
      className: 'text-right whitespace-nowrap font-semibold tabular-nums',
      headerClassName: 'text-right',
    },
  ]

  // Bloque P.2 (Motor de Promociones, exposicion de la auditoria): tabla
  // GENERICA sobre `sale.appliedPromotions` — cada columna lee campos que
  // CUALQUIER origen de descuento ya tiene (nombre, tipo/valor, quien lo
  // aplico, monto), sin ninguna rama de codigo especifica para "manual".
  // Cuando exista una promocion automatica/combo/2x1, esa fila nueva se
  // renderiza con las MISMAS columnas — nada en este componente sabe ni
  // necesita saber que `source` puede tomar mas valores que `MANUAL` hoy.
  const promotionColumns: DataTableColumn<SaleAppliedPromotion>[] = [
    {
      header: 'Descuento',
      render: (promotion) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{promotion.promotionNameSnapshot}</span>
          <Badge
            variant={promotion.source === 'MANUAL' ? 'muted' : 'accent'}
            className="w-fit"
          >
            {promotion.source === 'MANUAL' ? 'Manual' : 'Automático'}
          </Badge>
        </div>
      ),
    },
    {
      header: 'Detalle',
      render: (promotion) => {
        // Bloque 5: cuando `effectType` viene poblado (promociones
        // automaticas creadas despues del Bloque 3), se muestra la
        // etiqueta comercial del tipo REAL de regla, en vez de inferirla
        // (de forma ambigua) desde `discountType` — que sigue colapsando
        // FIXED_AMOUNT/SPECIAL_PRICE/BUY_X_PAY_Y en un mismo valor
        // 'FIXED'. Para PERCENTAGE se agrega el porcentaje real, que
        // `discountValue` SI representa con exactitud en ese caso.
        if (promotion.effectType) {
          const label = EFFECT_TYPE_LABELS[promotion.effectType] ?? promotion.effectType
          return promotion.effectType === 'PERCENTAGE'
            ? `${label} (${promotion.discountValue}%)`
            : label
        }

        // Fallback exacto al comportamiento anterior — descuentos
        // MANUALES (nunca tienen `effectType`, no son una regla de
        // catalogo) y ventas historicas creadas antes del Bloque 3.
        return promotion.discountType === 'PERCENTAGE'
          ? `${promotion.discountValue}%`
          : formatCurrency(promotion.discountValue)
      },
      className: 'text-muted-foreground',
    },
    {
      header: 'Aplicado por',
      render: (promotion) => promotion.appliedByUser?.fullName ?? '—',
      className: 'max-w-[10rem] truncate text-muted-foreground',
    },
    {
      header: 'Monto',
      headerClassName: 'text-right',
      render: (promotion) => `-${formatCurrency(promotion.amountApplied)}`,
      className: 'text-right whitespace-nowrap font-semibold tabular-nums text-destructive',
    },
  ]

  return (
    <>
      {isLoading && <LoadingState message="Cargando detalle de la venta..." />}

      {isError && (
        <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar la venta.'}</ErrorAlert>
      )}

      {sale && (
        // `@container`: el resto de esta vista se adapta al ancho REAL de
        // este contenedor (angosto en Dialog, ancho en WorkspacePanel),
        // no al viewport — ver comentario de archivo.
        <div className="@container flex flex-col gap-4">
          {/* Barra de acciones fija (Bloque 11.1) — numero+estado a la
              izquierda, Devolver/Corregir/Anular a la derecha, siempre
              visibles. `-mx-5 -mt-5` + `px-5 pt-4` compensa el padding
              ambiente del contenedor (`p-5` en `Dialog.tsx`, `py-5` en
              `WorkspacePanelBody`) para que quede al ras del borde
              superior real, sin dejar un hueco arriba (mismo truco que el
              footer del Bloque 11, ahora en el borde opuesto). `pr-12` en
              vez de `px-5` a la derecha: espacio para el boton "Cerrar"
              (X) de `DialogContent`/`WorkspacePanelContent`, que se
              superpone en esa esquina.
              Rediseño de Ventas: estas 3 acciones ya NO reemplazan este
              contenido (`viewMode` ya no condiciona qué se renderiza aca)
              — ahora abren el `WorkspacePanel` superpuesto al final de
              este archivo, dejando el detalle siempre visible detrás. */}
          <DialogHeader className="sticky top-0 z-20 -mx-5 -mt-5 flex-row flex-wrap items-center justify-between gap-3 border-b bg-card px-5 pr-12 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <DialogTitle className="text-lg">
                {sale.documentNumber ?? 'Venta sin documento'}
              </DialogTitle>
              <Badge variant={STATUS_VARIANTS[sale.status] ?? 'muted'}>
                {STATUS_LABELS[sale.status] ?? sale.status}
              </Badge>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Can permission={PERMISSIONS.RETURNS_CREATE}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode('return')}
                    className="gap-1.5"
                  >
                    <Undo2 className="size-3.5" />
                    Devolver
                  </Button>
                </Can>
                <Can permission={PERMISSIONS.SALES_CORRECT}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode('correct')}
                    className="gap-1.5"
                  >
                    <Pencil className="size-3.5" />
                    Corregir venta
                  </Button>
                </Can>
                <Can permission={PERMISSIONS.SALES_VOID}>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setViewMode('void')}
                    className="gap-1.5"
                  >
                    <Ban className="size-3.5" />
                    Anular venta
                  </Button>
                </Can>
              </div>
            )}
          </DialogHeader>

          {/* Corrección de consistencia (aprobado, "copiar literalmente
              Compras"): reemplaza la franja `bare` de KPIs + el bloque
              hero separado por la MISMA banda de identidad que
              `PurchaseDetailPage.tsx` — una sola franja
              (`flex flex-col gap-4 border-b border-border/70 p-5
              sm:flex-row sm:items-center`), campos simples (`flex
              flex-col gap-1`, etiqueta `text-xs font-semibold uppercase
              text-muted-foreground`, valor `text-sm`) a la izquierda y la
              caja hero de "Total" a la derecha con las clases EXACTAS de
              Compras (`rounded-xl border border-brand/15 bg-brand/5
              px-4 py-3 sm:min-w-52`, `text-2xl ... sm:text-3xl`). Más
              campos que Compras (acá 8, ahí 3) porque Ventas tiene más
              información propia del módulo — pero cada campo usa el
              mismo componente `Field`, no `KpiCard`. */}
          <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-6">
              <Field label="Fecha" value={formatDateTime(sale.saleDate).split(' ')[0] ?? '—'} />
              <Field label="Hora" value={formatDateTime(sale.saleDate).split(' ')[1] ?? '—'} />
              <div className="flex items-end gap-1">
                <Field label="Cliente" value={sale.customer?.name ?? 'Público General'} />
                {canAssignCustomer && (
                  <button
                    type="button"
                    aria-label="Asignar cliente"
                    disabled={isAssigningCustomer}
                    onClick={() => setIsAssignCustomerDialogOpen(true)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    <UserCog className="size-3.5" />
                  </button>
                )}
              </div>
              <Field label="Cajero" value={sale.user.fullName} />
              <Field
                label="Caja"
                value={sale.cashSession.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
              />
              <Field label="Método de pago" value={paymentMethodLabel} />
              <Field label="Referencia" value={sale.paymentReference ?? '—'} />
              {sale.changeGiven > 0 && (
                <Field label="Vuelto" value={formatCurrency(sale.changeGiven)} />
              )}
            </div>

            <div className="flex flex-col gap-1 rounded-xl border border-brand/15 bg-brand/5 px-4 py-3 sm:min-w-52">
              <span className="text-xs font-semibold tracking-wide text-brand/80 uppercase">Total</span>
              <span className="text-2xl leading-tight font-bold tracking-tight text-brand tabular-nums sm:text-3xl">
                {formatCurrency(sale.total)}
              </span>
            </div>
          </div>

          <CustomerSearchDialog
            open={isAssignCustomerDialogOpen}
            onOpenChange={setIsAssignCustomerDialogOpen}
            onSelect={handleAssignCustomer}
          />

          <div className="p-5">
            <Tabs defaultValue="summary">
              {/* Corrección de consistencia (aprobado, "copiar
                  literalmente Compras"): `TabsList`/`TabsTab` SIN ningún
                  override de `className` — el override en pastilla del
                  bloque anterior no es el lenguaje visual real de
                  Compras (`PurchaseDetailPage.tsx` usa el `Tabs`
                  compartido tal cual, subrayado simple). Mismas 4
                  pestañas de siempre. */}
              <TabsList>
                <TabsTab value="summary">Resumen</TabsTab>
                <TabsTab value="products">Productos y pagos</TabsTab>
                <TabsTab value="documents">Documentos</TabsTab>
                <TabsTab value="audit">Devoluciones y auditoría</TabsTab>
              </TabsList>

            <TabsPanel value="summary" className="flex flex-col gap-4">
              {sale.originalSale && (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Esta venta corrige a{' '}
                  <span className="font-semibold">
                    {sale.originalSale.documentNumber ?? sale.originalSale.id}
                  </span>{' '}
                  ({STATUS_LABELS[sale.originalSale.status] ?? sale.originalSale.status}).
                </p>
              )}

              {sale.correctedBySale && (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Esta venta fue reemplazada por{' '}
                  <span className="font-semibold">
                    {sale.correctedBySale.documentNumber ?? sale.correctedBySale.id}
                  </span>
                  .
                </p>
              )}

              {/* Corrección de consistencia (aprobado, "copiar
                  literalmente Compras"): mismo bloque exacto que
                  `PurchaseDetailPage.tsx` (`ml-auto w-full max-w-xs
                  rounded-xl bg-muted/40 p-4 text-sm`) — "Total" no se
                  repite acá (ya es el hero, siempre visible arriba). */}
              <div className="ml-auto flex w-full max-w-xs flex-col gap-1.5 rounded-xl bg-muted/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(sale.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Descuentos</span>
                  <span className="tabular-nums">
                    {sale.discountTotal > 0 ? `-${formatCurrency(sale.discountTotal)}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Impuestos</span>
                  <span className="tabular-nums">{formatCurrency(sale.taxTotal)}</span>
                </div>
              </div>
            </TabsPanel>

            <TabsPanel value="products">
              {/* Causa raíz del recorte de la columna "Total" (bug real,
                  ver informe del bloque): el quiebre a lado-a-lado estaba
                  en `@lg` (32rem/512px) — un umbral que no tiene relación
                  con cuánto espacio necesita REALMENTE la tabla de 7
                  columnas. El contenedor de este Dialog mide ~984px de
                  ancho útil, así que "lado a lado" se activaba siempre,
                  mucho antes de tener sitio real: el panel lateral (ancho
                  fijo + `shrink-0`) le quitaba ~224px a una tabla que sin
                  columnas truncadas necesita ~980px — la tabla, sin
                  `scrollX`, se compensaba encogiendo cada columna y
                  RECORTANDO (`overflow-hidden`) lo que no entraba, sin
                  ninguna barra de scroll que lo hiciera visible. Ensanchar
                  el Dialog (ya intentado dos veces, ver historial en
                  `SaleDetailDialog.tsx`) nunca iba a alcanzar: mientras el
                  quiebre siga en `@lg`, CUALQUIER ancho de Dialog activa
                  lado-a-lado de inmediato, sin garantía de que alcance.
                  Corrección real: el quiebre pasa a `@7xl` (80rem/1280px),
                  el ancho real que hace falta para que tabla + panel
                  quepan sin apretarse — por debajo de eso (el caso de
                  este Dialog hoy) el panel se apila DEBAJO de la tabla, a
                  ancho completo, en vez de angostarse a su lado (mismas 3
                  tarjetas, sin perder ningún dato — ver el propio
                  `SalePaymentPanel.tsx`, que además reorganiza sus
                  tarjetas en fila mientras está apilado, para no ocupar
                  alto de más). `scrollX` en la tabla queda como red de
                  seguridad real (nunca debería activarse con el quiebre
                  ya corregido): un desborde puntual futuro se vuelve una
                  barra de scroll CONTENIDA en la propia tabla, nunca un
                  recorte silencioso de datos. */}
              <div className="flex flex-col gap-4 @7xl:flex-row @7xl:items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Productos
                    </span>

                    {/* Corrección de consistencia (aprobado, "reducir el
                        scroll interno al mínimo"): el Dialog exterior
                        (`SaleDetailDialog.tsx`) ya tiene su propio
                        `max-h-[85vh] overflow-y-auto` como red de
                        seguridad real — este límite interno solo existe
                        para evitar que una venta con 40-50 líneas se
                        vuelva inmanejable, así que sube de `max-h-80`
                        (20rem, ~5-6 filas) a `max-h-[28rem]` (~12-14
                        filas): la gran mayoría de las ventas entran
                        completas sin un segundo scroll anidado. `stickyHeader`
                        (prop aditiva de `DataTable.tsx`) sigue fijando el
                        encabezado de columnas cuando sí hace falta
                        scrollear. */}
                    <div className="max-h-[28rem] overflow-y-auto rounded-xl">
                      <DataTable
                        columns={itemColumns}
                        data={sale.items}
                        getRowKey={(item) => item.id}
                        stickyHeader
                        scrollX
                        tableClassName="border-border/60 shadow-sm"
                        headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
                        cellClassName="px-4 py-3"
                      />
                    </div>
                  </div>

                  {/* Bloque P.2: seccion INDEPENDIENTE de la columna
                      "Descuento" de la tabla de Productos (esa sigue
                      siendo exclusivamente el descuento propio de cada
                      linea, `item.discount`, sin cambios). Esta tabla es
                      el DETALLE que explica el agregado — oculta por
                      completo si no hay ninguna. */}
                  {sale.appliedPromotions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Descuentos aplicados
                      </span>

                      <DataTable
                        columns={promotionColumns}
                        data={sale.appliedPromotions}
                        getRowKey={(promotion) => promotion.id}
                        scrollX
                        tableClassName="border-border/60 shadow-sm"
                        headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
                        cellClassName="px-4 py-3"
                      />
                    </div>
                  )}
                </div>

                <SalePaymentPanel sale={sale} />
              </div>
            </TabsPanel>

            <TabsPanel value="documents" className="flex flex-col gap-4">
              {/* Corrección de consistencia (aprobado, "copiar
                  literalmente Compras"): misma fila simple de botones que
                  `PurchaseDetailPage.tsx` (`flex items-center gap-2`,
                  `variant="outline" size="sm"`) en vez de la grilla de 5
                  tarjetas con estado — Ventas tiene 5 acciones posibles
                  (Compras solo 2) porque es información propia del
                  módulo, pero el LENGUAJE VISUAL es el mismo botón simple,
                  deshabilitado según `capabilities[capabilityKey]` (la
                  misma fuente de verdad de siempre, sin dato nuevo). El
                  documento renderizado (`DocumentRenderer`, Motor de
                  Documentos) se muestra directamente acá, igual que en
                  Compras — ya no vive oculto en un bloque aparte solo
                  para impresión. */}
              {/* Bloque 7.16/7.17: estado real del documento electronico —
                  `sale.alegraInvoiceId` (Bloque 7.7, `SaleResponse`) es la
                  unica fuente de verdad de si YA se emitio. La emision ya no
                  es automatica (Bloque 7.11, removido): "Pendiente" significa
                  simplemente que todavia nadie pidio "Emitir comprobante
                  electrónico" para esta venta — no hay un campo de "error"
                  explicito en `Sale`, asi que un intento fallido tambien se
                  ve como "Pendiente" hasta que se reintente (mismo boton). */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Documento electrónico
                </span>
                <Badge variant={hasElectronicDocument ? 'secondary' : 'muted'}>
                  {hasElectronicDocument ? 'Emitido' : 'Pendiente'}
                </Badge>
                {/* Fix (05/08/2026): "Actualizar estado" relee el estado real
                    en Alegra (`checkInvoiceStatus`, Bloque 7.8, antes sin
                    ruta HTTP) — solo tiene sentido una vez que ya existe un
                    comprobante emitido; no reemplaza ni se mezcla con los 6
                    botones fijos de `documentActions` (Bloque 11.1, ninguno
                    se oculta nunca). */}
                {hasElectronicDocument && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isCheckingInvoiceStatus}
                    onClick={handleCheckInvoiceStatus}
                    title="Actualizar estado"
                  >
                    <RefreshCw className={isCheckingInvoiceStatus ? 'size-4 animate-spin' : 'size-4'} />
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Fix (07/08/2026, decisión de negocio): el ERP ya no
                    soporta Tiquete Electrónico — una sola acción de
                    emisión, deshabilitada si la venta sigue en "Público
                    General" (mismo criterio que valida el backend,
                    `409 CONFLICT` — este deshabilitado es solo la capa de
                    UI, la regla real vive en `emitInvoice`, `alegra.service.ts`). */}
                {!hasElectronicDocument && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!capabilities?.electronicInvoice || !sale.customerId || isEmittingInvoice}
                    onClick={() => handleEmitInvoice()}
                    title={
                      sale.customerId
                        ? 'Emitir Factura Electrónica'
                        : 'Asigná un cliente a esta venta para poder emitir una Factura Electrónica.'
                    }
                  >
                    <FileText className="size-4" />
                    {isEmittingInvoice ? 'Emitiendo...' : 'Emitir Factura Electrónica'}
                  </Button>
                )}

                {documentActions.map(({ icon: Icon, label, actionLabel, capabilityKey, onClick }) => {
                  // Bloque 7.16/7.20: "XML"/"Reenviar" exigen ADEMAS que esta
                  // venta puntual ya tenga el documento (ninguno de los dos
                  // dispara una emision, solo actuan sobre un comprobante que
                  // ya existe) — "Comprobante"/"PDF" siguen dependiendo
                  // unicamente de `capabilities`. "Factura electrónica" solo
                  // aparece en este array cuando `hasElectronicDocument` es
                  // `true` (ver `documentActions` arriba), asi que aca ya no
                  // necesita ninguna condicion especial.
                  const requiresElectronicDocument =
                    capabilityKey === 'xml' || capabilityKey === 'email'
                  const isEnabled =
                    Boolean(capabilities?.[capabilityKey]) &&
                    (!requiresElectronicDocument || hasElectronicDocument)
                  const isBusy =
                    (capabilityKey === 'pdf' && isDownloadingPdf) ||
                    (capabilityKey === 'electronicInvoice' && isDownloadingInvoicePdf) ||
                    (capabilityKey === 'xml' && isDownloadingInvoiceXml)

                  return (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!isEnabled || isBusy}
                      onClick={onClick}
                      title={label}
                    >
                      <Icon className="size-4" />
                      {isBusy ? actionLabel : actionLabel}
                    </Button>
                  )
                })}
              </div>
              {documentData && <DocumentRenderer data={documentData} />}

              <SaleResendDialog
                open={isResendDialogOpen}
                onOpenChange={setIsResendDialogOpen}
                saleId={sale.id}
                customerEmail={sale.customer?.email}
              />
            </TabsPanel>

            <TabsPanel value="audit" className="flex flex-col gap-6">
              <SaleTimeline sale={sale} />
              <SaleReturnHistory sale={sale} />
            </TabsPanel>
            </Tabs>
          </div>
        </div>
      )}

      {sale && (
        <WorkspacePanel
          open={viewMode !== 'detail'}
          onOpenChange={(open) => {
            if (!open) {
              setViewMode('detail')
            }
          }}
        >
          <WorkspacePanelContent size="lg">
            <WorkspacePanelHeader>
              <WorkspacePanelTitle>
                {viewMode === 'void' && `Anular venta ${sale.documentNumber}`}
                {viewMode === 'correct' && `Corregir venta ${sale.documentNumber}`}
                {viewMode === 'return' && `Devolver venta ${sale.documentNumber}`}
              </WorkspacePanelTitle>
              <WorkspacePanelDescription>
                Esta acción queda registrada en la auditoría del sistema.
              </WorkspacePanelDescription>
            </WorkspacePanelHeader>
            <WorkspacePanelBody className="@container">
              {viewMode === 'void' && (
                <SaleVoidPanel
                  sale={sale}
                  onCancel={() => setViewMode('detail')}
                  onSuccess={handleActionSuccess}
                />
              )}
              {viewMode === 'correct' && (
                <SaleCorrectForm
                  sale={sale}
                  onCancel={() => setViewMode('detail')}
                  onSuccess={handleActionSuccess}
                />
              )}
              {viewMode === 'return' && (
                <SaleReturnForm
                  sale={sale}
                  onCancel={() => setViewMode('detail')}
                  onSuccess={handleActionSuccess}
                />
              )}
            </WorkspacePanelBody>
          </WorkspacePanelContent>
        </WorkspacePanel>
      )}
    </>
  )
}
