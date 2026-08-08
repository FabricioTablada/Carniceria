import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from 'sonner'
import { usePermission } from '../hooks/usePermission'
import { useUpdatePermission } from '../hooks/useUpdatePermission'
import { PermissionForm } from '../components/PermissionForm'
import { getPermissionErrorMessage } from '../utils/permissionErrors'
import type { CreatePermissionDto } from '../types/permission.types'

export function EditPermissionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: permission,
    isLoading,
    isError,
    error,
  } = usePermission(id ?? '')
  const {
    mutate: updatePermission,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdatePermission()

  const handleSubmit = (values: CreatePermissionDto) => {
    if (!id) {
      return
    }

    updatePermission(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Permiso actualizado correctamente.')
          navigate('/permissions')
        },
      },
    )
  }

  if (isLoading) {
    return <LoadingState message="Cargando permiso..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar el permiso.'}
      </ErrorAlert>
    )
  }

  if (!permission) {
    return (
      <p className="text-sm text-muted-foreground">
        El permiso no existe.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Permisos', href: '/permissions' },
          { label: 'Editar permiso' },
        ]}
        title="Editar permiso"
        description="Actualiza los datos del permiso seleccionado."
      />

      {isUpdateError && <ErrorAlert>{getPermissionErrorMessage(updateError)}</ErrorAlert>}

      <PermissionForm
        defaultValues={{
          code: permission.code,
          description: permission.description,
        }}
        onSubmit={handleSubmit}
        loading={isPending}
        codeDisabled
      />
    </div>
  )
}