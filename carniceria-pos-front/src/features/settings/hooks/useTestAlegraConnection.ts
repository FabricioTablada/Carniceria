import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { alegraApi } from '../api/alegra.api'
import type { AlegraConnectionTestResult, AlegraTestConnectionDto } from '../types/alegra.types'

/** No invalida ninguna query: "Probar conexión" no cambia nada persistido
 * (ver `alegra.service.ts`, backend: es una acción de solo lectura contra
 * Alegra), así que no hay ningún estado local que refrescar tras ella. */
export function useTestAlegraConnection() {
  return useMutation<AlegraConnectionTestResult, AxiosError, AlegraTestConnectionDto>({
    mutationFn: (dto) => alegraApi.testConnection(dto),
  })
}
