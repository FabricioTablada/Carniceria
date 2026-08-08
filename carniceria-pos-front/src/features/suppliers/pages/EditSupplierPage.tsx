import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from 'sonner'
import { useSupplier } from '../hooks/useSupplier'
import { useUpdateSupplier } from '../hooks/useUpdateSupplier'
import { SupplierForm } from '../components/SupplierForm'
import { getSupplierErrorMessage } from '../utils/supplierErrors'
import type { CreateSupplierDto } from '../types/supplier.types'

export function EditSupplierPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: supplier,
    isLoading,
    isError,
    error,
  } = useSupplier(id ?? '')
  const {
    mutate: updateSupplier,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateSupplier()

  const handleSubmit = (values: CreateSupplierDto) => {
    if (!id) {
      return
    }

    updateSupplier(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Proveedor actualizado correctamente.')
          navigate('/suppliers')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/suppliers')
  }

  if (isLoading) {
    return <LoadingState message="Cargando proveedor..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar el proveedor.'}
      </ErrorAlert>
    )
  }

  if (!supplier) {
    return (
      <p className="text-sm text-muted-foreground">
        El proveedor no existe.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Proveedores', href: '/suppliers' },
          { label: 'Editar proveedor' },
        ]}
        title="Editar proveedor"
        description="Actualiza los datos del proveedor seleccionado."
      />

      {isUpdateError && <ErrorAlert>{getSupplierErrorMessage(updateError)}</ErrorAlert>}

      <SupplierForm
        mode="update"
        defaultValues={{
          name: supplier.name,
          legalId: supplier.legalId,
          contactName: supplier.contactName,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
        }}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialActive={supplier.active}
      />
    </div>
  )
}