import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { SALES_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { salesApi } from '../api/sales.api'
import type { Sale, UpdateSaleDto } from '../types/sale.types'

export function useUpdateSale() {
  const queryClient = useQueryClient()

  return useMutation<Sale, AxiosError, { id: string; dto: UpdateSaleDto }>({
    mutationFn: ({ id, dto }) => salesApi.updateSale(id, dto),
    onSuccess: () => {
      // `UpdateSaleDto` permite cambiar `status` (ej. a CANCELLED/REFUNDED),
      // lo que revierte el descuento de stock hecho al crear la venta.
      // Corrección del sistema de invalidación (aprobado): único punto de
      // mantenimiento por evento de dominio — ver `reportQueryKeys.ts`.
      for (const queryKey of SALES_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
