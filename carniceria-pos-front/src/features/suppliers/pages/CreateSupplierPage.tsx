import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreateSupplier } from '../hooks/useCreateSupplier'
import { SupplierForm } from '../components/SupplierForm'
import { getSupplierErrorMessage } from '../utils/supplierErrors'
import type { CreateSupplierDto } from '../types/supplier.types'

export function CreateSupplierPage() {
  const navigate = useNavigate()
  const {
    mutate: createSupplier,
    isPending,
    isError,
    error,
  } = useCreateSupplier()

  const handleSubmit = (values: CreateSupplierDto) => {
    createSupplier(values, {
      onSuccess: () => {
        toast.success('Proveedor creado correctamente.')
        navigate('/suppliers')
      },
    })
  }

  const handleCancel = () => {
    navigate('/suppliers')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Proveedores', href: '/suppliers' },
          { label: 'Nuevo proveedor' },
        ]}
        title="Nuevo proveedor"
        description="Registra un nuevo proveedor en el catálogo."
      />

      {isError && <ErrorAlert>{getSupplierErrorMessage(error)}</ErrorAlert>}

      <SupplierForm
        mode="create"
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}