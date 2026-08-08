import { httpClient } from '@/lib/htpp/client'
import type {
  AlegraConfigStatus,
  AlegraConnectionTestResult,
  AlegraTestConnectionDto,
  SaveAlegraConfigDto,
} from '../types/alegra.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * features/settings/api/alegra.api.ts
 * -----------------------------------------------------------------------------
 * Único punto de comunicación con `/integrations/alegra` desde el
 * frontend. `testConnection` reutiliza exactamente el endpoint del
 * Bloque 7.3 (`POST /integrations/alegra/test-connection`) — este archivo
 * no le agrega ninguna lógica propia, solo envía lo que el formulario
 * tiene tipeado en ese momento.
 */
export const alegraApi = {
  getConfigStatus: async (): Promise<AlegraConfigStatus> => {
    const { data } = await httpClient.get<ApiEnvelope<AlegraConfigStatus>>(
      '/integrations/alegra/config',
    )

    return data.data
  },

  saveConfig: async (dto: SaveAlegraConfigDto): Promise<AlegraConfigStatus> => {
    const { data } = await httpClient.post<ApiEnvelope<AlegraConfigStatus>>(
      '/integrations/alegra/config',
      dto,
    )

    return data.data
  },

  testConnection: async (dto: AlegraTestConnectionDto): Promise<AlegraConnectionTestResult> => {
    const { data } = await httpClient.post<ApiEnvelope<AlegraConnectionTestResult>>(
      '/integrations/alegra/test-connection',
      dto,
    )

    return data.data
  },

  /** Bloque 7.17: reutiliza exactamente `POST /integrations/alegra/sales/:saleId/emit`
   * (backend, llama a `emitInvoice` sin lógica nueva) — dispara la emisión
   * BAJO PEDIDO desde Ventas → Documentos, ya no automática al confirmar
   * una venta. Fix (07/08/2026, decisión de negocio): el ERP ya no soporta
   * Tiquete Electrónico — sin body, toda emisión es Factura Electrónica. */
  emitInvoice: async (saleId: string): Promise<void> => {
    await httpClient.post(`/integrations/alegra/sales/${saleId}/emit`)
  },

  /** Fix (05/08/2026): reutiliza `GET /integrations/alegra/sales/:saleId/status`
   * (backend, expone `checkInvoiceStatus` — Bloque 7.8, sin cambios de
   * lógica, solo la ruta HTTP que faltaba). Relee el estado real de una
   * factura YA emitida y actualiza lo que haya cambiado. */
  checkInvoiceStatus: async (saleId: string): Promise<void> => {
    await httpClient.get(`/integrations/alegra/sales/${saleId}/status`)
  },

  /** Bloque 7.16: reutiliza exactamente `GET /integrations/alegra/sales/:saleId/invoice-pdf`
   * (Bloque 7.9, backend) — mismo patrón `responseType: 'blob'` que
   * `documentsApi.downloadPdf`. */
  downloadInvoicePdf: async (saleId: string): Promise<Blob> => {
    const response = await httpClient.get(`/integrations/alegra/sales/${saleId}/invoice-pdf`, {
      responseType: 'blob',
    })

    return response.data
  },

  /** Bloque 7.16: reutiliza exactamente `GET /integrations/alegra/sales/:saleId/invoice-xml`
   * (Bloque 7.10, backend) — mismo patrón que `downloadInvoicePdf` arriba. */
  downloadInvoiceXml: async (saleId: string): Promise<Blob> => {
    const response = await httpClient.get(`/integrations/alegra/sales/${saleId}/invoice-xml`, {
      responseType: 'blob',
    })

    return response.data
  },

  /** Bloque 7.20: reutiliza exactamente `POST /integrations/alegra/sales/:saleId/email`
   * (backend, llama a `POST /invoices/{id}/email` de Alegra sobre el
   * comprobante YA emitido — sin re-timbrar). El correo nunca se guarda:
   * viaja en el body de esta única petición. */
  sendInvoiceEmail: async (saleId: string, email: string): Promise<{ message: string }> => {
    const { data } = await httpClient.post<ApiEnvelope<{ message: string }>>(
      `/integrations/alegra/sales/${saleId}/email`,
      { emails: [email] },
    )

    return data.data
  },
}
