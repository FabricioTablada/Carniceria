import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpenCheck, DatabaseBackup, Plug, Plus, Receipt, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Can } from '@/components/common/Can'
import { PageHeader } from '@/components/common/PageHeader'
import { Skeleton } from '@/components/common/Skeleton'
import { Toolbar } from '@/components/common/Toolbar'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Pagination } from '@/components/ui/Pagination'
import { PERMISSIONS } from '@/constants/permissions'
import { usePagination } from '@/hooks/usePagination'
import { formatDateTime } from '@/utils/formatDateTime'
import { useConfigurations } from '../hooks/useConfigurations'
import { useAlegraConfigStatus } from '../hooks/useAlegraConfigStatus'
import { ConfigurationDrawer } from '../components/ConfigurationDrawer'
import { ConfigurationFilters } from '../components/ConfigurationFilters'
import { ConfigurationsTable } from '../components/ConfigurationsTable'
import { ConfigurationsTableSkeleton } from '../components/ConfigurationsTableSkeleton'
import type {
  Configuration,
  ConfigurationFilters as ConfigurationFiltersValue,
} from '../types/configuration.types'

/**
 * features/settings/pages/SettingsPage.tsx
 * -----------------------------------------------------------------------------
 * Bloque 7.29D.1 (rediseño, wireframe aprobado): "Centro de Configuración"
 * — dos secciones nombradas ("Integraciones"/"Parámetros del sistema") en
 * vez de una tabla con dos botones en el header. El modelo de datos real
 * (`Configuration`, catálogo clave-valor) no cambia — sigue siendo el
 * mismo CRUD paginado de siempre, solo se reorganiza su presentación.
 *
 * "Integraciones": la única integración real del sistema (Alegra) pasa de
 * un botón secundario del header a una tarjeta de estado — reutiliza
 * `useAlegraConfigStatus()` (mismo hook ya usado en `AlegraIntegrationPage.tsx`,
 * sin endpoint nuevo) para mostrar "Conectada"/"No configurada" con datos
 * reales (email, última actualización). `AlegraIntegrationPage.tsx` en sí
 * (breadcrumb/formulario) queda para su propio bloque de modernización —
 * ver nota en `ROADMAP.md`.
 *
 * "Parámetros del sistema (N)": mismo Canvas Workspace/Toolbar/DataTable
 * ya usado por Productos/Permisos/Inventario — `N` es `data.meta.total`
 * (dato ya incluido en la respuesta paginada, sin consulta nueva).
 */
export function SettingsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<ConfigurationFiltersValue>({})
  const [drawerConfiguration, setDrawerConfiguration] = useState<Configuration | null>(null)

  const { page, setPage, resetPage } = usePagination()
  const { data, isLoading, isError, error } = useConfigurations({ ...filters, page })

  const { data: alegraStatus, isLoading: isAlegraLoading } = useAlegraConfigStatus()

  const handleFiltersChange = (nextFilters: ConfigurationFiltersValue) => {
    setFilters(nextFilters)
    resetPage()
  }

  const handleCreateConfiguration = () => {
    navigate('/settings/new')
  }

  const handleEdit = (configuration: Configuration) => {
    navigate(`/settings/${configuration.id}/edit`)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Inicio', href: '/' }, { label: 'Configuración' }]}
        title="Configuración"
        description="Centro de configuración del sistema — integraciones y parámetros generales del negocio."
        action={
          <Can permission={PERMISSIONS.SETTINGS_MANAGE}>
            <Button
              type="button"
              onClick={handleCreateConfiguration}
              className="h-11 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
            >
              <Plus className="size-4" />
              Nueva configuración
            </Button>
          </Can>
        }
      />

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Plug className="size-3.5 text-brand" />
          Integraciones
        </p>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Receipt className="size-6" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">Facturación Electrónica (Alegra)</p>
                {isAlegraLoading ? (
                  <Skeleton className="h-5 w-24 rounded-full" />
                ) : (
                  <Badge variant={alegraStatus?.configured ? 'secondary' : 'muted'} className="gap-1.5">
                    <span className="size-1.5 shrink-0 rounded-full bg-current" />
                    {alegraStatus?.configured ? 'Conectada' : 'No configurada'}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {isAlegraLoading
                  ? 'Cargando estado de la conexión...'
                  : alegraStatus?.configured
                    ? `${alegraStatus.email} · actualizado el ${formatDateTime(alegraStatus.updatedAt).split(' ')[0]}`
                    : 'Configurá el correo, token y URL base para emitir comprobantes electrónicos.'}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/settings/alegra')}
              className="h-10 shrink-0 gap-2 self-start rounded-xl sm:self-center"
            >
              Administrar
            </Button>
          </div>
        </div>

        {/* Bloque "Actualización inteligente del catálogo CABYS": mismo
            patrón de tarjeta que Alegra arriba, sin estado dinámico (la
            verificación es siempre bajo demanda, dentro de la propia
            página) — solo un enlace directo. */}
        <div className="mt-3 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <BookOpenCheck className="size-6" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Catálogo CABYS</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Verificá y aplicá actualizaciones del catálogo oficial de códigos CABYS del BCCR.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/settings/cabys-catalog')}
              className="h-10 shrink-0 gap-2 self-start rounded-xl sm:self-center"
            >
              Administrar
            </Button>
          </div>
        </div>

        {/* Parche 1.0.1 (acceso desde la UI): solo visible dentro de la
            app de escritorio (Electron) — mismo criterio de guard que
            `UpdateReadyDialog.tsx` (`window.electronAPI`). En el build
            web normal esta tarjeta no se renderiza. */}
        {typeof window !== 'undefined' && window.electronAPI && (
          <div className="mt-3 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <DatabaseBackup className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Respaldos</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Crear y restaurar respaldos de la base de datos de esta instalación.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/settings/backups')}
                className="h-10 shrink-0 gap-2 self-start rounded-xl sm:self-center"
              >
                Administrar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Separación deliberadamente mayor que el `gap-5` general de la
          pantalla, para reforzar que son dos secciones distintas
          ("Integraciones" ya cerrada arriba, "Parámetros del sistema"
          empieza acá) — mismo criterio visual, sin tocar el espaciado
          interno de cada Workspace. */}
      <div className="mt-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <SlidersHorizontal className="size-3.5 text-brand" />
          Parámetros del sistema{data?.meta ? ` (${data.meta.total})` : ''}
        </p>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border/70 px-4 py-3">
            <Toolbar
              bare
              filters={<ConfigurationFilters filters={filters} onFiltersChange={handleFiltersChange} />}
            />
          </div>

          {isLoading && <ConfigurationsTableSkeleton bare />}

          {isError && (
            <div className="p-4">
              <ErrorAlert>
                {error?.message ?? 'Ocurrió un error al cargar las configuraciones.'}
              </ErrorAlert>
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <ConfigurationsTable
                configurations={data?.data ?? []}
                hasSearch={Boolean(filters.search || filters.type)}
                onClearSearch={() => handleFiltersChange({})}
                onEdit={handleEdit}
                onRowClick={setDrawerConfiguration}
              />

              {data?.meta && (
                <div className="border-t border-border/70 px-4 py-3">
                  <Pagination meta={data.meta} onPageChange={setPage} itemLabel="configuraciones" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfigurationDrawer
        configuration={drawerConfiguration}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerConfiguration(null)
          }
        }}
        onEdit={(configuration) => {
          setDrawerConfiguration(null)
          handleEdit(configuration)
        }}
      />
    </div>
  )
}
