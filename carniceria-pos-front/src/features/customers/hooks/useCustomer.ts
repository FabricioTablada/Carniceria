import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { customersApi } from '../api/customers.api'
import type { Customer } from '../types/customer.types'

export function useCustomer(id: string) {
  return useQuery<Customer, AxiosError>({
    queryKey: ['customers', 'detail', id],
    queryFn: () => customersApi.getCustomerById(id),
    enabled: Boolean(id),
  })
}
