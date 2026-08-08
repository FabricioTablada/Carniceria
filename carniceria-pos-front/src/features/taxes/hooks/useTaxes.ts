import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { taxesApi } from '../api/taxes.api'
import type { PaginatedTaxesResponse, TaxFilters } from '../types/tax.types'

export function useTaxes(filters?: TaxFilters) {
  return useQuery<PaginatedTaxesResponse, AxiosError>({
    queryKey: ['taxes', 'list', filters],
    queryFn: () => taxesApi.getTaxes(filters),
  })
}