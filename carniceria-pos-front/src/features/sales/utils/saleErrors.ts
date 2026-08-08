import { AxiosError } from 'axios'

/**
 * features/sales/utils/saleErrors.ts
 * -----------------------------------------------------------------------------
 * Bloque POS-01: traduce un `AxiosError` de la cotizacion (`POST /sales/quote`)
 * o de la confirmacion de venta (`POST /sales`) a un mensaje entendible, en
 * vez del texto tecnico de Axios ("Request failed with status code 422/500").
 * Mismo patron ya usado en `features/products/utils/productErrors.ts`/
 * `features/purchases/utils/purchaseErrors.ts`: el envelope de error del
 * backend es `{ error: { message } }` (`shared/utils/httpResponse.ts`), asi
 * que se prioriza ese mensaje real del servidor sobre cualquier fallback
 * generico — el 422 de stock insuficiente (`assertSufficientStock()`,
 * backend) ya trae nombre del producto/cantidad disponible/cantidad
 * solicitada en ese mensaje, no hay que reconstruirlo aca.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getSaleErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 404) {
      return 'Uno de los productos o el impuesto de la venta ya no existe.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos de la venta: hay campos incompletos o inválidos.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar la venta. Intenta de nuevo.'
}
