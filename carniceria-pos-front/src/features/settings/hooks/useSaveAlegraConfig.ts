import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { alegraApi } from '../api/alegra.api'
import type { AlegraConfigStatus, SaveAlegraConfigDto } from '../types/alegra.types'

export function useSaveAlegraConfig() {
  const queryClient = useQueryClient()

  return useMutation<AlegraConfigStatus, AxiosError, SaveAlegraConfigDto>({
    mutationFn: (dto) => alegraApi.saveConfig(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'alegra'] })
    },
  })
}
