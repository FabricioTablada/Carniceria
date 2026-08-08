import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { useAlegraConfigStatus } from '../hooks/useAlegraConfigStatus'
import { useSaveAlegraConfig } from '../hooks/useSaveAlegraConfig'
import { useTestAlegraConnection } from '../hooks/useTestAlegraConnection'
import { AlegraConfigForm } from '../components/AlegraConfigForm'
import { getSettingsErrorMessage } from '../utils/settingsErrors'
import type {
  AlegraConnectionTestResult,
  AlegraTestConnectionDto,
  SaveAlegraConfigDto,
} from '../types/alegra.types'

/**
 * features/settings/pages/AlegraIntegrationPage.tsx
 * -----------------------------------------------------------------------------
 * Configuración → Facturación Electrónica → Alegra (Bloque 7.4). Página
 * contenedora: posee las 3 queries/mutations y le pasa el resultado a
 * `AlegraConfigForm.tsx` (presentacional), mismo criterio que
 * `CreateConfigurationPage.tsx`/`ConfigurationForm.tsx`.
 */
export function AlegraIntegrationPage() {
  const [testResult, setTestResult] = useState<AlegraConnectionTestResult | undefined>()

  const { data: status, isLoading, isError, error } = useAlegraConfigStatus()
  const saveConfig = useSaveAlegraConfig()
  const testConnection = useTestAlegraConnection()

  const handleSave = (values: SaveAlegraConfigDto) => {
    saveConfig.mutate(values, {
      onSuccess: () => {
        toast.success('Configuración de Alegra guardada correctamente.')
      },
    })
  }

  const handleTestConnection = (values: AlegraTestConnectionDto) => {
    setTestResult(undefined)
    testConnection.mutate(values, {
      onSuccess: (result) => {
        setTestResult(result)
        toast.success('Conexión con Alegra exitosa.')
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Alegra"
        description="Correo, token y URL base de la integración con Alegra."
        breadcrumb={[
          { label: 'Configuración', href: '/settings' },
          { label: 'Facturación Electrónica' },
          { label: 'Alegra' },
        ]}
      />

      {isLoading && <LoadingState message="Cargando configuración..." />}

      {isError && <ErrorAlert>{getSettingsErrorMessage(error)}</ErrorAlert>}

      {saveConfig.isError && <ErrorAlert>{getSettingsErrorMessage(saveConfig.error)}</ErrorAlert>}

      {!isLoading && !isError && (
        <AlegraConfigForm
          status={status}
          isSaving={saveConfig.isPending}
          isTesting={testConnection.isPending}
          testResult={testResult}
          testErrorMessage={
            testConnection.isError ? getSettingsErrorMessage(testConnection.error) : undefined
          }
          onSave={handleSave}
          onTestConnection={handleTestConnection}
        />
      )}
    </div>
  )
}
