import { httpClient } from '@/lib/htpp/client'
import type {
  CashMovementType,
  CreateCashMovementDto,
  ListCashMovementsFilters,
  PaginatedCashMovementsResponse,
} from '../types/cashSession.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

/** Movimiento de caja tal como lo expone el backend al registrarlo. */
interface CashMovement {
  id: string
  sucursalId: string
  cashSessionId: string
  userId: string
  type: CashMovementType
  amount: number
  reason: string
  createdAt: string
  updatedAt: string
}

export const cashMovementsApi = {
  createCashMovement: async (
    data: CreateCashMovementDto,
  ): Promise<CashMovement> => {
    const { data: response } = await httpClient.post<ApiEnvelope<CashMovement>>(
      '/cash/movements',
      data,
    )

    return response.data
  },

  // Rediseño de Caja: primer consumo de `GET /cash/movements` — endpoint
  // ya existente en el backend (`cash-movements.view`), sin cambios.
  getCashMovements: async (
    filters?: ListCashMovementsFilters,
  ): Promise<PaginatedCashMovementsResponse> => {
    const { data } = await httpClient.get<PaginatedCashMovementsResponse>('/cash/movements', {
      params: filters,
    })

    return data
  },
}