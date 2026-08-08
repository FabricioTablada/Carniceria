import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { cashRegistersApi } from '../api/cashRegisters.api'
import type {
  CashRegisterFilters,
  PaginatedCashRegistersResponse,
} from '../types/cashRegister.types'

export function useCashRegisters(filters?: CashRegisterFilters) {
  return useQuery<PaginatedCashRegistersResponse, AxiosError>({
    queryKey: ['cash-registers', filters],
    queryFn: () => cashRegistersApi.getCashRegisters(filters),
  })
}