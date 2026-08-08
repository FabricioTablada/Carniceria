import { AxiosError } from 'axios'

/**
 * features/categories/utils/categoryErrors.ts
 * -----------------------------------------------------------------------------
 * Traduce un `AxiosError` de las mutaciones de Categorias a un mensaje
 * entendible, en vez del texto tecnico de Axios ("Request failed with
 * status code 409"). Mismo patron ya usado en
 * `features/products/utils/productErrors.ts`/`features/purchases/utils/purchaseErrors.ts`:
 * el envelope de error del backend es `{ error: { message } }`
 * (`shared/utils/httpResponse.ts`), asi que se prioriza ese mensaje real
 * del servidor sobre cualquier fallback generico.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getCategoryErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 409) {
      return 'Ya existe una categoría con ese nombre.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos de la categoría: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'La categoría no existe o fue eliminada.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar la categoría. Intenta de nuevo.'
}
