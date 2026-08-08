import { AxiosError } from 'axios'

/**
 * features/users/utils/userErrors.ts
 * -----------------------------------------------------------------------------
 * QA.10 (Usuarios): traduce un `AxiosError` de las mutaciones de Usuarios a
 * un mensaje entendible, en vez del texto tecnico de Axios ("Request failed
 * with status code 403"). Mismo patron ya usado en
 * `features/suppliers/utils/supplierErrors.ts`/`features/taxes/utils/taxErrors.ts`/
 * `features/promotions/utils/promotionErrors.ts`: el envelope de error del
 * backend es `{ error: { message } }` (`shared/utils/httpResponse.ts`), asi
 * que se prioriza ese mensaje real del servidor sobre cualquier fallback
 * generico. Este modulo no tenia esta utilidad todavia — a diferencia del
 * resto, sus reglas de negocio devuelven varios 403 con mensajes especificos
 * (auto-cambio de rol, asignacion del rol ADMIN, auto-desactivacion) que
 * vale la pena mostrar tal cual, no solo el fallback generico de 403.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getUserErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 403) {
      return 'No tenés permiso para realizar esta acción.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos del usuario: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'El usuario no existe o fue eliminado.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar el usuario. Intenta de nuevo.'
}
