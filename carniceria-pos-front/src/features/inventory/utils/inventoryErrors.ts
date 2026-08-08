import { AxiosError } from 'axios'

/**
 * features/inventory/utils/inventoryErrors.ts
 * -----------------------------------------------------------------------------
 * QA Final 1.0 (Bloque 4): traduce un `AxiosError` de las mutaciones de
 * Inventario (ajuste de existencia, registro de merma) a un mensaje
 * entendible, en vez del texto técnico de Axios ("Request failed with
 * status code 409") — antes de este bloque, `InventoryPage.tsx`/
 * `InventoryAdjustPage.tsx` mostraban directamente `error.message` (el
 * mensaje genérico de Axios, nunca el mensaje real del backend),
 * escondiéndole al usuario el motivo real de un rechazo (p.ej. "Ya existe
 * un registro de inventario para este producto en esta sucursal.", o una
 * validación real de `inventoryWaste/service.ts`). Mismo patrón ya usado en
 * `features/suppliers/utils/supplierErrors.ts`/`features/promotions/utils/promotionErrors.ts`:
 * el envelope de error del backend es `{ error: { message } }`
 * (`shared/utils/httpResponse.ts`), asi que se prioriza ese mensaje real
 * del servidor sobre cualquier fallback genérico.
 */
interface ApiErrorResponse {
  error?: {
    message?: string
  }
}

export function getInventoryErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined

    if (data?.error?.message) {
      return data.error.message
    }

    if (error.response?.status === 409) {
      return 'Ya existe un registro de inventario para este producto en esta sucursal.'
    }

    if (error.response?.status === 400) {
      return 'Revisa los datos del ajuste: hay campos incompletos o inválidos.'
    }

    if (error.response?.status === 404) {
      return 'El registro de inventario no existe o fue eliminado.'
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor.'
    }
  }

  return 'Ocurrió un error al procesar la operación de inventario. Intenta de nuevo.'
}
