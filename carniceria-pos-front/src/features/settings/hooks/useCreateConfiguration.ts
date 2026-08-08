import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { configurationApi } from '../api/configuration.api'
import type { Configuration, CreateConfigurationDto } from '../types/configuration.types'

export function useCreateConfiguration() {
  const queryClient = useQueryClient()

  return useMutation<Configuration, AxiosError, CreateConfigurationDto>({
    mutationFn: (dto) => configurationApi.createConfiguration(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configurations'] })
    },
  })
}