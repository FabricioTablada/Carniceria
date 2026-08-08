import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreatePurchase } from '../hooks/useCreatePurchase'
import { PurchaseForm } from '../components/PurchaseForm'
import { getPurchaseErrorMessage } from '../utils/purchaseErrors'
import type { CreatePurchaseDto } from '../types/purchase.types'

export function CreatePurchasePage() {
  const navigate = useNavigate()
  // Rediseño de Proveedores (aprobado): "Nueva compra a este proveedor"
  // (`SupplierDrawer.tsx`) navega acá con `state: { supplierId }` — mismo
  // mecanismo `location.state` ya construido para Categorías/Impuestos
  // (`ProductsPage.tsx`).
  const location = useLocation()
  const initialSupplierId = (location.state as { supplierId?: string } | null)?.supplierId
  const {
    mutate: createPurchase,
    isPending,
    isError,
    error,
  } = useCreatePurchase()

  const handleSubmit = (values: CreatePurchaseDto) => {
    createPurchase(values, {
      onSuccess: () => {
        toast.success('Compra creada correctamente.')
        navigate('/purchases')
      },
    })
  }

  const handleCancel = () => {
    navigate('/purchases')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Compras', href: '/purchases' },
          { label: 'Nueva compra' },
        ]}
        title="Nueva compra"
        description="Registra una nueva compra a proveedor."
        action={
          <Button type="button" variant="outline" onClick={handleCancel} className="gap-2 rounded-xl">
            <ArrowLeft className="size-4" />
            Volver a compras
          </Button>
        }
      />

      {isError && <ErrorAlert>{getPurchaseErrorMessage(error)}</ErrorAlert>}

      <PurchaseForm
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        initialSupplierId={initialSupplierId}
      />
    </div>
  )
}