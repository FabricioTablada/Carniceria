import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  WorkspacePanel,
  WorkspacePanelBody,
  WorkspacePanelContent,
  WorkspacePanelDescription,
  WorkspacePanelHeader,
  WorkspacePanelTitle,
} from '@/components/ui/WorkspacePanel'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { useSales } from '../hooks/useSales'
import { useUsers } from '@/features/users/hooks/useUsers'
import { SaleFilters } from './SaleFilters'
import { SalesTable } from './SalesTable'
import { SaleDetailContent } from './SaleDetailContent'
import { SaleMiniDetailPanel } from './SaleMiniDetailPanel'
import type { Sale, SaleFilters as SaleFiltersValue } from '../types/sale.types'

/** Mismo limite defensivo que `CashSessionDetailPage.tsx` — una sesion es a
 * lo sumo un turno de caja, no requiere paginacion en pantalla. */
const SESSION_SALES_LIMIT = 500

/** QA (UX, "Ventas de la sesión"): la TABLA solo muestra las N ventas mas
 * recientes — sin paginacion, sin "ver mas", sin scroll adicional. El
 * historial completo de la sesion sigue disponible en Caja/Reportes, que
 * son los lugares pensados para consultarlo. Deliberadamente NO se baja
 * `SESSION_SALES_LIMIT` (el `limit` que se envia a `useSales`): el
 * recorte es puramente de PRESENTACION (`.slice` sobre la respuesta ya
 * ordenada por `createdAt desc`, mismo criterio que el backend), para que
 * el contador de "X ventas encontradas" siga reflejando el total real que
 * cumple los filtros — cambiar el `limit` de la query haria que ese
 * contador mintiera (mostraria el total real pero la tabla solo 10 filas,
 * sin relacion visible entre ambos numeros). */
const SESSION_SALES_DISPLAY_LIMIT = 10

interface SessionSalesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sesion de caja activa. `null`/vacio deja la consulta deshabilitada
   * (no debería abrirse sin sesion abierta, pero es defensivo). */
  cashSessionId: string | null
}

/**
 * features/sales/components/SessionSalesDialog.tsx
 * -----------------------------------------------------------------------------
 * Bloque 3 ("un verdadero espacio de trabajo"): elimina la experiencia de
 * "panel + modal encima" del Bloque 2. `selectedSaleId` ya no abre un
 * segundo `Dialog` (`SaleDetailDialog.tsx`) — controla directamente qué se
 * muestra DENTRO del mismo `WorkspacePanel`: `null` = lista (filtros +
 * tabla), con id = `SaleDetailContent` (el mismo contenido extraído de
 * `SaleDetailDialog.tsx`, con toda su lógica de permisos/anular/corregir/
 * devolver intacta, ver ese archivo).
 *
 * Navegación: el botón "Volver a la lista" (en el header del panel,
 * reemplaza al título mientras se ve el detalle) es la única pieza nueva
 * de UI — no se tocó `WorkspacePanel.tsx` para esto, porque
 * `WorkspacePanelHeader` ya acepta cualquier `children` (mismo criterio
 * que `PageHeader.tsx`: el contenedor no decide qué va adentro). Cerrar el
 * panel entero (X, Escape, click afuera) sigue siendo una acción distinta
 * de "volver a la lista" — cierra el panel completo sin importar en qué
 * vista se esté, comportamiento heredado de `Dialog` sin código adicional.
 *
 * Al VOLVER A ABRIR el panel después de haberlo cerrado en medio del
 * detalle de una venta, se resetea a la lista — un panel de trabajo
 * profesional no debería reabrir en una sub-vista que el usuario ya
 * abandonó. Mismo patrón de "ajuste de estado durante el render" ya usado
 * en el proyecto (`SaleDetailContent.tsx`, `previousSaleId`).
 *
 * Bloque POS-06 ("mini detalle"): `quickViewSale` es un segundo estado,
 * completamente independiente de `selectedSaleId` — abre
 * `SaleMiniDetailPanel.tsx`, un panel ADICIONAL (hermano de este mismo
 * `WorkspacePanel`, no anidado ni reemplazando nada) con un vistazo
 * rapido y de solo lectura. El flujo existente ("Ver" -> `selectedSaleId`
 * -> `SaleDetailContent` completo, con Anular/Corregir/Devolver) sigue
 * exactamente igual, sin ningun cambio.
 */
export function SessionSalesDialog({ open, onOpenChange, cashSessionId }: SessionSalesDialogProps) {
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Omit<SaleFiltersValue, 'cashSessionId' | 'limit'>>({})

  // Bloque POS-06: vista rapida ADICIONAL al flujo de arriba — no
  // reemplaza `selectedSaleId`/`SaleDetailContent` (que sigue exactamente
  // igual). Guarda la venta COMPLETA (no solo el id): ya esta cargada en
  // `visibleSales` (mas abajo), asi que abrir este panel no dispara
  // ninguna peticion nueva.
  const [quickViewSale, setQuickViewSale] = useState<Sale | null>(null)

  const [previousOpen, setPreviousOpen] = useState(open)
  if (open !== previousOpen) {
    setPreviousOpen(open)
    if (!open) {
      setSelectedSaleId(null)
    }
  }

  const { data, isLoading, isError, error } = useSales(
    { ...filters, cashSessionId: cashSessionId ?? undefined, limit: SESSION_SALES_LIMIT },
    { enabled: open && Boolean(cashSessionId) },
  )

  // Ya ordenadas por el backend (`createdAt desc`, mas reciente primero,
  // sin cambios) — el `.slice` solo recorta CUANTAS de esas se muestran,
  // nunca reordena. Al invalidarse `['sales']` tras una venta nueva
  // (`useCreateSale`), este mismo calculo se re-evalua con la lista ya
  // actualizada: la venta nueva entra en la posicion 0 y, si ya habia 10,
  // la mas antigua deja de estar entre las primeras `SESSION_SALES_DISPLAY_LIMIT`
  // automaticamente — sin ningun estado ni logica adicional que lo gestione.
  const visibleSales = (data?.data ?? []).slice(0, SESSION_SALES_DISPLAY_LIMIT)
  const totalSales = data?.meta.total ?? 0

  // Cajeros para poblar el selector de filtro — mismo criterio que
  // `SalesPage.tsx`: reutiliza un modulo ya existente y funcional en vez
  // de inventar uno nuevo. Cacheado por React Query, sin costo de red
  // adicional si `SalesPage.tsx` ya lo pidio en esta sesion.
  const { data: usersResponse } = useUsers({ active: true })
  const users = (usersResponse?.data ?? []).map((user) => ({
    id: user.id,
    name: user.fullName,
  }))

  return (
    <>
      <WorkspacePanel open={open} onOpenChange={onOpenChange}>
        {/* `xl` (880px) no alcanzaba: el detalle de venta (`SaleDetailContent.tsx`)
            activaba el scroll horizontal de seguridad de la tabla de
            Productos, algo que en el Dialog de Ventas (administración,
            más ancho) no pasaba — ver `WorkspacePanel.tsx` para el detalle
            completo del ancho elegido. */}
        <WorkspacePanelContent size="2xl">
          <WorkspacePanelHeader>
            {selectedSaleId === null ? (
              <>
                <WorkspacePanelTitle>Ventas de la sesión</WorkspacePanelTitle>
                <WorkspacePanelDescription>
                  Ventas registradas en la caja actualmente abierta. Selecciona una para ver su
                  detalle completo.
                </WorkspacePanelDescription>
              </>
            ) : (
              // Estilo de "nav de regreso" (no un boton generico mas):
              // nombra el destino ("Ventas de la sesión"), no una accion
              // generica ("Volver") — mismo criterio que un breadcrumb —
              // con una micro-animacion en la flecha al hover para que se
              // sienta como navegacion real dentro del workspace, no una
              // accion aislada encima del contenido.
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSaleId(null)}
                className="group -ml-2 w-fit gap-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
                Ventas de la sesión
              </Button>
            )}
          </WorkspacePanelHeader>

          <WorkspacePanelBody className="flex flex-col gap-4">
            {selectedSaleId === null ? (
              <>
                <SaleFilters filters={filters} users={users} onFiltersChange={setFilters} />

                {!isLoading && !isError && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {totalSales > SESSION_SALES_DISPLAY_LIMIT
                      ? `Mostrando las ${SESSION_SALES_DISPLAY_LIMIT} más recientes de ${totalSales} ventas`
                      : `${totalSales} ${totalSales === 1 ? 'venta encontrada' : 'ventas encontradas'}`}
                  </p>
                )}

                {isLoading && <LoadingState message="Cargando ventas..." />}

                {isError && (
                  <ErrorAlert>
                    {error?.message ?? 'Ocurrió un error al cargar las ventas.'}
                  </ErrorAlert>
                )}

                {!isLoading && !isError && (
                  <SalesTable
                    sales={visibleSales}
                    onSelectSale={setSelectedSaleId}
                    onQuickView={(saleId) =>
                      setQuickViewSale(visibleSales.find((sale) => sale.id === saleId) ?? null)
                    }
                    compact
                  />
                )}
              </>
            ) : (
              <SaleDetailContent
                saleId={selectedSaleId}
                onClose={() => setSelectedSaleId(null)}
              />
            )}
          </WorkspacePanelBody>
        </WorkspacePanelContent>
      </WorkspacePanel>

      {/* Bloque POS-06: hermano del `WorkspacePanel` de arriba, NO anidado
          dentro — mismo criterio ya usado en el proyecto para apilar un
          segundo dialogo encima de otro (ej. `ConfirmDialog` junto a
          `Dialog` en `PromotionsTable.tsx`). Vista rapida ADICIONAL,
          independiente de `selectedSaleId`/`SaleDetailContent` de arriba. */}
      <SaleMiniDetailPanel
        sale={quickViewSale}
        onOpenChange={(open) => {
          if (!open) {
            setQuickViewSale(null)
          }
        }}
      />
    </>
  )
}
