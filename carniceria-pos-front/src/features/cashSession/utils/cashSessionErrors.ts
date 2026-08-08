import { AxiosError } from 'axios'

/**
 * features/cashSession/utils/cashSessionErrors.ts
 * -----------------------------------------------------------------------------
 * QA Final 1.0 (Bloque 5): traduce un `AxiosError` de las mutaciones de Caja
 * (abrir sesión, cerrar sesión, registrar movimiento) a un mensaje
 * entendible, en vez del texto técnico de Axios ("Request failed with
 * status code 409") — antes de este bloque, `OpenCashSessionForm.tsx`/
 * `CashMovementForm.tsx` mostraban directamente `error.message` (el
 * mensaje genérico de Axios, nunca el mensaje real del backend),
 * escondiéndole al usuario el motivo real de un rechazo (p.ej. "Ya existe
 * una sesion de caja abierta para esta caja registradora.", "No se pueden
 * registrar movimientos en una sesion de caja cerrada."). Mismo patrón ya
 * usado en `features/suppliers/utils/supplierErrors.ts`/
 * `features/inventory/utils/inventoryErrors.ts`: el envelope de error del
 * backend es `{ error: { message } }` (`shared/utils/httpResponse.ts`),
 * asi que se prioriza ese mensaje real del servidor sobre cualquier
 * fallback genérico.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getCashSessionErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 409) {
      return 'Esa acción de caja ya no es válida — revisá el estado actual de la sesión.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos ingresados: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'La sesión de caja no existe o fue eliminada.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar la operación de caja. Intenta de nuevo.'
}
