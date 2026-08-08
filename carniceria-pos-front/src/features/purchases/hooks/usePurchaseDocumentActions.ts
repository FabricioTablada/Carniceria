import { useState } from 'react'
import { toast } from 'sonner'
import { documentsApi } from '@/features/documents/api/documents.api'
import { downloadBlob } from '@/features/documents/utils/downloadBlob'
import { parseBlobError } from '@/features/documents/utils/parseBlobError'
import { buildPurchaseOrderDocumentData } from '../utils/purchaseOrderBuilder'
import type { Purchase } from '../types/purchase.types'

/**
 * features/purchases/hooks/usePurchaseDocumentActions.ts
 * -----------------------------------------------------------------------------
 * Mismo patrón que `useSaleDocumentActions.ts` (Ventas): centraliza el
 * mapeo a `DocumentData` + el estado de descarga + `documentsApi.downloadPdf`
 * para el único consumidor de este bloque (pestaña "Documento",
 * `PurchaseDetailPage.tsx`).
 */
export function usePurchaseDocumentActions(purchase: Purchase | null | undefined) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const documentData = purchase ? buildPurchaseOrderDocumentData(purchase) : null

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = async () => {
    if (!purchase) {
      return
    }

    setIsDownloadingPdf(true)

    try {
      // El backend resuelve el DocumentBuilder de "PURCHASE_ORDER" via el
      // DocumentRegistry y construye su propio DocumentData alla — se
      // envia solo el id de la compra, el backend la recupera el mismo y
      // valida el permiso ("purchases.view") antes de generar el PDF.
      const pdf = await documentsApi.downloadPdf('PURCHASE_ORDER', purchase.id)
      downloadBlob(pdf, `orden-compra-${purchase.documentNumber ?? purchase.id}.pdf`)
    } catch (error) {
      const message = await parseBlobError(error, 'No se pudo descargar el PDF. Intenta de nuevo.')
      toast.error(message)
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  return { documentData, isDownloadingPdf, handlePrint, handleDownloadPdf }
}
