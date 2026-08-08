import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { customersApi } from '../api/customers.api'
import type { Customer, UpdateCustomerDto } from '../types/customer.types'

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation<Customer, AxiosError, { id: string; dto: UpdateCustomerDto }>({
    mutationFn: ({ id, dto }) => customersApi.updateCustomer(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
