import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from 'sonner'
import { useTax } from '../hooks/useTax'
import { useUpdateTax } from '../hooks/useUpdateTax'
import { TaxForm } from '../components/TaxForm'
import { getTaxErrorMessage } from '../utils/taxErrors'
import type { CreateTaxDto } from '../types/tax.types'

export function EditTaxPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: tax, isLoading, isError, error } = useTax(id ?? '')
  const {
    mutate: updateTax,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateTax()

  const handleSubmit = (values: CreateTaxDto) => {
    if (!id) {
      return
    }

    updateTax(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Impuesto actualizado correctamente.')
          navigate('/taxes')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/taxes')
  }

  if (isLoading) {
    return <LoadingState message="Cargando impuesto..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar el impuesto.'}
      </ErrorAlert>
    )
  }

  if (!tax) {
    return (
      <p className="text-sm text-muted-foreground">El impuesto no existe.</p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Impuestos', href: '/taxes' },
          { label: 'Editar impuesto' },
        ]}
        title="Editar impuesto"
        description="Actualiza los datos del impuesto seleccionado."
      />

      {isUpdateError && <ErrorAlert>{getTaxErrorMessage(updateError)}</ErrorAlert>}

      <TaxForm
        mode="update"
        defaultValues={{
          code: tax.code,
          name: tax.name,
          rate: tax.rate,
          isDefault: tax.isDefault,
        }}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialActive={tax.active}
      />
    </div>
  )
}