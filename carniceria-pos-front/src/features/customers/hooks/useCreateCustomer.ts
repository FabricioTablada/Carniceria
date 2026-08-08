import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { customersApi } from '../api/customers.api'
import type { CreateCustomerDto, Customer } from '../types/customer.types'

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation<Customer, AxiosError, CreateCustomerDto>({
    mutationFn: (dto) => customersApi.createCustomer(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
