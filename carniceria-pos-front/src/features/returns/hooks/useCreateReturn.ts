import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { SALES_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { returnsApi } from '../api/returns.api'
import type { CreateSaleReturnDto, SaleReturn } from '../types/return.types'

/**
 * features/returns/hooks/useCreateReturn.ts
 * -----------------------------------------------------------------------------
 * Bloque 4.3. Una devolucion reversa inventario (si corresponde) y afecta
 * lo que reportes/dashboard calculan a partir de ventas. Corrección del
 * sistema de invalidación (aprobado): único punto de mantenimiento por
 * evento de dominio — ver `reportQueryKeys.ts` (`SALES_AFFECTED_QUERY_KEYS`).
 * `['returns']` se mantiene aparte (propio de este hook, no compartido con
 * el resto de mutaciones de venta).
 *
 * Bloque 1 (QA de flujo de devoluciones): `onSuccess` es `async` y espera
 * (`Promise.all`) todas las invalidaciones antes de resolver. TanStack Query
 * espera este `onSuccess` del hook ANTES de despachar el estado "success"
 * que dispara el `onSuccess` por-llamada (el que cierra el detalle/vuelve a
 * la lista en `SaleDetailContent.tsx`) — sin este `await`, `invalidateQueries`
 * quedaba disparado pero no esperado, y la navegacion fuera del detalle
 * ocurria antes de que el refetch en segundo plano trajera los datos
 * frescos, dejando la UI momentaneamente desactualizada al reabrir la venta.
 */
export function useCreateReturn() {
  const queryClient = useQueryClient()

  return useMutation<SaleReturn, AxiosError, CreateSaleReturnDto>({
    mutationFn: (dto) => returnsApi.createReturn(dto),
    onSuccess: async () => {
      await Promise.all([
        ...SALES_AFFECTED_QUERY_KEYS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
        // Bloque 4.4: el historial de devoluciones de la venta
        // (`useSaleReturns`) debe refrescarse de inmediato al registrar una
        // devolucion nueva.
        queryClient.invalidateQueries({ queryKey: ['returns'] }),
      ])
    },
  })
}
