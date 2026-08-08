import type { ReactNode } from 'react'
import { Pencil, Settings2 } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/ui/button'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelClose,
  WorkspacePanelContent,
  WorkspacePanelFooter,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { formatDateTime } from '@/utils/formatDateTime'
import { VALUE_TYPE_LABELS } from '../constants/configuration.constants'
import type { Configuration } from '../types/configuration.types'

interface ConfigurationDrawerProps {
  /** Configuracion a mostrar. `null` cierra el panel (mismo criterio que
   * `CategoryDrawer.tsx`/`TaxDrawer.tsx`/`PermissionDrawer.tsx`/`RoleDrawer.tsx`). */
  configuration: Configuration | null
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion —
   * mismo criterio que el resto de los Drawers del proyecto ("el Drawer
   * nunca edita datos por si mismo"). */
  onEdit: (configuration: Configuration) => void
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * features/settings/components/ConfigurationDrawer.tsx
 * -----------------------------------------------------------------------------
 * Bloque Configuración (rediseño, aprobado): no existía ningún Drawer en
 * este módulo — "Editar" navegaba directo a la pantalla completa. Mismo
 * patrón `WorkspacePanel.tsx` que el resto de los Drawers del proyecto.
 *
 * Su motivo principal: `ConfigurationsTable.tsx` ahora trunca "Valor" para
 * que la fila no se rompa (ver su propio comentario) — este Drawer es
 * donde se ve el valor COMPLETO, sin truncar, en fuente monoespaciada con
 * salto de línea preservado (`whitespace-pre-wrap`) — util especialmente
 * para valores `json` largos. "Tipo" reutiliza el mismo `VALUE_TYPE_LABELS`
 * que ya usa `ConfigurationForm.tsx`/`ConfigurationsTable.tsx`.
 */
export function ConfigurationDrawer({ configuration, onOpenChange, onEdit }: ConfigurationDrawerProps) {
  return (
    <WorkspacePanel open={configuration !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {configuration && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Settings2 className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate font-mono text-lg font-bold">
                  {configuration.key}
                </WorkspacePanelTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {configuration.sucursal.name}
                </p>
              </div>
              <Badge variant="muted">
                {VALUE_TYPE_LABELS[configuration.type] ?? configuration.type}
              </Badge>
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Información general
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Sucursal" value={configuration.sucursal.name} />
                  <InfoRow
                    label="Tipo"
                    value={VALUE_TYPE_LABELS[configuration.type] ?? configuration.type}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Valor
                </h3>
                <p className="rounded-lg bg-muted px-3 py-2.5 font-mono text-sm break-words whitespace-pre-wrap text-foreground">
                  {configuration.value}
                </p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Descripción
                </h3>
                <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                  {configuration.description ?? (
                    <span className="text-muted-foreground">Sin descripción</span>
                  )}
                </p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Creado" value={formatDateTime(configuration.createdAt)} />
                  <InfoRow label="Última actualización" value={formatDateTime(configuration.updatedAt)} />
                </div>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter>
              <WorkspacePanelClose
                render={
                  <Button type="button" variant="outline">
                    Cerrar
                  </Button>
                }
              />
              <Button
                type="button"
                onClick={() => onEdit(configuration)}
                className="gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
