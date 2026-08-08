import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { groupPermissionsByModule, matchesPermissionSearch } from '@/utils/permissionModule'

/**
 * features/roles/components/RolePermissionSelector.tsx
 * -----------------------------------------------------------------------------
 * Componente de presentacion pura para seleccionar los permisos de un rol:
 * no llama hooks de datos, no hace llamadas a la API, y no conoce roles ni
 * usuarios — mismo criterio de responsabilidad ya usado en
 * `RolePermissionBadge.tsx` (misma razon por la que aqui tambien se define
 * una interfaz `Permission` local minima, en vez de importar el tipo real
 * de `features/permissions/`, para no acoplar este componente a otra
 * feature) y en `QuickActions.tsx` (recibe todo por props, quien lo usa
 * decide de donde salen los datos y que hacer con el resultado).
 *
 * `RolePermissionBadge` (solo lectura) y este componente (edicion) son
 * intencionalmente dos componentes separados — no se fusionan ni se
 * modifica el primero desde aqui.
 *
 * Checkbox nativo con las mismas clases ya usadas en el resto del
 * proyecto (ver el campo "Usuario activo" en `UserForm.tsx`), en vez de
 * introducir un componente de checklist nuevo — no hay ninguno reutilizable
 * en `components/ui/` para este caso.
 *
 * Bloque Permisos (rediseño, aprobado): la lista plana de checkboxes (que
 * con el catalogo real de ~34 permisos ya era un scroll largo sin
 * jerarquia, y causa raiz documentada de un bug real donde `users.manage`
 * podia perderse de vista) se reemplaza por el mismo agrupamiento por
 * modulo que `PermissionTable.tsx` (`groupPermissionsByModule`,
 * `utils/permissionModule.ts` — misma convencion, sin campo nuevo del
 * backend), con:
 *  - buscador interno (`matchesPermissionSearch`, mismo criterio de
 *    coincidencia — codigo/descripcion/modulo — que el listado de
 *    Permisos), estado local con `useState` (mismo criterio que el resto
 *    de los filtros de UI del proyecto);
 *  - contador de seleccionados por modulo ("4/7");
 *  - "Seleccionar todo"/"Quitar todo" por modulo, operando sobre el mismo
 *    `selectedPermissionIds`/`onChange` que ya recibia este componente —
 *    sin cambiar su contrato con `EditRolePage.tsx`.
 * Grupos colapsados por defecto (`<details>`, sin libreria nueva) — el
 * usuario decide que modulos expandir, ninguno se abre automaticamente al
 * entrar a la pantalla, mismo criterio que `PermissionTable.tsx`.
 */

interface Permission {
  id: string
  code: string
  description: string | null
}

interface RolePermissionSelectorProps {
  permissions: Permission[]
  selectedPermissionIds: string[]
  onChange: (permissionIds: string[]) => void
  disabled?: boolean
}

export function RolePermissionSelector({
  permissions,
  selectedPermissionIds,
  onChange,
  disabled = false,
}: RolePermissionSelectorProps) {
  const [search, setSearch] = useState('')

  const handleToggle = (permissionId: string, checked: boolean) => {
    const next = checked
      ? [...selectedPermissionIds, permissionId]
      : selectedPermissionIds.filter((id) => id !== permissionId)

    onChange(next)
  }

  const handleSelectAllInGroup = (groupItems: Permission[]) => {
    const next = new Set(selectedPermissionIds)
    for (const item of groupItems) {
      next.add(item.id)
    }
    onChange(Array.from(next))
  }

  const handleClearGroup = (groupItems: Permission[]) => {
    const groupIds = new Set(groupItems.map((item) => item.id))
    onChange(selectedPermissionIds.filter((id) => !groupIds.has(id)))
  }

  const filteredPermissions = useMemo(
    () => permissions.filter((permission) => matchesPermissionSearch(permission, search)),
    [permissions, search],
  )

  const groups = useMemo(() => groupPermissionsByModule(filteredPermissions), [filteredPermissions])

  if (permissions.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        No hay permisos disponibles
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar permiso por código, descripción o módulo"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled}
          className="h-9 pl-9"
        />
      </div>

      {groups.length === 0 ? (
        <span className="text-sm text-muted-foreground">
          No se encontraron permisos que coincidan con la búsqueda.
        </span>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => {
            const selectedInGroup = group.items.filter((item) =>
              selectedPermissionIds.includes(item.id),
            ).length
            const allSelectedInGroup = selectedInGroup === group.items.length

            return (
              <details
                key={group.moduleKey}
                className="flex flex-col gap-2 rounded-lg border border-border/60 p-3"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground select-none [&::-webkit-details-marker]:hidden">
                  {group.label}
                  <span className="font-normal text-muted-foreground">
                    ({selectedInGroup}/{group.items.length})
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      disabled={disabled || allSelectedInGroup}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleSelectAllInGroup(group.items)
                      }}
                      className="h-auto p-0 text-xs"
                    >
                      Seleccionar todo
                    </Button>
                    <span className="text-muted-foreground">·</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      disabled={disabled || selectedInGroup === 0}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleClearGroup(group.items)
                      }}
                      className="h-auto p-0 text-xs"
                    >
                      Quitar todo
                    </Button>
                  </div>
                </summary>

                <div className="flex flex-col gap-2 pl-1">
                  {group.items.map((permission) => {
                    const inputId = `role-permission-selector-${permission.id}`
                    const isChecked = selectedPermissionIds.includes(permission.id)

                    return (
                      <div key={permission.id} className="flex items-center gap-2">
                        <input
                          id={inputId}
                          type="checkbox"
                          disabled={disabled}
                          checked={isChecked}
                          onChange={(event) =>
                            handleToggle(permission.id, event.target.checked)
                          }
                          className={cn(
                            'size-4 rounded border-input',
                            'focus-visible:ring-3 focus-visible:ring-ring/50',
                          )}
                        />
                        <Label htmlFor={inputId}>
                          {permission.description ?? permission.code}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
