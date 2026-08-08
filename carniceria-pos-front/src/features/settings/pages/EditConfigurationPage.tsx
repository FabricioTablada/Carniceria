import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from 'sonner'
import { useConfiguration } from '../hooks/useConfiguration'
import { useUpdateConfiguration } from '../hooks/useUpdateConfiguration'
import { ConfigurationForm } from '../components/ConfigurationForm'
import { getSettingsErrorMessage } from '../utils/settingsErrors'
import type { CreateConfigurationDto } from '../types/configuration.types'

export function EditConfigurationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: configuration,
    isLoading,
    isError,
    error,
  } = useConfiguration(id ?? '')
  const {
    mutate: updateConfiguration,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateConfiguration()

  const handleSubmit = (values: CreateConfigurationDto) => {
    if (!id) {
      return
    }

    updateConfiguration(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Configuración actualizada correctamente.')
          navigate('/settings')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/settings')
  }

  if (isLoading) {
    return <LoadingState message="Cargando configuración..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar la configuración.'}
      </ErrorAlert>
    )
  }

  if (!configuration) {
    return (
      <p className="text-sm text-muted-foreground">
        La configuración no existe.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Configuración', href: '/settings' },
          { label: 'Editar configuración' },
        ]}
        title="Editar configuración"
        description="Actualiza los datos de la configuración seleccionada."
      />

      {isUpdateError && <ErrorAlert>{getSettingsErrorMessage(updateError)}</ErrorAlert>}

      <ConfigurationForm
        mode="update"
        defaultValues={{
          key: configuration.key,
          value: configuration.value,
          type: configuration.type,
          description: configuration.description,
        }}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}