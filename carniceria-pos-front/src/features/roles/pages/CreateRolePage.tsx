import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { PERMISSIONS_CATALOG_LIMIT } from '@/features/permissions/constants/permission.constants'
import { usePermissions } from '@/features/permissions/hooks/usePermissions'
import { useCreateRole } from '../hooks/useCreateRole'
import { RoleForm } from '../components/RoleForm'
import { getRoleErrorMessage } from '../utils/roleErrors'
import type { CreateRoleDto } from '../types/role.types'

/**
 * features/roles/pages/CreateRolePage.tsx
 * -----------------------------------------------------------------------------
 * Bloque Roles (rediseño, aprobado): trae el catálogo completo de permisos
 * (mismo criterio y misma constante ya usados por `EditRolePage.tsx`) para
 * pasárselo a `RoleForm.tsx` — habilita la sección colapsable "Permisos" en
 * el mismo formulario de creación, sin endpoint nuevo (`CreateRoleDto.
 * permissionIds` ya existía en el backend, solo no se usaba desde acá).
 */
export function CreateRolePage() {
  const navigate = useNavigate()
  const { mutate: createRole, isPending, isError, error } = useCreateRole()
  const { data: permissionsResponse } = usePermissions({ limit: PERMISSIONS_CATALOG_LIMIT })

  const handleSubmit = (values: CreateRoleDto) => {
    createRole(values, {
      onSuccess: () => {
        toast.success('Rol creado correctamente.')
        navigate('/roles')
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Roles', href: '/roles' },
          { label: 'Nuevo rol' },
        ]}
        title="Nuevo rol"
        description="Registra un nuevo rol del sistema."
      />

      {isError && <ErrorAlert>{getRoleErrorMessage(error)}</ErrorAlert>}

      <RoleForm
        onSubmit={handleSubmit}
        loading={isPending}
        permissions={permissionsResponse?.data ?? []}
      />
    </div>
  )
}