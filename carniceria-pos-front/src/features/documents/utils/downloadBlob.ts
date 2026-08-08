/**
 * features/documents/utils/downloadBlob.ts
 * -----------------------------------------------------------------------------
 * Dispara la descarga de un `Blob` ya recibido (ej. el PDF que devuelve
 * `documentsApi.downloadPdf`) — mismo patron ya usado en
 * `utils/exportToCsv.ts` (`<a>` temporal + `URL.createObjectURL`), sin
 * ninguna libreria nueva. Vive en `features/documents` (no en
 * `features/sales`) para que cualquier modulo futuro que descargue un PDF
 * del Motor de Documentos lo reutilice sin duplicarlo.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
