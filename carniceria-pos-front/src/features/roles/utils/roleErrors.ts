import { AxiosError } from 'axios'

/**
 * features/roles/utils/roleErrors.ts
 * -----------------------------------------------------------------------------
 * QA.11 (Roles): traduce un `AxiosError` de las mutaciones de Roles a un
 * mensaje entendible, en vez del texto tecnico de Axios ("Request failed
 * with status code 403"). Mismo patron ya usado en
 * `features/suppliers/utils/supplierErrors.ts`/`features/taxes/utils/taxErrors.ts`/
 * `features/promotions/utils/promotionErrors.ts`/`features/users/utils/userErrors.ts`:
 * el envelope de error del backend es `{ error: { message } }`
 * (`shared/utils/httpResponse.ts`), asi que se prioriza ese mensaje real del
 * servidor. Este modulo tampoco tenia esta utilidad todavia — igual que
 * Usuarios (QA.10), sus reglas de negocio devuelven varios 403 con mensajes
 * especificos (rol de sistema no desactivable/no renombrable, ADMIN no
 * puede perder "roles.manage") que vale la pena mostrar tal cual.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getRoleErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 403) {
      return 'No tenés permiso para realizar esta acción.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos del rol: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'El rol no existe o fue eliminado.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar el rol. Intenta de nuevo.'
}
