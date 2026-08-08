import { AxiosError } from 'axios'

interface ApiErrorEnvelope {
  success: false
  error?: {
    code?: string
    message?: string
  }
}

/**
 * features/documents/utils/parseBlobError.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.12 (fix): cualquier llamada del Motor de Documentos hecha con
 * `responseType: 'blob'` (ej. `documentsApi.downloadPdf`, para poder
 * recibir bytes de PDF) recibe TAMBIEN sus errores como `Blob` — Axios no
 * los reinterpreta como JSON solo porque el status no sea 2xx. Sin esto,
 * el mensaje real que arma `errorHandler.middleware.ts` en el backend
 * (422 "no admite esa accion", 404, etc.) se pierde por completo y solo
 * queda el texto generico de Axios ("Request failed with status code
 * 422"). Decodifica ese `Blob` de vuelta a texto e intenta leer
 * `error.message` del sobre `{ success, error }` que ya usa toda la API.
 */
export async function parseBlobError(error: unknown, fallback: string): Promise<string> {
  if (!(error instanceof AxiosError)) {
    return fallback
  }

  const data: unknown = error.response?.data

  if (!(data instanceof Blob)) {
    return fallback
  }

  try {
    const text = await data.text()
    const parsed = JSON.parse(text) as ApiErrorEnvelope

    return parsed.error?.message ?? fallback
  } catch {
    return fallback
  }
}
