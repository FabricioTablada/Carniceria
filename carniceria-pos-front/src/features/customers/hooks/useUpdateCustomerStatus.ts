import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { customersApi } from '../api/customers.api'
import type { ChangeCustomerStatusDto, Customer } from '../types/customer.types'

export function useUpdateCustomerStatus() {
  const queryClient = useQueryClient()

  return useMutation<Customer, AxiosError, { id: string; dto: ChangeCustomerStatusDto }>({
    mutationFn: ({ id, dto }) => customersApi.updateCustomerStatus(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
