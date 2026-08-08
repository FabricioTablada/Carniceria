import { AxiosError } from 'axios'

/**
 * features/products/utils/productErrors.ts
 * -----------------------------------------------------------------------------
 * Traduce un `AxiosError` de las mutaciones de Productos a un mensaje
 * entendible, en vez del texto tecnico de Axios ("Request failed with
 * status code 409"). Mismo patron ya usado en
 * `features/purchases/utils/purchaseErrors.ts`/`features/auth/hooks/useLogin.ts`
 * (`getAuthErrorMessage`): el envelope de error del backend es
 * `{ error: { message } }` (`shared/utils/httpResponse.ts`), asi que se
 * prioriza ese mensaje real del servidor sobre cualquier fallback
 * generico — el `409` que motivo este archivo (SKU/codigo de barras
 * duplicado) normalmente ya trae un mensaje util del backend; el texto de
 * `409` de aca abajo es solo el respaldo para cuando no lo trae.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getProductErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 409) {
      return 'Ya existe un producto con ese SKU o código de barras.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos del producto: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'El producto no existe o fue eliminado.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar el producto. Intenta de nuevo.'
}

/** Bloque 10 (gestion de imagenes): mismo criterio que
 * `getProductErrorMessage`, con mensajes propios para el flujo de
 * subida/eliminacion de imagen (422 de validacion de archivo — formato o
 * tamaño — en vez del 400/409 de los datos del producto). */
export function getProductImageErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 404) {
      return 'El producto no existe o fue eliminado.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'No se pudo subir la imagen. Intenta de nuevo.'
}
