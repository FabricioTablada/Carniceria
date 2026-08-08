import { AxiosError } from 'axios'

/**
 * features/settings/utils/settingsErrors.ts
 * -----------------------------------------------------------------------------
 * QA.15 (Configuración): traduce un `AxiosError` de las mutaciones de
 * Configuración/Alegra a un mensaje entendible, en vez del texto técnico de
 * Axios ("Request failed with status code 400"). Mismo patrón ya usado en
 * `features/users/utils/userErrors.ts`/`features/roles/utils/roleErrors.ts`/
 * `features/permissions/utils/permissionErrors.ts`: el envelope de error del
 * backend es `{ error: { message } }` (`shared/utils/httpResponse.ts`), asi
 * que se prioriza ese mensaje real del servidor. Particularmente importante
 * para Alegra: sus errores reales (`alegra.client.ts::toAppError`) suelen
 * ser mensajes especificos y accionables (token faltante, timeout,
 * credenciales invalidas, respuesta de la API de Alegra) — mostrar el texto
 * generico de Axios en su lugar le esconde al usuario justo el dato que
 * necesita para resolver el problema.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getSettingsErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 401) {
      return 'Credenciales inválidas.'
    }

    if (error.response?.status === 403) {
      return 'No tenés permiso para realizar esta acción.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos ingresados: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'El recurso no existe.'
    }

    if (error.code === 'ECONNABORTED') {
      return 'La operación tardó demasiado en responder (timeout).'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar la solicitud. Intenta de nuevo.'
}
