import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { SALES_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { salesApi } from '../api/sales.api'
import type { CorrectSaleDto, CorrectSaleResult } from '../types/sale.types'

/**
 * features/sales/hooks/useCorrectSale.ts
 * -----------------------------------------------------------------------------
 * Bloque 3 ("Anulacion/Correccion de Venta"). Anula la venta original y
 * crea una venta nueva en una sola operacion (ver `sales.service.ts` del
 * backend). Corrección del sistema de invalidación (aprobado): único
 * punto de mantenimiento por evento de dominio — ver `reportQueryKeys.ts`
 * (`SALES_AFFECTED_QUERY_KEYS`).
 */
export function useCorrectSale() {
  const queryClient = useQueryClient()

  return useMutation<CorrectSaleResult, AxiosError, { id: string; dto: CorrectSaleDto }>({
    mutationFn: ({ id, dto }) => salesApi.correctSale(id, dto),
    onSuccess: () => {
      for (const queryKey of SALES_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
