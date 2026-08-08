import { Badge } from '@/components/common/Badge'

interface Permission {
  id: string
  code: string
  description: string | null
}

interface RolePermissionsPreviewProps {
  permissions: Permission[]
  /** Cuantos permisos mostrar como chip antes de colapsar el resto en
   * "+N más". @default 4 */
  maxVisible?: number
}

/**
 * features/users/components/RolePermissionsPreview.tsx
 * -----------------------------------------------------------------------------
 * Bloque Usuarios (aprobado, "vista previa del rol"): muestra cuantos
 * permisos otorga un rol + una muestra de sus codigos, sin ningun calculo
 * de negocio nuevo — `GET /roles` ya devuelve `permissions[]` completo
 * por rol (`Role.permissions`, `role.types.ts`), este componente solo
 * recorta cuantos chips mostrar. Mismo `Badge` que ya usa
 * `RolePermissionBadge.tsx` (Roles) — variant `accent` para el permiso,
 * `muted` para el contador de "+N más" (no se reescribe
 * `RolePermissionBadge.tsx`: ese componente muestra SIEMPRE la lista
 * completa sin truncar, un caso distinto al de esta vista previa).
 *
 * Reutilizado tal cual en `UserForm.tsx` (al elegir un rol) y
 * `UserDrawer.tsx` (rol ya asignado).
 */
export function RolePermissionsPreview({ permissions, maxVisible = 4 }: RolePermissionsPreviewProps) {
  if (permissions.length === 0) {
    return <p className="text-sm text-muted-foreground">Este rol no tiene permisos asignados.</p>
  }

  const visible = permissions.slice(0, maxVisible)
  const remaining = permissions.length - visible.length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-extrabold text-brand">{permissions.length}</span>
        <span className="text-sm text-muted-foreground">
          {permissions.length === 1 ? 'permiso otorgado' : 'permisos otorgados'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((permission) => (
          <Badge key={permission.id} variant="accent">
            {permission.code}
          </Badge>
        ))}
        {remaining > 0 && <Badge variant="muted">+{remaining} más</Badge>}
      </div>
    </div>
  )
}
