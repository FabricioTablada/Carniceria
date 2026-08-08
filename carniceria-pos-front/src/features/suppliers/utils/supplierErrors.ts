import { AxiosError } from 'axios'

/**
 * features/suppliers/utils/supplierErrors.ts
 * -----------------------------------------------------------------------------
 * Traduce un `AxiosError` de las mutaciones de Proveedores a un mensaje
 * entendible, en vez del texto tecnico de Axios ("Request failed with
 * status code 409"). Mismo patron ya usado en
 * `features/categories/utils/categoryErrors.ts`/`features/taxes/utils/taxErrors.ts`:
 * el envelope de error del backend es `{ error: { message } }`
 * (`shared/utils/httpResponse.ts`), asi que se prioriza ese mensaje real
 * del servidor sobre cualquier fallback generico.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getSupplierErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos del proveedor: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'El proveedor no existe o fue eliminado.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar el proveedor. Intenta de nuevo.'
}
