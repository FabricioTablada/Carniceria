import { AxiosError } from 'axios'

/**
 * features/batches/utils/batchErrors.ts
 * -----------------------------------------------------------------------------
 * QA Final 1.0 (Bloque 6): traduce un `AxiosError` de la mutación de ajuste
 * de lote (`PATCH /batches/:id`) a un mensaje entendible, en vez del texto
 * técnico de Axios ("Request failed with status code 400") — antes de este
 * bloque, `BatchAdjustPage.tsx` mostraba directamente `error.message` (el
 * mensaje genérico de Axios, nunca el real del backend), escondiéndole al
 * usuario el motivo real de un rechazo (validaciones reales de
 * `batches/service.ts`, p.ej. "La cantidad disponible no puede ser
 * negativa."). Mismo patrón ya usado en
 * `features/inventory/utils/inventoryErrors.ts`/`features/returns/utils/returnErrors.ts`:
 * el envelope de error del backend es `{ error: { message } }`
 * (`shared/utils/httpResponse.ts`), asi que se prioriza ese mensaje real
 * del servidor sobre cualquier fallback genérico.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getBatchErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos del ajuste: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'El lote no existe o fue eliminado.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al guardar el ajuste del lote. Intenta de nuevo.'
}
