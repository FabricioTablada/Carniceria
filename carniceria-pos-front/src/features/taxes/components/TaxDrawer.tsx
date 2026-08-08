import type { ReactNode } from 'react'
import { ArrowRight, Copy, Pencil, Percent, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/common/Badge'
import { Can } from '@/components/common/Can'
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
import { PERMISSIONS } from '@/constants/permissions'
import { useProducts } from '@/features/products/hooks/useProducts'
import { formatDateTime } from '@/utils/formatDateTime'
import { useUpdateTax } from '../hooks/useUpdateTax'
import { TaxStatusBadge } from './TaxStatusBadge'
import { getTaxErrorMessage } from '../utils/taxErrors'
import type { Tax } from '../types/tax.types'

interface TaxDrawerProps {
  /** Impuesto a mostrar. `null` cierra el panel (mismo criterio que
   * `ProductDrawer.tsx`/`CategoryDrawer.tsx`). */
  tax: Tax | null
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion —
   * mismo criterio que el resto de los Drawers del sprint. */
  onEdit: (tax: Tax) => void
  /** Rediseño de Impuestos (aprobado): navega a Productos ya filtrado por
   * este impuesto — mismo mecanismo `location.state` ya construido para
   * Categorías (`ProductsPage.tsx` ahora acepta `categoryId` o `taxId`). */
  onViewProducts: (tax: Tax) => void
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/** Mismo criterio que `CategoryDrawer.tsx`: solo se monta dentro de
 * `{tax && (...)}`, asi que su `useProducts` solo se ejecuta cuando hay
 * un impuesto real que mostrar (`useProducts` no acepta `enabled`, no se
 * modifica ese hook en este bloque). */
function TaxProductCount({ taxId }: { taxId: string }) {
  const { data, isLoading } = useProducts({ taxId, limit: 1 })
  const count = data?.meta.total

  return <>{isLoading ? '—' : (count ?? 0)}</>
}

/**
 * features/taxes/components/TaxDrawer.tsx
 * -----------------------------------------------------------------------------
 * Adaptacion del estandar de Productos/Categorias — no existia ningun
 * Drawer de Impuesto antes de este bloque. Construido sobre
 * `WorkspacePanel.tsx` (mismo primitivo). Sin miniatura ni color por
 * fila (a diferencia de Categorias): un impuesto no se "agrupa"
 * visualmente como una categoria, asi que el icono es un `Percent`
 * neutro (tono de marca), no un color determinístico por id.
 *
 * "Tasa" recibe el mismo tratamiento que "Precio de venta" en
 * `ProductDrawer.tsx` — el dato numerico que define al registro, en una
 * tarjeta destacada. "Por defecto" es un `Badge`, no texto plano.
 *
 * "Productos con este impuesto" reutiliza `useProducts({ taxId, limit: 1
 * })` (`features/products/hooks`, ya existente) — mismo criterio que
 * "Productos en esta categoría" de `CategoryDrawer.tsx`.
 *
 * Rediseño de Impuestos (aprobado): "Marcar como predeterminado" reutiliza
 * `useUpdateTax()` (mismo hook que `EditTaxPage.tsx`) con
 * `{ isDefault: true }` — el backend ya garantiza, en una transacción
 * atómica, que solo puede existir un impuesto por defecto a la vez
 * (`taxes.repository.ts`: desmarca cualquier otro al marcar uno nuevo), asi
 * que esta pantalla no necesita ninguna lógica adicional para esa regla.
 * Mismo criterio que "Activar/Desactivar" en `TaxesTable.tsx`: mutación
 * directa en el componente, con su propio feedback de éxito/error.
 *
 * Footer — mismo patron ESTRUCTURAL ya aprobado en `ProductDrawer.tsx`/
 * `CategoryDrawer.tsx` (no una solucion nueva): "Editar impuesto" a
 * `w-full` (unica accion primaria); "Cerrar" y "Ver productos con este
 * impuesto" con `flex-1` cada uno. Header: este Drawer nunca tuvo barra
 * "Anterior/Siguiente" (sin navegación entre impuestos), asi que nunca
 * estuvo expuesto al bug de la X que se corrigió en Productos — el caso
 * "sin barra" ya es idéntico por construcción, nada que cambiar.
 */
export function TaxDrawer({ tax, onOpenChange, onEdit, onViewProducts }: TaxDrawerProps) {
  const { mutate: updateTax, isPending: isSettingDefault } = useUpdateTax()

  const handleSetDefault = () => {
    if (!tax) {
      return
    }

    updateTax(
      { id: tax.id, dto: { isDefault: true } },
      {
        onSuccess: () => {
          toast.success(`"${tax.name}" es ahora el impuesto por defecto.`)
        },
        onError: (error) => {
          toast.error(getTaxErrorMessage(error))
        },
      },
    )
  }

  return (
    <WorkspacePanel open={tax !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm">
        {tax && (
          <>
            <WorkspacePanelHeader className="flex-row items-center gap-4 bg-muted/40 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Percent className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-xl font-bold">
                  {tax.name}
                </WorkspacePanelTitle>
                <p className="truncate font-mono text-sm text-muted-foreground">{tax.code}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {tax.isDefault && (
                  <Badge variant="accent" className="gap-1 font-bold">
                    <Star className="size-3" />
                    Por defecto
                  </Badge>
                )}
                <TaxStatusBadge active={tax.active} />
              </div>
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-6">
              <section className="rounded-xl border border-brand/15 bg-brand/5 p-4">
                <p className="text-xs font-semibold tracking-wide text-brand/70 uppercase">Tasa</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-brand">{tax.rate}%</p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Información general
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Código"
                    value={
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(tax.code)
                          toast.success('Código copiado al portapapeles.')
                        }}
                        className="inline-flex items-center gap-1.5 font-mono text-foreground transition-colors hover:text-brand"
                      >
                        {tax.code}
                        <Copy className="size-3.5 text-muted-foreground" />
                      </button>
                    }
                  />
                  <InfoRow
                    label="Por defecto"
                    value={
                      tax.isDefault ? (
                        <Badge variant="accent" className="gap-1 font-bold">
                          <Star className="size-3" />
                          Por defecto
                        </Badge>
                      ) : (
                        <Can permission={PERMISSIONS.TAXES_UPDATE}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleSetDefault}
                            disabled={isSettingDefault}
                            className="h-7 gap-1.5 text-xs"
                          >
                            <Star className="size-3.5" />
                            {isSettingDefault ? 'Marcando...' : 'Marcar como predeterminado'}
                          </Button>
                        </Can>
                      )
                    }
                  />
                  <InfoRow label="Productos" value={<TaxProductCount taxId={tax.id} />} />
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <div className="divide-y divide-border">
                  <InfoRow label="Creado" value={formatDateTime(tax.createdAt)} />
                  <InfoRow label="Última actualización" value={formatDateTime(tax.updatedAt)} />
                </div>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter className="flex-col items-stretch gap-2 pt-4 pb-6 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.12)]">
              <Can permission={PERMISSIONS.TAXES_UPDATE}>
                <Button
                  type="button"
                  onClick={() => onEdit(tax)}
                  className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                >
                  <Pencil className="size-4" />
                  Editar impuesto
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
                  onClick={() => onViewProducts(tax)}
                  className="flex-1 gap-2"
                >
                  Ver productos con este impuesto
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
