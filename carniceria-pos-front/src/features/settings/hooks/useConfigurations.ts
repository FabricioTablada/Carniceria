import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { configurationApi } from '../api/configuration.api'
import type {
  ConfigurationFilters,
  PaginatedConfigurationsResponse,
} from '../types/configuration.types'

export function useConfigurations(filters?: ConfigurationFilters) {
  return useQuery<PaginatedConfigurationsResponse, AxiosError>({
    queryKey: ['configurations', 'list', filters],
    queryFn: () => configurationApi.getConfigurations(filters),
  })
}