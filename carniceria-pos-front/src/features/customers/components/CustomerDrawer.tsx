import type { ReactNode } from 'react'
import { Copy, Mail, Pencil, Phone, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Can } from '@/components/common/Can'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/constants/permissions'
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
import { CustomerStatusBadge } from './CustomerStatusBadge'
import type { Customer } from '../types/customer.types'

interface CustomerDrawerProps {
  /** Cliente a mostrar. `null` cierra el panel (mismo criterio que
   * `SupplierDrawer.tsx`). */
  customer: Customer | null
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion. */
  onEdit: (customer: Customer) => void
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * features/customers/components/CustomerDrawer.tsx
 * -----------------------------------------------------------------------------
 * Bloque 8.2 — adaptacion de `SupplierDrawer.tsx`: mismo `WorkspacePanel`,
 * mismo lenguaje visual (ícono neutro, `InfoRow` con enlaces `mailto:`/
 * `tel:`). Sin bloque "Resumen comercial" ni acción "Nueva compra" — no
 * hay ninguna relación Cliente↔Compra en este bloque. Footer con una única
 * acción secundaria ("Cerrar"), a diferencia del footer de 2 columnas de
 * Proveedores.
 */
export function CustomerDrawer({ customer, onOpenChange, onEdit }: CustomerDrawerProps) {
  return (
    <WorkspacePanel open={customer !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {customer && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <UserRound className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {customer.name}
                </WorkspacePanelTitle>
                <p className="truncate font-mono text-sm text-muted-foreground">
                  {customer.identificationType} {customer.identificationNumber}
                </p>
              </div>
              <CustomerStatusBadge active={customer.active} />
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Información general
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Identificación"
                    value={
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(customer.identificationNumber)
                          toast.success('Identificación copiada al portapapeles.')
                        }}
                        className="inline-flex items-center gap-1.5 font-mono text-foreground transition-colors hover:text-brand"
                      >
                        {customer.identificationNumber}
                        <Copy className="size-3.5 text-muted-foreground" />
                      </button>
                    }
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Contacto
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Correo"
                    value={
                      customer.email ? (
                        <a
                          href={`mailto:${customer.email}`}
                          className="inline-flex items-center gap-1.5 text-brand hover:underline"
                        >
                          <Mail className="size-3.5 shrink-0" />
                          {customer.email}
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <InfoRow
                    label="Teléfono"
                    value={
                      customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          className="inline-flex items-center gap-1.5 text-brand hover:underline"
                        >
                          <Phone className="size-3.5 shrink-0" />
                          {customer.phone}
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <InfoRow label="Dirección" value={customer.address ?? '—'} />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Creado" value={formatDateTime(customer.createdAt)} />
                  <InfoRow label="Última actualización" value={formatDateTime(customer.updatedAt)} />
                </div>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter className="flex-col items-stretch gap-2 pt-4 pb-6 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.12)]">
              <Can permission={PERMISSIONS.CUSTOMERS_UPDATE}>
                <Button
                  type="button"
                  onClick={() => onEdit(customer)}
                  className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                >
                  <Pencil className="size-4" />
                  Editar cliente
                </Button>
              </Can>
              <WorkspacePanelClose
                render={
                  <Button type="button" variant="outline" className="w-full">
                    Cerrar
                  </Button>
                }
              />
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
