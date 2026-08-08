import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { taxesApi } from '../api/taxes.api'
import type { Tax } from '../types/tax.types'

export function useTax(id: string) {
  return useQuery<Tax, AxiosError>({
    queryKey: ['taxes', 'detail', id],
    queryFn: () => taxesApi.getTaxById(id),
    enabled: Boolean(id),
  })
}