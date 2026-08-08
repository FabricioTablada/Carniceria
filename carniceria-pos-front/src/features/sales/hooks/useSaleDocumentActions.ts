import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { documentsApi } from '@/features/documents/api/documents.api'
import { downloadBlob } from '@/features/documents/utils/downloadBlob'
import { parseBlobError } from '@/features/documents/utils/parseBlobError'
import { alegraApi } from '@/features/settings/api/alegra.api'
import { buildSaleDocumentData } from '../utils/saleReceiptBuilder'
import type { Sale } from '../types/sale.types'

/** Bloque 7.17: mismo criterio que `features/sales/utils/saleErrors.ts`
 * (envelope `{ error: { message } }`, `shared/utils/httpResponse.ts`
 * backend) — no reutiliza `getSaleErrorMessage` porque sus fallbacks 404/400
 * son especificos de CREAR una venta, no de una accion sobre el
 * comprobante electronico (que puede fallar con 502 si Alegra rechaza el
 * envio, o 422 si falta el codigo CABYS de algun producto, Bloque 7.12).
 * Exportada (Bloque 7.20) para que `SaleResendDialog.tsx` la reutilice sin
 * duplicar esta misma logica de parseo de error. */
export function getAlegraActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: { message?: string } } | undefined

    if (data?.error?.message) {
      return data.error.message
    }
  }

  return fallback
}

/**
 * features/sales/hooks/useSaleDocumentActions.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.10 — logica del Motor de Documentos COMPARTIDA entre
 * `SaleReceiptDialog.tsx` (comprobante post-venta del POS) y
 * `SaleDetailContent.tsx` (seccion "Documentos y comprobantes" del detalle
 * de venta). Antes cada uno iba a terminar con su propia copia de
 * `buildSaleDocumentData` + estado de carga + `documentsApi.downloadPdf` +
 * manejo de error — se extrae UNA vez aca para que ninguno de los dos
 * componentes reimplemente el flujo, solo lo consuman.
 *
 * `documentData`: se recalcula en cada render (mapeo puro y barato sobre
 * `sale`, mismo criterio que ya tenia `SaleReceiptDialog.tsx`) — sin
 * `useMemo`, no vale la pena la complejidad para este costo.
 */
export function useSaleDocumentActions(sale: Sale | null | undefined) {
  const queryClient = useQueryClient()
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  // Bloque 7.16: estados de carga independientes — el punto 4 del bloque
  // exige que descargar el PDF/XML de Hacienda muestre "cargando" SOLO en
  // el boton que se apreto, sin afectar a `isDownloadingPdf` (comprobante
  // interno, Motor de Documentos) ni entre si.
  const [isDownloadingInvoicePdf, setIsDownloadingInvoicePdf] = useState(false)
  const [isDownloadingInvoiceXml, setIsDownloadingInvoiceXml] = useState(false)
  // Bloque 7.17: estado propio de "Emitir Factura Electrónica". Fix
  // (07/08/2026, decisión de negocio): el ERP ya no soporta Tiquete
  // Electrónico — vuelve a ser un booleano simple (antes `emittingDocumentType`
  // distinguía entre dos acciones posibles, ya no existen).
  const [isEmittingInvoice, setIsEmittingInvoice] = useState(false)
  // Fix (05/08/2026): estado propio de "Actualizar estado" — independiente
  // del resto, mismo criterio que los demás botones de esta sección.
  const [isCheckingInvoiceStatus, setIsCheckingInvoiceStatus] = useState(false)

  const documentData = sale ? buildSaleDocumentData(sale) : null

  // Bloque 7.16/7.17: el documento electronico (factura/tiquete real ante
  // Hacienda, `modules/integrations/alegra`) solo existe una vez que el
  // usuario lo pidio explicitamente desde Documentos ("Emitir comprobante
  // electronico", `handleEmitInvoice` mas abajo) y `emitInvoice` lo emitio
  // con exito — `Sale.alegraInvoiceId` es la unica senal confiable de eso.
  // Ya NO se dispara solo al confirmar la venta (Bloque 7.11, removido).
  const hasElectronicDocument = Boolean(sale?.alegraInvoiceId)

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = async () => {
    if (!sale) {
      return
    }

    setIsDownloadingPdf(true)

    try {
      // El backend resuelve el DocumentBuilder de "SALE_RECEIPT" via el
      // DocumentRegistry y construye su propio DocumentData alla — este
      // hook solo dice QUE tipo de documento quiere, nunca COMO se arma.
      // Hallazgo de seguridad #2 (auditoria 31/07/2026): se envia solo el
      // id de la venta, no la venta completa — el backend la recupera el
      // mismo y valida el permiso ("sales.view") antes de construir el PDF.
      const pdf = await documentsApi.downloadPdf('SALE_RECEIPT', sale.id)
      downloadBlob(pdf, `comprobante-${sale.documentNumber ?? 'venta'}.pdf`)
    } catch (error) {
      // Bloque 13.12: el error de una peticion `responseType: 'blob'`
      // tambien llega como Blob — sin decodificarlo se pierde el mensaje
      // real del backend (422/404/etc.), quedando solo un texto generico.
      const message = await parseBlobError(error, 'No se pudo descargar el PDF. Intenta de nuevo.')
      toast.error(message)
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Bloque 7.16: descarga el PDF/XML REAL de Hacienda (distinto del
  // comprobante interno de arriba) — reutiliza exactamente
  // `GET /integrations/alegra/sales/:saleId/invoice-pdf`/`-xml`
  // (Bloques 7.9/7.10, backend, sin cambios) via `alegraApi`, y el mismo
  // patron `downloadBlob`/`parseBlobError` ya usado por `handleDownloadPdf`.
  const handleDownloadInvoicePdf = async () => {
    if (!sale) {
      return
    }

    setIsDownloadingInvoicePdf(true)

    try {
      const pdf = await alegraApi.downloadInvoicePdf(sale.id)
      downloadBlob(pdf, `factura-electronica-${sale.documentNumber ?? sale.id}.pdf`)
    } catch (error) {
      const message = await parseBlobError(
        error,
        'No se pudo descargar el PDF de Hacienda. Intenta de nuevo.',
      )
      toast.error(message)
    } finally {
      setIsDownloadingInvoicePdf(false)
    }
  }

  const handleDownloadInvoiceXml = async () => {
    if (!sale) {
      return
    }

    setIsDownloadingInvoiceXml(true)

    try {
      const xml = await alegraApi.downloadInvoiceXml(sale.id)
      downloadBlob(xml, `factura-electronica-${sale.documentNumber ?? sale.id}.xml`)
    } catch (error) {
      const message = await parseBlobError(
        error,
        'No se pudo descargar el XML de Hacienda. Intenta de nuevo.',
      )
      toast.error(message)
    } finally {
      setIsDownloadingInvoiceXml(false)
    }
  }

  // Bloque 7.17: dispara `emitInvoice` BAJO PEDIDO (reutiliza exactamente
  // `POST /integrations/alegra/sales/:saleId/emit`, que a su vez reutiliza
  // `emitInvoice` sin logica nueva) — antes esto pasaba solo automatico al
  // confirmar la venta (Bloque 7.11, removido). Al terminar con exito,
  // invalida `['sales']` para que `useSale` (React Query) vuelva a pedir la
  // venta con `alegraInvoiceId` ya resuelto — asi `hasElectronicDocument`
  // pasa a `true` y "Ver factura"/"Ver XML" se habilitan solos, sin recargar
  // la pagina.
  //
  // Fix (07/08/2026, decisión de negocio): el ERP ya no soporta Tiquete
  // Electrónico — sin parámetro de tipo de comprobante, siempre Factura
  // Electrónica (el backend sigue siendo quien valida/rechaza si la venta
  // no tiene cliente identificado).
  const handleEmitInvoice = async () => {
    if (!sale) {
      return
    }

    setIsEmittingInvoice(true)

    try {
      await alegraApi.emitInvoice(sale.id)
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast.success('Factura electrónica emitida correctamente.')
    } catch (error) {
      const message = getAlegraActionErrorMessage(
        error,
        'No se pudo emitir el comprobante electrónico. Intenta de nuevo.',
      )

      toast.error(message)
    } finally {
      setIsEmittingInvoice(false)
    }
  }

  // Fix (05/08/2026): expone `checkInvoiceStatus` (Bloque 7.8, antes sin
  // ninguna ruta HTTP) — mismo patron exacto que `handleEmitInvoice`:
  // invalida `['sales']` al terminar para que `useSale` vuelva a pedir la
  // venta con el estado ya actualizado, sin recargar la pagina.
  const handleCheckInvoiceStatus = async () => {
    if (!sale) {
      return
    }

    setIsCheckingInvoiceStatus(true)

    try {
      await alegraApi.checkInvoiceStatus(sale.id)
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast.success('Estado del comprobante actualizado.')
    } catch (error) {
      toast.error(
        getAlegraActionErrorMessage(error, 'No se pudo actualizar el estado del comprobante. Intenta de nuevo.'),
      )
    } finally {
      setIsCheckingInvoiceStatus(false)
    }
  }

  return {
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
  }
}
