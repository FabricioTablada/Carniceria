import { useUsers } from '@/features/users/hooks/useUsers'

interface RoleUsersCountProps {
  roleId: string
}

/**
 * features/roles/components/RoleUsersCount.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Roles (aprobado, "usuarios asignados por rol"/"nivel de uso"):
 * `GET /roles` no trae un conteo de usuarios por rol — se resuelve con el
 * MISMO truco ya usado en `RolesKpiRow.tsx` (`{ limit: 1 }`, solo se lee
 * `meta.total`, sin traer filas) aplicado a `useUsers({ roleId })`, ya
 * existente y usado por `UsersPage.tsx`. Un componente por celda (no un
 * cálculo en `RolesTable.tsx`) para que cada fila dispare su propia
 * consulta liviana e independiente — válido porque el catálogo de roles es
 * chico (unas pocas filas visibles a la vez); si creciera mucho, esto
 * pasaría a necesitar un agregado real del backend.
 */
export function RoleUsersCount({ roleId }: RoleUsersCountProps) {
  const { data, isLoading } = useUsers({ roleId, limit: 1 })

  if (isLoading) {
    return <span className="text-muted-foreground">…</span>
  }

  const total = data?.meta.total ?? 0

  return <span className={total === 0 ? 'text-muted-foreground' : undefined}>{total}</span>
}
