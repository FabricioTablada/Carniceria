import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { INVENTORY_WASTE_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { inventoryApi } from '../api/inventory.api'

/**
 * features/inventory/hooks/useDeleteInventoryWaste.ts
 * -----------------------------------------------------------------------------
 * Bloque "Eliminación de Mermas" (aprobado, ADMIN únicamente). El backend
 * revierte el descuento de stock de la merma eliminada (mismo
 * `recordMovement` de siempre) antes de borrar el registro — mismo evento
 * de dominio que registrar una merma, así que reutiliza EXACTAMENTE
 * `INVENTORY_WASTE_AFFECTED_QUERY_KEYS` (`reportQueryKeys.ts`, sistema de
 * invalidación centralizado): tabla, KPIs, vista Análisis y reportes de
 * inventario/lotes se refrescan solos, sin recargar la página.
 */
export function useDeleteInventoryWaste() {
  const queryClient = useQueryClient()

  return useMutation<void, AxiosError, string>({
    mutationFn: (id) => inventoryApi.deleteWaste(id),
    onSuccess: () => {
      for (const queryKey of INVENTORY_WASTE_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
