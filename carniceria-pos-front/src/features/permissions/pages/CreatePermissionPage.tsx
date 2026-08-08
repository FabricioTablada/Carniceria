import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreatePermission } from '../hooks/useCreatePermission'
import { PermissionForm } from '../components/PermissionForm'
import { getPermissionErrorMessage } from '../utils/permissionErrors'
import type { CreatePermissionDto } from '../types/permission.types'

export function CreatePermissionPage() {
  const navigate = useNavigate()
  const {
    mutate: createPermission,
    isPending,
    isError,
    error,
  } = useCreatePermission()

  const handleSubmit = (values: CreatePermissionDto) => {
    createPermission(values, {
      onSuccess: () => {
        toast.success('Permiso creado correctamente.')
        navigate('/permissions')
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Permisos', href: '/permissions' },
          { label: 'Nuevo permiso' },
        ]}
        title="Nuevo permiso"
        description="Registra un nuevo permiso del sistema."
      />

      {isError && <ErrorAlert>{getPermissionErrorMessage(error)}</ErrorAlert>}

      <PermissionForm onSubmit={handleSubmit} loading={isPending} />
    </div>
  )
}