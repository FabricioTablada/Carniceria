import { useMutation } from '@tanstack/react-query'
import { cabysCatalogApi } from '../api/cabysCatalog.api'

/**
 * features/settings/hooks/useCabysCatalogSync.ts
 * -----------------------------------------------------------------------------
 * Bloque "Actualización inteligente del catálogo CABYS" — tres acciones,
 * todas disparadas manualmente por el usuario desde `CabysCatalogPage.tsx`
 * (nunca automáticas, nunca en el montaje de la página): por eso las tres
 * son `useMutation`, no `useQuery` con refetch automático — ni siquiera la
 * verificación (que es de solo lectura) debe dispararse sola.
 */
export function useCheckForCabysCatalogUpdates() {
  return useMutation({
    mutationFn: cabysCatalogApi.checkForUpdates,
  })
}

export function usePreviewCabysCatalogUpdate() {
  return useMutation({
    mutationFn: cabysCatalogApi.previewUpdate,
  })
}

export function useApplyCabysCatalogUpdate() {
  return useMutation({
    mutationFn: (previewToken: string) => cabysCatalogApi.applyUpdate(previewToken),
  })
}
