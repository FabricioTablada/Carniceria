import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { useInventoryItem } from '../hooks/useInventoryItem'
import { useUpdateInventory } from '../hooks/useUpdateInventory'
import { InventoryAdjustForm } from '../components/InventoryAdjustForm'
import { getInventoryErrorMessage } from '../utils/inventoryErrors'
import type { UpdateInventoryDto } from '../types/inventory.types'

/**
 * features/inventory/pages/InventoryAdjustPage.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — adaptación al estándar visual (`PageHeader` con
 * `breadcrumb`, ancho acotado en vez de una pantalla casi vacía). Sigue
 * siendo una ruta dedicada (`/inventory/:id/adjust`), sin convertirse en
 * Drawer — no fue parte de lo aprobado para este bloque. Mismo `id`,
 * misma `defaultValues`, mismo `onSubmit`/`onCancel`, cero cambios de
 * lógica. QA Final 1.0 (Bloque 4): la ruta ya tiene `RequirePermission`
 * (`inventory.adjust`, ver `routes/index.tsx`) — el hallazgo pendiente de
 * un sprint anterior quedó cerrado.
 */
export function InventoryAdjustPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: inventoryItem,
    isLoading,
    isError,
    error,
  } = useInventoryItem(id ?? '')
  const { mutate: updateInventory, isPending } = useUpdateInventory()

  const handleSubmit = (values: UpdateInventoryDto) => {
    if (!id) {
      return
    }

    updateInventory(
      { id, dto: values },
      {
        onSuccess: () => {
          navigate('/inventory')
        },
        onError: (error) => toast.error(getInventoryErrorMessage(error)),
      },
    )
  }

  const handleCancel = () => {
    navigate('/inventory')
  }

  if (isLoading) {
    return <LoadingState message="Cargando existencia..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar la existencia.'}
      </ErrorAlert>
    )
  }

  if (!inventoryItem) {
    return (
      <p className="text-sm text-muted-foreground">
        La existencia no existe.
      </p>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Inventario', href: '/inventory' },
          { label: 'Ajustar inventario' },
        ]}
        title="Ajustar inventario"
        description={`${inventoryItem.product.name}${
          inventoryItem.product.sku ? ` · SKU ${inventoryItem.product.sku}` : ''
        }`}
      />

      <InventoryAdjustForm
        product={inventoryItem.product}
        defaultValues={{
          quantity: inventoryItem.quantity,
          reorderPoint: inventoryItem.reorderPoint,
        }}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}
