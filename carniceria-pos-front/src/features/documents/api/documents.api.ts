import { httpClient } from '@/lib/htpp/client'
import type { DocumentDefinition, DocumentType } from '../types/document.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * features/documents/api/documents.api.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.7 — cliente HTTP del Motor de Documentos.
 *
 * Hallazgo de seguridad #2 (auditoria 31/07/2026): antes se enviaba la
 * entidad de dominio completa (ej. la venta entera) como `source` — el
 * backend la aceptaba tal cual, sin volver a consultarla, permitiendo
 * fabricar un documento con datos falsos. Ahora solo se envia `{ id }`: el
 * backend recupera la entidad real por su cuenta y valida el permiso
 * correspondiente antes de construir el documento (`documents.service.ts`).
 *
 * Bloque 13.10: `getDefinition` — consulta la `DocumentDefinition` ya
 * registrada para `type` (`capabilities` incluidas), para que un modulo
 * como Ventas decida que botones habilitar sin duplicar esa informacion a
 * mano en el frontend.
 */
export const documentsApi = {
  downloadPdf: async (type: DocumentType, sourceId: string): Promise<Blob> => {
    const response = await httpClient.post(
      '/documents/pdf',
      { type, source: { id: sourceId } },
      { responseType: 'blob' },
    )

    return response.data
  },

  getDefinition: async (type: DocumentType): Promise<DocumentDefinition> => {
    const { data } = await httpClient.get<ApiEnvelope<DocumentDefinition>>(
      `/documents/definitions/${type}`,
    )

    return data.data
  },
}
