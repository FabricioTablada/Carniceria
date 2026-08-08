import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { configurationApi } from '../api/configuration.api'
import type { Configuration } from '../types/configuration.types'

export function useConfiguration(id: string) {
  return useQuery<Configuration, AxiosError>({
    queryKey: ['configurations', 'detail', id],
    queryFn: () => configurationApi.getConfigurationById(id),
    enabled: Boolean(id),
  })
}