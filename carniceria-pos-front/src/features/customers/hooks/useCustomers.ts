import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { customersApi } from '../api/customers.api'
import type { CustomerFilters, PaginatedCustomersResponse } from '../types/customer.types'

export function useCustomers(filters?: CustomerFilters) {
  return useQuery<PaginatedCustomersResponse, AxiosError>({
    queryKey: ['customers', 'list', filters],
    queryFn: () => customersApi.getCustomers(filters),
  })
}
