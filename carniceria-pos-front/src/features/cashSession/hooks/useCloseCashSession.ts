import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { CASH_AFFECTED_QUERY_KEYS } from '@/features/reports/constants/reportQueryKeys'
import { cashSessionsApi } from '../api/cashSessions.api'
import type { CashSession, CloseCashSessionDto } from '../types/cashSession.types'

export function useCloseCashSession() {
  const queryClient = useQueryClient()

  return useMutation<CashSession, AxiosError, { id: string; dto: CloseCashSessionDto }>({
    mutationFn: ({ id, dto }) => cashSessionsApi.closeCashSession(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] })
      // Cerrar la sesion finaliza sus montos (contado/esperado/diferencia),
      // que es justamente lo que muestra el reporte de caja — Bloque C:
      // solo esa query de reportes (cerrar una sesion no cambia ninguna
      // `Sale`/`Purchase`, asi que el resto de reportes no se ve afectado).
      for (const queryKey of CASH_AFFECTED_QUERY_KEYS) {
        queryClient.invalidateQueries({ queryKey })
      }
      // Cerrar la sesion resuelve la alerta CASH_SESSION_OPEN_TOO_LONG del
      // Centro de Notificaciones.
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
