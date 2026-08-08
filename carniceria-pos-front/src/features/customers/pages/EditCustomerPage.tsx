import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from 'sonner'
import { useCustomer } from '../hooks/useCustomer'
import { useUpdateCustomer } from '../hooks/useUpdateCustomer'
import { CustomerForm } from '../components/CustomerForm'
import type { CreateCustomerDto } from '../types/customer.types'

export function EditCustomerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: customer, isLoading, isError, error } = useCustomer(id ?? '')
  const {
    mutate: updateCustomer,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateCustomer()

  const handleSubmit = (values: CreateCustomerDto) => {
    if (!id) {
      return
    }

    updateCustomer(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Cliente actualizado correctamente.')
          navigate('/customers')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/customers')
  }

  if (isLoading) {
    return <LoadingState message="Cargando cliente..." />
  }

  if (isError) {
    return <ErrorAlert>{error?.message ?? 'Ocurrió un error al cargar el cliente.'}</ErrorAlert>
  }

  if (!customer) {
    return <p className="text-sm text-muted-foreground">El cliente no existe.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Clientes', href: '/customers' },
          { label: 'Editar cliente' },
        ]}
        title="Editar cliente"
        description="Actualiza los datos del cliente seleccionado."
      />

      {isUpdateError && (
        <ErrorAlert>{updateError?.message ?? 'Ocurrió un error al actualizar el cliente.'}</ErrorAlert>
      )}

      <CustomerForm
        mode="update"
        defaultValues={{
          name: customer.name,
          identificationType: customer.identificationType,
          identificationNumber: customer.identificationNumber,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        }}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialActive={customer.active}
      />
    </div>
  )
}
