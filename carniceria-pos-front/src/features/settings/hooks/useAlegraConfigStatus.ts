import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { alegraApi } from '../api/alegra.api'
import type { AlegraConfigStatus } from '../types/alegra.types'

/** Estado guardado de la integración con Alegra (Bloque 7.4, punto 7):
 * `GET /integrations/alegra/config` nunca llama a Alegra, solo lee lo ya
 * persistido — por eso esta query no necesita `refetchInterval` ni
 * `refetchOnWindowFocus` propio, hereda el comportamiento estándar del
 * `QueryClient` (sin "consultas innecesarias a Alegra"). */
export function useAlegraConfigStatus() {
  return useQuery<AlegraConfigStatus, AxiosError>({
    queryKey: ['integrations', 'alegra', 'config'],
    queryFn: () => alegraApi.getConfigStatus(),
  })
}
