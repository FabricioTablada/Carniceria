import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { SALES_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { salesApi } from '../api/sales.api'
import type { Sale, VoidSaleDto } from '../types/sale.types'

/**
 * features/sales/hooks/useVoidSale.ts
 * -----------------------------------------------------------------------------
 * Bloque 3 ("Anulacion/Correccion de Venta"). Anular reversa el descuento
 * de stock hecho al crear la venta y cambia los reportes derivados de
 * ventas. Corrección del sistema de invalidación (aprobado): único punto
 * de mantenimiento por evento de dominio — ver `reportQueryKeys.ts`
 * (`SALES_AFFECTED_QUERY_KEYS`).
 */
export function useVoidSale() {
  const queryClient = useQueryClient()

  return useMutation<Sale, AxiosError, { id: string; dto: VoidSaleDto }>({
    mutationFn: ({ id, dto }) => salesApi.voidSale(id, dto),
    onSuccess: () => {
      for (const queryKey of SALES_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
