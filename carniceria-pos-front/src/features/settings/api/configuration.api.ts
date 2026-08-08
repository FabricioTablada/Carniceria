import { httpClient } from '@/lib/htpp/client'
import type {
  ConfigurationFilters,
  Configuration,
  CreateConfigurationDto,
  PaginatedConfigurationsResponse,
  UpdateConfigurationDto,
} from '../types/configuration.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const configurationApi = {
  getConfigurations: async (
    filters?: ConfigurationFilters,
  ): Promise<PaginatedConfigurationsResponse> => {
    const { data } = await httpClient.get<PaginatedConfigurationsResponse>(
      '/configuration',
      { params: filters },
    )

    return data
  },

  getConfigurationById: async (id: string): Promise<Configuration> => {
    const { data } = await httpClient.get<ApiEnvelope<Configuration>>(
      `/configuration/${id}`,
    )

    return data.data
  },

  createConfiguration: async (
    data: CreateConfigurationDto,
  ): Promise<Configuration> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Configuration>>(
      '/configuration',
      data,
    )

    return response.data
  },

  updateConfiguration: async (
    id: string,
    data: UpdateConfigurationDto,
  ): Promise<Configuration> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Configuration>>(
      `/configuration/${id}`,
      data,
    )

    return response.data
  },
}