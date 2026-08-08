import { Pencil, Search, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { VALUE_TYPE_LABELS } from '../constants/configuration.constants'
import type { Configuration } from '../types/configuration.types'

interface ConfigurationsTableProps {
  /** Configuraciones a mostrar. La tabla no obtiene datos por si misma. */
  configurations: Configuration[]
  /** Bloque 7.29D.1: distingue "sin resultados de esta búsqueda/filtro"
   * (con acción "Limpiar búsqueda") de "todavía no hay ninguna
   * configuración" — mismo criterio de 2 variantes ya usado en
   * `ProductsEmptyState.tsx`/`PermissionTable.tsx`. */
  hasSearch?: boolean
  onClearSearch?: () => void
  /** Se dispara al presionar la accion de editar una configuracion. */
  onEdit?: (configuration: Configuration) => void
  /** Bloque Configuración (rediseño, aprobado): abre `ConfigurationDrawer.tsx`
   * — mismo criterio de vista rápida ya usado por el resto de las tablas. */
  onRowClick?: (configuration: Configuration) => void
}

/**
 * features/settings/components/ConfigurationsTable.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.29D.1 (paridad visual con Productos/Permisos/Inventario):
 * espaciado/tipografía alineados (`px-4 py-2.5`/`py-3` en vez de
 * `px-5 py-4`), sin borde/sombra propios (`rounded-none border-0
 * shadow-none` — el Canvas Workspace de `SettingsPage.tsx` ya aporta esa
 * superficie), y estado vacío con `EmptyState.tsx` (icono/título/
 * descripción/acción) en vez del `emptyMessage` de texto plano anterior.
 * Mismas columnas/acciones de siempre — sin agregar selección, orden ni
 * "Eliminar" (no existían antes de este bloque).
 */
export function ConfigurationsTable({
  configurations,
  hasSearch = false,
  onClearSearch,
  onEdit,
  onRowClick,
}: ConfigurationsTableProps) {
  const columns: DataTableColumn<Configuration>[] = [
    {
      header: 'Clave',
      render: (configuration) => configuration.key,
      className: 'text-[0.9375rem] font-semibold',
    },
    {
      header: 'Valor',
      // Bloque Configuración (rediseño, aprobado): fuente monoespaciada +
      // `truncate` — un valor `json` largo ya no rompe el layout de la
      // fila. El valor completo (sin truncar) se ve en `ConfigurationDrawer.tsx`.
      render: (configuration) => configuration.value,
      className: 'max-w-64 truncate font-mono text-muted-foreground',
    },
    {
      header: 'Tipo',
      render: (configuration) => (
        <Badge variant="muted">{VALUE_TYPE_LABELS[configuration.type] ?? configuration.type}</Badge>
      ),
      className: 'align-middle',
    },
    {
      header: 'Descripción',
      render: (configuration) => configuration.description ?? '—',
      className: 'text-muted-foreground',
    },
    {
      header: 'Acciones',
      headerClassName: 'sr-only',
      render: (configuration) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Editar ${configuration.key}`}
            onClick={() => onEdit?.(configuration)}
            className="rounded-lg text-muted-foreground transition-all duration-150 hover:bg-brand/10 hover:text-brand"
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ),
      className: 'w-16 align-middle',
    },
  ]

  if (configurations.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-14">
        {hasSearch ? (
          <EmptyState
            icon={Search}
            title="Sin resultados para esta búsqueda"
            description="Probá con otra clave, tipo o descripción."
            action={onClearSearch ? { label: 'Limpiar búsqueda', onClick: onClearSearch } : undefined}
          />
        ) : (
          <EmptyState
            icon={SlidersHorizontal}
            title="No hay configuraciones para mostrar"
            description="Los parámetros del sistema aparecerán aquí."
          />
        )}
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      data={configurations}
      getRowKey={(configuration) => configuration.id}
      tableClassName="rounded-none border-0 shadow-none overflow-visible"
      headerClassName="px-4 py-3 text-xs font-semibold tracking-wider text-foreground/85 uppercase"
      rowClassName="transition-colors duration-200 ease-out hover:bg-brand/5"
      cellClassName="px-4 py-2.5"
      onRowClick={onRowClick}
    />
  )
}
