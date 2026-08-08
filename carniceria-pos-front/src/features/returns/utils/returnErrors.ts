import { AxiosError } from 'axios'

/**
 * features/returns/utils/returnErrors.ts
 * -----------------------------------------------------------------------------
 * QA Final 1.0 (Bloque 5): traduce un `AxiosError` de la mutación de
 * devolución (`POST /returns`) a un mensaje entendible, en vez del texto
 * técnico de Axios ("Request failed with status code 409") — antes de este
 * bloque, `SaleReturnForm.tsx` mostraba directamente `error.message` (el
 * mensaje genérico de Axios, nunca el mensaje real del backend),
 * escondiéndole al usuario el motivo real de un rechazo (validaciones de
 * cantidad devuelta, venta ya anulada, etc. — `returns/service.ts`). Mismo
 * patrón ya usado en `features/sales/utils/saleErrors.ts`/
 * `features/purchases/utils/purchaseErrors.ts`: el envelope de error del
 * backend es `{ error: { message } }` (`shared/utils/httpResponse.ts`),
 * asi que se prioriza ese mensaje real del servidor sobre cualquier
 * fallback genérico.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getReturnErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 404) {
      return 'La venta no existe o fue eliminada.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos de la devolución: hay campos incompletos o inválidos.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al registrar la devolución. Intenta de nuevo.'
}
