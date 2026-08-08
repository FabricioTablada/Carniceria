import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from 'sonner'
import { usePurchase } from '../hooks/usePurchase'
import { useUpdatePurchase } from '../hooks/useUpdatePurchase'
import { EditPurchaseForm } from '../components/EditPurchaseForm'
import { getPurchaseErrorMessage } from '../utils/purchaseErrors'
import type { UpdatePurchaseDto } from '../types/purchase.types'

export function EditPurchasePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: purchase,
    isLoading,
    isError,
    error,
  } = usePurchase(id ?? '')
  const {
    mutate: updatePurchase,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdatePurchase()

  const handleSubmit = (values: UpdatePurchaseDto) => {
    if (!id) {
      return
    }

    updatePurchase(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Compra actualizada correctamente.')
          navigate('/purchases')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/purchases')
  }

  if (isLoading) {
    return <LoadingState message="Cargando compra..." />
  }

  if (isError) {
    return <ErrorAlert>{getPurchaseErrorMessage(error)}</ErrorAlert>
  }

  if (!purchase) {
    return (
      <p className="text-sm text-muted-foreground">La compra no existe.</p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Compras', href: '/purchases' },
          { label: 'Editar compra' },
        ]}
        title="Editar compra"
        description="Actualiza los datos de la compra registrada."
        action={
          <Button type="button" variant="outline" onClick={handleCancel} className="gap-2 rounded-xl">
            <ArrowLeft className="size-4" />
            Volver a compras
          </Button>
        }
      />

      {isUpdateError && <ErrorAlert>{getPurchaseErrorMessage(updateError)}</ErrorAlert>}

      <EditPurchaseForm
        defaultValues={{
          // `sucursalId`/`userId` NO se incluyen: aunque UpdatePurchaseDto
          // los admite, ninguno de los formularios de este modulo los
          // expone (hallazgo documentado, sin fuente de datos en el
          // frontend) — mismo criterio ya aplicado en PurchaseForm.tsx.
          //
          // `purchaseDate` se recorta a los primeros 10 caracteres
          // (`"YYYY-MM-DD"`): el backend devuelve un ISO completo con hora
          // y zona ("...T00:00:00.000Z"), pero <input type="date"> exige
          // exactamente `YYYY-MM-DD`, sin hora ni zona. Pasarle el string
          // completo produce un desajuste que el navegador puede
          // interpretar mal — se corta explicitamente para evitarlo, sin
          // pasar nunca por `new Date()` (que si esta sujeto a la zona
          // horaria local).
          supplierId: purchase.supplierId,
          documentNumber: purchase.documentNumber,
          status: purchase.status,
          purchaseDate: purchase.purchaseDate.slice(0, 10),
          notes: purchase.notes,
        }}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialSupplier={purchase.supplier}
      />
    </div>
  )
}