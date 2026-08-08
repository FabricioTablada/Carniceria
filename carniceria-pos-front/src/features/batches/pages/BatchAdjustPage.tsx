import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { useBatch } from '../hooks/useBatch'
import { useUpdateBatch } from '../hooks/useUpdateBatch'
import { BatchAdjustForm } from '../components/BatchAdjustForm'
import { getBatchErrorMessage } from '../utils/batchErrors'
import type { UpdateBatchDto } from '../types/batch.types'

/**
 * features/batches/pages/BatchAdjustPage.tsx
 * -----------------------------------------------------------------------------
 * Bloque LOTES-04 — mismo criterio que `InventoryAdjustPage.tsx`: ruta
 * dedicada (`/inventory/batches/:id/adjust`), ancho acotado, `PageHeader`
 * con `breadcrumb`.
 */
export function BatchAdjustPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: batch, isLoading, isError, error } = useBatch(id ?? '')
  const { mutate: updateBatch, isPending, error: updateError } = useUpdateBatch()

  const handleSubmit = (values: UpdateBatchDto) => {
    if (!id) {
      return
    }

    updateBatch(
      { id, dto: values },
      {
        onSuccess: () => {
          navigate('/inventory/batches')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/inventory/batches')
  }

  if (isLoading) {
    return <LoadingState message="Cargando lote..." />
  }

  if (isError) {
    return <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el lote.'}</ErrorAlert>
  }

  if (!batch) {
    return <p className="text-sm text-muted-foreground">El lote no existe.</p>
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Inventario', href: '/inventory' },
          { label: 'Lotes', href: '/inventory/batches' },
          { label: batch.code },
        ]}
        title={`Ajustar lote ${batch.code}`}
        description={`${batch.product.name}${batch.product.sku ? ` · SKU ${batch.product.sku}` : ''}`}
      />

      <BatchAdjustForm
        batch={batch}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />

      {updateError && <ErrorAlert>{getBatchErrorMessage(updateError)}</ErrorAlert>}
    </div>
  )
}
