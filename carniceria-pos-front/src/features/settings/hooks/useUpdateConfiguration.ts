import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { configurationApi } from '../api/configuration.api'
import type { Configuration, UpdateConfigurationDto } from '../types/configuration.types'

export function useUpdateConfiguration() {
  const queryClient = useQueryClient()

  return useMutation<Configuration, AxiosError, { id: string; dto: UpdateConfigurationDto }>({
    mutationFn: ({ id, dto }) => configurationApi.updateConfiguration(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configurations'] })
    },
  })
}