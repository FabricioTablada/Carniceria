import type { ReactNode } from 'react'
import { ArrowRight, Building2, Copy, Mail, Pencil, Phone } from 'lucide-react'
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
import { SupplierCommercialCard } from './SupplierCommercialCard'
import { SupplierStatusBadge } from './SupplierStatusBadge'
import type { Supplier } from '../types/supplier.types'

interface SupplierDrawerProps {
  /** Proveedor a mostrar. `null` cierra el panel (mismo criterio que el
   * resto de los Drawers del sprint). */
  supplier: Supplier | null
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion. */
  onEdit: (supplier: Supplier) => void
  /** Rediseño de Proveedores (aprobado): navega a "Nueva compra" con este
   * proveedor ya preseleccionado — mismo mecanismo `location.state` ya
   * construido para Categorías/Impuestos. */
  onNewPurchase: (supplier: Supplier) => void
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
 * features/suppliers/components/SupplierDrawer.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar de Productos/Categorias/Impuestos — no existia
 * ningun Drawer de Proveedor antes de este bloque. Construido sobre
 * `WorkspacePanel.tsx`. Sin color por id (como Impuestos, no como
 * Categorias): icono `Building2` neutro, tono de marca.
 *
 * Aca es donde Correo/Telefono/Direccion reciben la jerarquia visual
 * pedida — la tabla no los muestra (mismo criterio que hoy), pero el
 * Drawer si, como campos grandes con enlaces `mailto:`/`tel:` (HTML
 * plano, sin logica nueva).
 *
 * Pulido final aprobado: se retiró `PurchaseSupplierContextPanel.tsx`
 * ("Este proveedor") del Drawer — quedaba con una altura rota/mínima y
 * era enteramente redundante con `SupplierCommercialCard.tsx` (mismos
 * datos: última compra, promedio, productos distintos, todos ya
 * presentes en "Resumen comercial"). Ningún hook ni cálculo nuevo: el
 * bloque "Resumen comercial" sigue siendo la única fuente visual de esos
 * datos en este Drawer.
 *
 * Footer (aprobado): patron familiar de 3 acciones — "Editar proveedor"
 * primaria a ancho completo, "Cerrar"/"Nueva compra" secundarias en fila
 * `flex-1` debajo, igual que Producto/Categoría/Impuesto/Promoción.
 * Este Drawer nunca tuvo la barra "Anterior/Siguiente" (`onNavigate`) del
 * Drawer de Producto, asi que no hay bug de alineacion de la X que
 * corregir aca — `showCloseButton` por defecto es correcto tal cual.
 */
export function SupplierDrawer({ supplier, onOpenChange, onEdit, onNewPurchase }: SupplierDrawerProps) {
  return (
    <WorkspacePanel open={supplier !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {supplier && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Building2 className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {supplier.name}
                </WorkspacePanelTitle>
                {supplier.legalId && (
                  <p className="truncate font-mono text-sm text-muted-foreground">
                    {supplier.legalId}
                  </p>
                )}
              </div>
              <SupplierStatusBadge active={supplier.active} />
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
                      supplier.legalId ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(supplier.legalId as string)
                            toast.success('Identificación copiada al portapapeles.')
                          }}
                          className="inline-flex items-center gap-1.5 font-mono text-foreground transition-colors hover:text-brand"
                        >
                          {supplier.legalId}
                          <Copy className="size-3.5 text-muted-foreground" />
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    }
                  />
                </div>
              </section>

              <SupplierCommercialCard supplierId={supplier.id} />

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Contacto
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Contacto principal" value={supplier.contactName ?? '—'} />
                  <InfoRow
                    label="Correo"
                    value={
                      supplier.email ? (
                        <a
                          href={`mailto:${supplier.email}`}
                          className="inline-flex items-center gap-1.5 text-brand hover:underline"
                        >
                          <Mail className="size-3.5 shrink-0" />
                          {supplier.email}
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <InfoRow
                    label="Teléfono"
                    value={
                      supplier.phone ? (
                        <a
                          href={`tel:${supplier.phone}`}
                          className="inline-flex items-center gap-1.5 text-brand hover:underline"
                        >
                          <Phone className="size-3.5 shrink-0" />
                          {supplier.phone}
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <InfoRow label="Dirección" value={supplier.address ?? '—'} />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Creado" value={formatDateTime(supplier.createdAt)} />
                  <InfoRow label="Última actualización" value={formatDateTime(supplier.updatedAt)} />
                </div>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter className="flex-col items-stretch gap-2 pt-4 pb-6 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.12)]">
              <Can permission={PERMISSIONS.SUPPLIERS_UPDATE}>
                <Button
                  type="button"
                  onClick={() => onEdit(supplier)}
                  className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                >
                  <Pencil className="size-4" />
                  Editar proveedor
                </Button>
              </Can>
              <div className="flex items-center gap-2">
                <WorkspacePanelClose
                  render={
                    <Button type="button" variant="outline" className="flex-1">
                      Cerrar
                    </Button>
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onNewPurchase(supplier)}
                  className="flex-1 gap-2"
                >
                  Nueva compra
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
