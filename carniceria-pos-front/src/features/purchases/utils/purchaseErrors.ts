import { AxiosError } from 'axios'

/**
 * features/purchases/utils/purchaseErrors.ts
 * -----------------------------------------------------------------------------
 * Traduce un `AxiosError` de las mutaciones de Compras a un mensaje
 * entendible para el cajero/administrador, en vez de mostrar el texto
 * tecnico de Axios ("Request failed with status code 400"). Mismo patron
 * ya usado en `features/auth/hooks/useLogin.ts` (`getAuthErrorMessage`):
 * el envelope de error del backend es `{ error: { message } }`
 * (`shared/utils/httpResponse.ts`), asi que se prioriza ese mensaje real
 * del servidor sobre cualquier fallback generico.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getPurchaseErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos de la compra: hay campos incompletos o invalidos.'
    }

    if (error.response?.status === 404) {
      return 'La compra no existe o fue eliminada.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar la compra. Intenta de nuevo.'
}
