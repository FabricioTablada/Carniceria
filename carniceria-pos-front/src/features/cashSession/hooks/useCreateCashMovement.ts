import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { CASH_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { cashMovementsApi } from '../api/cashMovements.api'
import type { CreateCashMovementDto } from '../types/cashSession.types'

export function useCreateCashMovement() {
  const queryClient = useQueryClient()

  return useMutation<unknown, AxiosError, CreateCashMovementDto>({
    mutationFn: (dto) => cashMovementsApi.createCashMovement(dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cash-sessions', 'detail', variables.cashSessionId],
      })
      // Un deposito/retiro cambia el efectivo esperado de la sesion, que
      // el reporte de caja tambien refleja — Bloque C: solo esa query de
      // reportes, no el prefijo completo 'reports'.
      for (const queryKey of CASH_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
      // Rediseño de Caja: la pestaña "Movimientos" (`useCashMovements`)
      // muestra el movimiento recién creado.
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] })
    },
  })
}
