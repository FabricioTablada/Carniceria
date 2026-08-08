import type { ReactNode } from 'react'
import { KeyRound, Pencil } from 'lucide-react'
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
import { formatPermissionModuleLabel, getPermissionModuleKey } from '@/utils/permissionModule'
import type { Permission } from '../types/permission.types'

interface PermissionDrawerProps {
  /** Permiso a mostrar. `null` cierra el panel (mismo criterio que
   * `CategoryDrawer.tsx`/`TaxDrawer.tsx`). */
  permission: Permission | null
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion —
   * mismo criterio que el resto de los Drawers del proyecto ("el Drawer
   * nunca edita datos por si mismo"). */
  onEdit: (permission: Permission) => void
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
 * features/permissions/components/PermissionDrawer.tsx
 * -----------------------------------------------------------------------------
 * Bloque Permisos (rediseño, aprobado): no existía ningún Drawer de Permiso
 * antes de este bloque — hasta ahora "Editar" navegaba directo a la pantalla
 * completa sin una vista rápida previa, a diferencia del resto de los
 * catálogos del ERP. Construido sobre `WorkspacePanel.tsx` (mismo primitivo
 * que `CategoryDrawer.tsx`/`TaxDrawer.tsx`), con el mismo criterio de
 * interaccion: click en una fila de `PermissionTable.tsx` lo abre, la
 * edicion completa sigue siendo una accion EXPLICITA (boton "Editar
 * permiso" aca) — no se agrega edicion inline, para no romper el patrón ya
 * aprobado en el resto del Design System.
 *
 * Sin miniatura ni color por fila (igual que `TaxDrawer.tsx`: un permiso no
 * se "agrupa" visualmente como una categoría) — icono `KeyRound` neutro,
 * mismo que ya usa `PermissionForm.tsx`/el item de navegación.
 *
 * "Módulo" se deriva del código con el mismo criterio ya usado en
 * `PermissionTable.tsx` (`utils/permissionModule.ts`), sin ningún dato
 * nuevo del backend. Sin sección de "roles que usan este permiso": esa
 * consulta reversa no tiene endpoint hoy (`GET /permissions/:id/roles` no
 * existe) — agregarla implicaría tocar backend, fuera de alcance de este
 * bloque.
 */
export function PermissionDrawer({ permission, onOpenChange, onEdit }: PermissionDrawerProps) {
  return (
    <WorkspacePanel open={permission !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {permission && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <KeyRound className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate font-mono text-lg font-bold">
                  {permission.code}
                </WorkspacePanelTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {formatPermissionModuleLabel(getPermissionModuleKey(permission.code))}
                </p>
              </div>
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Información general
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Módulo"
                    value={formatPermissionModuleLabel(getPermissionModuleKey(permission.code))}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Descripción
                </h3>
                <p className="text-sm break-words whitespace-pre-wrap text-foreground">
                  {permission.description ?? (
                    <span className="text-muted-foreground">Sin descripción</span>
                  )}
                </p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Creado" value={formatDateTime(permission.createdAt)} />
                  <InfoRow label="Última actualización" value={formatDateTime(permission.updatedAt)} />
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
                onClick={() => onEdit(permission)}
                className="gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
              >
                <Pencil className="size-4" />
                Editar permiso
              </Button>
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
