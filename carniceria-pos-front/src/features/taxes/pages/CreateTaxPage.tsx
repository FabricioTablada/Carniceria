import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreateTax } from '../hooks/useCreateTax'
import { TaxForm } from '../components/TaxForm'
import { getTaxErrorMessage } from '../utils/taxErrors'
import type { CreateTaxDto } from '../types/tax.types'

export function CreateTaxPage() {
  const navigate = useNavigate()
  const { mutate: createTax, isPending, isError, error } = useCreateTax()

  const handleSubmit = (values: CreateTaxDto) => {
    createTax(values, {
      onSuccess: () => {
        toast.success('Impuesto creado correctamente.')
        navigate('/taxes')
      },
    })
  }

  const handleCancel = () => {
    navigate('/taxes')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Impuestos', href: '/taxes' },
          { label: 'Nuevo impuesto' },
        ]}
        title="Nuevo impuesto"
        description="Registra un nuevo impuesto en el catálogo."
      />

      {isError && <ErrorAlert>{getTaxErrorMessage(error)}</ErrorAlert>}

      <TaxForm
        mode="create"
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}