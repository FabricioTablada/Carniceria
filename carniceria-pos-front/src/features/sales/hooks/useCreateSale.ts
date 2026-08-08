import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { SALES_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { salesApi } from '../api/sales.api'
import type { CreateSaleDto, Sale } from '../types/sale.types'

export function useCreateSale() {
  const queryClient = useQueryClient()

  return useMutation<Sale, AxiosError, CreateSaleDto>({
    mutationFn: (dto) => salesApi.createSale(dto),
    onSuccess: () => {
      // Corrección del sistema de invalidación (aprobado): único punto de
      // mantenimiento por evento de dominio — ver `reportQueryKeys.ts`
      // (`SALES_AFFECTED_QUERY_KEYS`, incluye `sales`/`inventory`/
      // `products`/reportes derivados de ventas/`notifications`).
      for (const queryKey of SALES_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
