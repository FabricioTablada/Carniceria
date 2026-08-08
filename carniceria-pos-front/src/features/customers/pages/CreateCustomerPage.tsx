import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreateCustomer } from '../hooks/useCreateCustomer'
import { CustomerForm } from '../components/CustomerForm'
import type { CreateCustomerDto } from '../types/customer.types'

export function CreateCustomerPage() {
  const navigate = useNavigate()
  const { mutate: createCustomer, isPending, isError, error } = useCreateCustomer()

  const handleSubmit = (values: CreateCustomerDto) => {
    createCustomer(values, {
      onSuccess: () => {
        toast.success('Cliente creado correctamente.')
        navigate('/customers')
      },
    })
  }

  const handleCancel = () => {
    navigate('/customers')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Clientes', href: '/customers' },
          { label: 'Nuevo cliente' },
        ]}
        title="Nuevo cliente"
        description="Registra un nuevo cliente en el catálogo."
      />

      {isError && (
        <ErrorAlert>{error?.message ?? 'Ocurrió un error al crear el cliente.'}</ErrorAlert>
      )}

      <CustomerForm mode="create" isSubmitting={isPending} onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  )
}
