import { AxiosError } from 'axios'

/**
 * features/permissions/utils/permissionErrors.ts
 * -----------------------------------------------------------------------------
 * QA.12 (Permisos): traduce un `AxiosError` de las mutaciones de Permisos a
 * un mensaje entendible, en vez del texto tecnico de Axios ("Request failed
 * with status code 403"). Mismo patron ya usado en
 * `features/suppliers/utils/supplierErrors.ts`/`features/taxes/utils/taxErrors.ts`/
 * `features/promotions/utils/promotionErrors.ts`/`features/users/utils/userErrors.ts`/
 * `features/roles/utils/roleErrors.ts`: el envelope de error del backend es
 * `{ error: { message } }` (`shared/utils/httpResponse.ts`), asi que se
 * prioriza ese mensaje real del servidor. Este modulo tampoco tenia esta
 * utilidad todavia — igual que Usuarios/Roles (QA.10/QA.11), sus reglas de
 * negocio devuelven un 403 con mensaje especifico (intentar modificar el
 * `code` de un permiso ya creado) que vale la pena mostrar tal cual.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getPermissionErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 403) {
      return 'No tenés permiso para realizar esta acción.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos del permiso: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'El permiso no existe.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar el permiso. Intenta de nuevo.'
}
