import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { documentsApi } from '../api/documents.api'
import type { DocumentDefinition, DocumentType } from '../types/document.types'

/**
 * features/documents/hooks/useDocumentDefinition.ts
 * -----------------------------------------------------------------------------
 * Bloque 13.10 — trae la `DocumentDefinition` (capacidades incluidas) de
 * `type`, para que cualquier modulo del ERP decida que acciones habilitar
 * sin conocer el `DocumentRegistry` del backend ni duplicar sus valores.
 * Reutilizable por cualquier tipo de documento, no solo `SALE_RECEIPT`.
 */
export function useDocumentDefinition(type: DocumentType) {
  return useQuery<DocumentDefinition, AxiosError>({
    queryKey: ['documents', 'definition', type],
    queryFn: () => documentsApi.getDefinition(type),
  })
}
