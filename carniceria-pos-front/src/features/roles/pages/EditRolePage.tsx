import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FormSection } from '@/components/ui/FormSection'
import { LoadingState } from '@/components/ui/LoadingState'
import { PERMISSIONS_CATALOG_LIMIT } from '@/features/permissions/constants/permission.constants'
import { usePermissions } from '@/features/permissions/hooks/usePermissions'
import { useRole } from '../hooks/useRole'
import { useUpdateRole } from '../hooks/useUpdateRole'
import { useAssignRolePermissions } from '../hooks/useAssignRolePermissions'
import { RoleForm } from '../components/RoleForm'
import { RolePermissionSelector } from '../components/RolePermissionSelector'
import { getRoleErrorMessage } from '../utils/roleErrors'
import type { CreateRoleDto, Role } from '../types/role.types'

interface Permission {
  id: string
  code: string
  description: string | null
}

/**
 * Bloque de asignacion de permisos: accion separada del formulario
 * principal de edicion (name/description), mismo criterio ya usado para
 * el cambio de estado del rol (useUpdateRoleStatus, wireado en
 * RolesPage.tsx). Nunca se mezcla con el submit de RoleForm.
 *
 * `role.permissions` puede cambiar despues de un refetch sin que este
 * componente se desmonte. En vez de sincronizar estado durante el
 * render o en un efecto, quien usa este componente (`EditRolePage`) le
 * pasa una `key` derivada del contenido real de `role.permissions`
 * (ids ordenados y unidos) — si ese contenido cambia, React desmonta y
 * vuelve a montar esta instancia desde cero, y el inicializador
 * perezoso de `useState` toma los datos frescos. Si el contenido no
 * cambia (ej. tras editar name/description en RoleForm, que tambien
 * refresca `role`), la `key` es identica y React reutiliza la misma
 * instancia — la seleccion en curso del usuario no se pierde.
 */
function RolePermissionsSection({
  role,
  permissions,
}: {
  role: Role
  permissions: Permission[]
}) {
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(
    () => role.permissions.map((permission) => permission.id),
  )

  const {
    mutate: assignRolePermissions,
    isPending: isAssigningPermissions,
    isError: isAssignError,
    error: assignError,
  } = useAssignRolePermissions()

  const handleSavePermissions = () => {
    assignRolePermissions({
      id: role.id,
      dto: { permissionIds: selectedPermissionIds },
    })
  }

  return (
    <FormSection
      icon={Shield}
      title="Permisos"
      description="Se guardan por separado de los datos generales."
    >
      <RolePermissionSelector
        permissions={permissions}
        selectedPermissionIds={selectedPermissionIds}
        onChange={setSelectedPermissionIds}
        disabled={isAssigningPermissions}
      />

      {isAssignError && <ErrorAlert>{getRoleErrorMessage(assignError)}</ErrorAlert>}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          disabled={isAssigningPermissions || selectedPermissionIds.length === 0}
          onClick={handleSavePermissions}
        >
          {isAssigningPermissions ? 'Guardando...' : 'Guardar permisos'}
        </Button>
      </div>
    </FormSection>
  )
}

export function EditRolePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: role,
    isLoading,
    isError,
    error,
  } = useRole(id ?? '')
  const {
    mutate: updateRole,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateRole()

  // Catalogo completo de permisos disponibles, para el selector — no se
  // mezcla con el envio de RoleForm (name/description).
  //
  // `PERMISSIONS_CATALOG_LIMIT` (por encima de cualquier catalogo real hoy)
  // porque `RolePermissionSelector` no pagina: si `usePermissions()` trae
  // solo el default de 20 por pagina, los permisos que no entran en esa
  // pagina (ordenados por fecha de creacion, los mas antiguos quedan
  // afuera) no se pueden ni ver ni desmarcar, aunque sigan asignados al
  // rol — causa raiz confirmada del bug donde `users.manage` sobrevivia a
  // un guardado de permisos porque nunca aparecia en la lista.
  const { data: permissionsResponse } = usePermissions({ limit: PERMISSIONS_CATALOG_LIMIT })
  const permissions = permissionsResponse?.data ?? []

  const handleSubmit = (values: CreateRoleDto) => {
    if (!id) {
      return
    }

    updateRole(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Rol actualizado correctamente.')
          navigate('/roles')
        },
      },
    )
  }

  if (isLoading) {
    return <LoadingState message="Cargando rol..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar el rol.'}
      </ErrorAlert>
    )
  }

  if (!role) {
    return (
      <p className="text-sm text-muted-foreground">
        El rol no existe.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Roles', href: '/roles' },
          { label: 'Editar rol' },
        ]}
        title="Editar rol"
        description="Actualiza los datos del rol seleccionado."
      />

      {isUpdateError && <ErrorAlert>{getRoleErrorMessage(updateError)}</ErrorAlert>}

      <RoleForm
        defaultValues={{
          name: role.name,
          description: role.description,
        }}
        onSubmit={handleSubmit}
        loading={isPending}
        nameDisabled={role.isSystem}
      />

      <RolePermissionsSection
        key={role.permissions
          .map((permission) => permission.id)
          .sort()
          .join(',')}
        role={role}
        permissions={permissions}
      />
    </div>
  )
}