import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { useUser } from '../hooks/useUser'
import { useUpdateUser } from '../hooks/useUpdateUser'
import { useRoles } from '@/features/roles/hooks/useRoles'
import { UserForm } from '../components/UserForm'
import { getUserErrorMessage } from '../utils/userErrors'
import type { CreateUserDto } from '../types/user.types'

export function EditUserPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useUser(id ?? '')
  const {
    mutate: updateUser,
    isPending,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateUser()

  // Roles activos, vía el endpoint ya existente GET /roles (filtro `active`
  // soportado por el backend). Bloque Usuarios (aprobado, "vista previa
  // del rol"): ya NO se descarta `permissions` — `GET /roles` lo trae
  // completo y `UserForm.tsx` lo necesita para mostrar cuántos permisos
  // otorga el rol elegido, sin ninguna consulta adicional.
  const { data: rolesResponse } = useRoles({ active: true })
  const activeRoles = (rolesResponse?.data ?? []).map((role) => ({
    id: role.id,
    name: role.name,
    permissions: role.permissions,
  }))

  // QA.10 (Usuarios): un rol no-sistema puede desactivarse aunque tenga
  // usuarios asignados (`roles.service.ts::changeStatus` solo bloquea
  // roles `isSystem`) — si el rol ACTUAL de este usuario ya no esta
  // activo, `activeRoles` (arriba) no lo incluye, y el `<Select>` de
  // `UserForm.tsx` caia a mostrar el UUID crudo del rol en vez de su
  // nombre (`roles.find(...)?.name ?? roleId`, ver `UserForm.tsx`),
  // ademas de dejarlo fuera de la lista de opciones visibles. Se agrega
  // aca — a partir de `user.role`, ya incluido en `GET /users/:id`, sin
  // ningun fetch nuevo — unicamente cuando no esta ya en `activeRoles`.
  // Sin `permissions` (ese dato no viaja en `user.role`): `UserForm.tsx`
  // ya tolera esa ausencia (`permissions?:`, la vista previa de permisos
  // simplemente no se muestra para este caso, degradacion ya prevista).
  const roles = activeRoles.some((role) => role.id === user?.role.id)
    ? activeRoles
    : user
      ? [...activeRoles, { id: user.role.id, name: user.role.name }]
      : activeRoles

  const handleSubmit = (values: CreateUserDto) => {
    if (!id) {
      return
    }

    updateUser(
      { id, dto: values },
      {
        onSuccess: () => {
          toast.success('Usuario actualizado correctamente.')
          navigate('/users')
        },
      },
    )
  }

  const handleCancel = () => {
    navigate('/users')
  }

  if (isLoading) {
    return <LoadingState message="Cargando usuario..." />
  }

  if (isError) {
    return (
      <ErrorAlert>
        {error?.message ?? 'Ocurrió un error al cargar el usuario.'}
      </ErrorAlert>
    )
  }

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        El usuario no existe.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Editar usuario" description="Actualiza los datos del usuario seleccionado." />

      {isUpdateError && <ErrorAlert>{getUserErrorMessage(updateError)}</ErrorAlert>}

      <UserForm
        mode="update"
        defaultValues={{
          roleId: user.role.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
        }}
        roles={roles}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}