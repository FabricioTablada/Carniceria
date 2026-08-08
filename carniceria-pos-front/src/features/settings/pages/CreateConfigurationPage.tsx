import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreateConfiguration } from '../hooks/useCreateConfiguration'
import { ConfigurationForm } from '../components/ConfigurationForm'
import { getSettingsErrorMessage } from '../utils/settingsErrors'
import type { CreateConfigurationDto } from '../types/configuration.types'

export function CreateConfigurationPage() {
  const navigate = useNavigate()
  const {
    mutate: createConfiguration,
    isPending,
    isError,
    error,
  } = useCreateConfiguration()

  const handleSubmit = (values: CreateConfigurationDto) => {
    createConfiguration(values, {
      onSuccess: () => {
        toast.success('Configuración creada correctamente.')
        navigate('/settings')
      },
    })
  }

  const handleCancel = () => {
    navigate('/settings')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Configuración', href: '/settings' },
          { label: 'Nueva configuración' },
        ]}
        title="Nueva configuración"
        description="Registra una nueva configuración del sistema."
      />

      {isError && <ErrorAlert>{getSettingsErrorMessage(error)}</ErrorAlert>}

      <ConfigurationForm
        mode="create"
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}