import { httpClient } from '@/lib/htpp/client'
import type {
  ApplyCabysCatalogUpdateResult,
  CheckForCabysUpdatesResult,
  PreviewCabysCatalogUpdateResult,
} from '../types/cabysCatalog.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/**
 * features/settings/api/cabysCatalog.api.ts
 * -----------------------------------------------------------------------------
 * Único punto de comunicación con `/cabys/catalog` desde el frontend —
 * bloque "Actualización inteligente del catálogo CABYS". Mismo patrón que
 * `alegra.api.ts`: sin lógica propia, cada método solo llama al endpoint
 * correspondiente y devuelve `data.data`.
 */
export const cabysCatalogApi = {
  /** Liviano — el backend nunca descarga el archivo completo para responder. */
  checkForUpdates: async (): Promise<CheckForCabysUpdatesResult> => {
    const { data } = await httpClient.get<ApiEnvelope<CheckForCabysUpdatesResult>>(
      '/cabys/catalog/check-updates',
    )

    return data.data
  },

  /** Descarga a un archivo temporal del lado del backend, valida y compara
   * — nunca escribe nada todavía. */
  previewUpdate: async (): Promise<PreviewCabysCatalogUpdateResult> => {
    const { data } = await httpClient.post<ApiEnvelope<PreviewCabysCatalogUpdateResult>>(
      '/cabys/catalog/preview',
    )

    return data.data
  },

  /** Aplica exactamente el diff identificado por `previewToken` (el mismo
   * que ya se le mostró al usuario en el resumen de confirmación). */
  applyUpdate: async (previewToken: string): Promise<ApplyCabysCatalogUpdateResult> => {
    const { data } = await httpClient.post<ApiEnvelope<ApplyCabysCatalogUpdateResult>>(
      '/cabys/catalog/apply',
      { previewToken },
    )

    return data.data
  },
}
