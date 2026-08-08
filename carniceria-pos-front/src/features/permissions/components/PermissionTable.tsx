import { ChevronRight, Eye, KeyRound, Pencil, Search } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { RowMenu, RowMenuItem } from '@/components/ui/RowMenu'
import { groupPermissionsByModule } from '@/utils/permissionModule'
import type { Permission } from '../types/permission.types'

interface PermissionTableProps {
  permissions: Permission[]
  /** Bloque 7.29B.1: distingue "sin resultados de esta búsqueda" (con
   * acción "Limpiar búsqueda") de "todavía no hay ningún permiso" — mismo
   * criterio de 2 variantes que `ProductsEmptyState.tsx`. */
  hasSearch?: boolean
  onClearSearch?: () => void
  onEdit?: (permission: Permission) => void
  /** Bloque Permisos (rediseño, aprobado): abre `PermissionDrawer.tsx` —
   * mismo criterio de vista rápida ya usado por `ProductsTable`/
   * `CategoriesTable`/`TaxesTable`. */
  onRowClick?: (permission: Permission) => void
  /** Bloque 7.29B.1: qué módulos están expandidos — controlado por
   * `PermissionsPage.tsx` (necesario para que el botón "Expandir todo/
   * Colapsar todo" del Toolbar y la búsqueda con auto-expansión puedan
   * afectar el mismo estado que un click manual en un `<summary>`). */
  expandedKeys: Set<string>
  onToggleKey: (moduleKey: string) => void
}

/**
 * features/permissions/components/PermissionTable.tsx
 * -----------------------------------------------------------------------------
 * Bloque Permisos (rediseño, aprobado): vista agrupada por módulo
 * (`groupPermissionsByModule`, `utils/permissionModule.ts` — deriva el
 * módulo de la convención `modulo.accion` ya usada en
 * `constants/permissions.ts`, sin ningún campo nuevo del backend). Cada
 * grupo es un `<details>` nativo con un `DataTable` propio adentro —
 * decisión de arquitectura YA APROBADA, se conserva sin cambios en este
 * bloque (Bloque 7.29B.1 es paridad VISUAL, no un cambio de paradigma:
 * un catálogo plano de ~38 filas sería difícil de escanear sin agrupar,
 * algo que Productos no necesita resolver).
 *
 * Bloque 7.29B.1 (paridad visual con Productos):
 * - `<summary>`/cuerpo del grupo restyleados al mismo lenguaje visual del
 *   resto del ERP: radios/sombra/hover/transición consistentes con
 *   `ProductsTable.tsx` (`rounded-xl`, `shadow-sm`, `hover:bg-muted`,
 *   `transition-colors duration-200`).
 * - El contador "(N)" en texto plano pasa a `Badge` (`variant="muted"`)
 *   — mismo componente de badge que el resto del ERP, no un estilo
 *   nuevo.
 * - Acciones de fila: de un único botón de lápiz suelto a exactamente el
 *   mismo patrón de `ProductsTable.tsx` — iconos Ver detalle/Editar que
 *   aparecen en hover + `RowMenu` ("...") con las mismas dos acciones.
 *   Sin "Eliminar": esa acción no existía antes de este bloque y no se
 *   agrega (ninguna funcionalidad nueva, solo restyle).
 * - Estado vacío: reemplaza el `<div>` de solo texto por `EmptyState.tsx`
 *   (mismo componente que Productos/Inventario), con 2 variantes (sin
 *   resultados de una búsqueda vs. catálogo realmente vacío).
 * - `open`/`onToggle` del `<details>` pasan a estar controlados por
 *   `expandedKeys`/`onToggleKey` (antes: no controlado, todo iniciaba
 *   colapsado y cada `<summary>` manejaba su propio estado nativo) — para
 *   que el botón "Expandir todo/Colapsar todo" del Toolbar y la
 *   auto-expansión al buscar puedan afectar el mismo estado que un click
 *   manual. El click manual sigue funcionando igual (`onToggleKey`).
 *
 * Los permisos dentro de cada grupo ya llegan ordenados por acción
 * (responsabilidad de `groupPermissionsByModule`, no de este componente).
 */
export function PermissionTable({
  permissions,
  hasSearch = false,
  onClearSearch,
  onEdit,
  onRowClick,
  expandedKeys,
  onToggleKey,
}: PermissionTableProps) {
  const groups = groupPermissionsByModule(permissions)

  const columns: DataTableColumn<Permission>[] = [
    {
      header: 'Código',
      render: (permission) => permission.code,
      className: 'font-mono text-[0.9375rem] font-semibold',
    },
    {
      header: 'Descripción',
      render: (permission) => permission.description ?? '—',
      className: 'text-muted-foreground',
    },
    {
      // Bloque 7.29B.1: encabezado accesible (`sr-only`) — mismo criterio
      // que `ProductsTable.tsx`: el "..." de cada fila ya se explica por
      // sí mismo visualmente.
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (permission) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <div className="hidden items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:flex">
            <button
              type="button"
              onClick={() => onRowClick?.(permission)}
              aria-label={`Ver detalle de ${permission.code}`}
              title="Ver detalle"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onEdit?.(permission)}
              aria-label={`Editar ${permission.code}`}
              title="Editar"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
          <RowMenu label={`Acciones para ${permission.code}`}>
            <RowMenuItem icon={Eye} onClick={() => onRowClick?.(permission)}>
              Ver detalle
            </RowMenuItem>
            <RowMenuItem icon={Pencil} onClick={() => onEdit?.(permission)}>
              Editar
            </RowMenuItem>
          </RowMenu>
        </div>
      ),
      className: 'w-24 align-middle',
    },
  ]

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-14">
        {hasSearch ? (
          <EmptyState
            icon={Search}
            title="Sin resultados para esta búsqueda"
            description="Probá con otro código, descripción o nombre de módulo."
            action={onClearSearch ? { label: 'Limpiar búsqueda', onClick: onClearSearch } : undefined}
          />
        ) : (
          <EmptyState
            icon={KeyRound}
            title="No hay permisos para mostrar"
            description="Los permisos del sistema aparecerán aquí."
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {groups.map((group) => (
        <details key={group.moduleKey} className="group/acc flex flex-col gap-2" open={expandedKeys.has(group.moduleKey)}>
          <summary
            onClick={(event) => {
              event.preventDefault()
              onToggleKey(group.moduleKey)
            }}
            className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl border border-border/70 bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors duration-200 select-none hover:bg-muted [&::-webkit-details-marker]:hidden"
          >
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/acc:rotate-90" />
            {group.label}
            <Badge variant="muted">{group.items.length}</Badge>
          </summary>

          <DataTable
            columns={columns}
            data={group.items}
            getRowKey={(permission) => permission.id}
            tableClassName="rounded-xl border-border/70 shadow-sm overflow-hidden"
            headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
            rowClassName="group transition-colors duration-200 ease-out hover:bg-brand/5"
            cellClassName="px-4 py-2.5"
            onRowClick={onRowClick}
          />
        </details>
      ))}
    </div>
  )
}
