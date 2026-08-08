import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useCreateUser } from '../hooks/useCreateUser'
import { useRoles } from '@/features/roles/hooks/useRoles'
import { UserForm } from '../components/UserForm'
import { getUserErrorMessage } from '../utils/userErrors'
import type { CreateUserDto } from '../types/user.types'

export function CreateUserPage() {
  const navigate = useNavigate()
  const {
    mutate: createUser,
    isPending,
    isError,
    error,
  } = useCreateUser()

  // Roles activos, vía el endpoint ya existente GET /roles (filtro `active`
  // soportado por el backend). Bloque Usuarios (aprobado, "vista previa
  // del rol"): ya NO se descarta `permissions` — `GET /roles` lo trae
  // completo y `UserForm.tsx` lo necesita para mostrar cuántos permisos
  // otorga el rol elegido, sin ninguna consulta adicional.
  const { data: rolesResponse } = useRoles({ active: true })
  const roles = (rolesResponse?.data ?? []).map((role) => ({
    id: role.id,
    name: role.name,
    permissions: role.permissions,
  }))

  const handleSubmit = (values: CreateUserDto) => {
    createUser(values, {
      onSuccess: () => {
        toast.success('Usuario creado correctamente.')
        navigate('/users')
      },
    })
  }

  const handleCancel = () => {
    navigate('/users')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Nuevo usuario" description="Registra un nuevo usuario del sistema." />

      {isError && <ErrorAlert>{getUserErrorMessage(error)}</ErrorAlert>}

      <UserForm
        mode="create"
        roles={roles}
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  )
}