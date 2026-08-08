import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleDashed, Copy, History, Pencil, ShoppingCart, Truck, X } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Can } from '@/components/common/Can'
import { CategoryBadge } from '@/components/common/CategoryBadge'
import { StockStatusBadge } from '@/components/common/StockStatusBadge'
import { Button } from '@/components/ui/button'
import { ProductThumbnail } from '@/components/ui/ProductThumbnail'
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
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDateTime } from '@/utils/formatDateTime'
import { formatQuantity } from '@/utils/formatQuantity'
import { useInventory } from '@/features/inventory/hooks/useInventory'
import { useProductLastPurchase } from '@/features/purchases/hooks/useProductLastPurchase'
import { useProductLastSale } from '../hooks/useProductLastSale'
import { ProductStatusBadge } from './ProductStatusBadge'
import type { Product } from '../types/product.types'

interface ProductDrawerProps {
  /** Producto a mostrar. `null` cierra el panel (mismo criterio que
   * `ConfirmDialog`/`open={pendingToggle !== null}` ya usado en
   * `ProductsTable.tsx`). */
  product: Product | null
  onOpenChange: (open: boolean) => void
  /** Unica accion de edicion: navega a la pantalla completa de edicion.
   * El Drawer nunca edita datos por si mismo — Decision A del sprint
   * ("Drawer sin dependencias inventadas") sigue vigente: solo muestra
   * campos que existen en `Product`. */
  onEdit: (product: Product) => void
  /** Rediseño de workspace (aprobado): navegación "Anterior"/"Siguiente"
   * dentro del propio Drawer, sin cerrarlo. Deliberadamente acotada a los
   * productos YA CARGADOS en la página actual (`ProductsPage.tsx` los
   * resuelve desde `data.data`, el mismo array que ya alimenta la tabla)
   * — cruzar de página automáticamente implicaría pedir la página
   * siguiente, sincronizar `usePagination`, y decidir qué pasa con
   * filtros en progreso: complejidad real fuera de lo que pidió este
   * bloque. `undefined` (prop ausente) oculta los controles por completo,
   * no solo los deshabilita — evita mostrar una navegación rota si quien
   * use este componente no la resuelve. */
  onNavigate?: (product: Product) => void
  previousProduct?: Product | null
  nextProduct?: Product | null
  /** Pulido visual (aprobado): posicion actual ("3 / 20") entre los
   * botones "Anterior"/"Siguiente" — puramente informativo, sin logica
   * propia (`ProductsPage.tsx` ya calculaba `drawerProductIndex`/
   * `data.data.length` para resolver `previousProduct`/`nextProduct`,
   * esto solo expone esos mismos numeros). Opcional y aditivo: ausente,
   * la barra se ve exactamente igual que antes de este bloque. */
  currentPosition?: number
  totalCount?: number
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(8.5rem,auto)_1fr] items-center gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center justify-end gap-1.5 text-right font-medium text-foreground">
        {value}
      </span>
    </div>
  )
}

/** Pulido visual (aprobado): encabezado compartido de cada seccion del
 * Drawer ("Información general", "Inventario", "Contexto", "Detalles",
 * "Descripción") — antes cada `<h3>` repetia la misma cadena de clases a
 * mano (6 veces, identicas byte a byte salvo el texto). Mismo criterio ya
 * usado en este archivo para `InfoRow`/`UnavailableValue`: un helper
 * local, no un componente nuevo en el Design System (sin otro consumidor
 * fuera de este archivo). Escala tipografica alineada a `KpiCard`
 * (`text-[0.6875rem]`, el mismo tamaño que ya usa su variante `xs`) para
 * que las etiquetas del Drawer y las de la franja de KPIs de
 * `ProductsPage.tsx` compartan la misma jerarquia visual. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  )
}

/** Bloque 6: reemplaza el `Badge` usado hasta ahora para "No disponible"
 * — un badge implica un estado categorico real (como "Activo"/
 * "Inactivo"), mientras que esto es la ausencia de un dato (Decision B:
 * stock no pedido para esta pantalla). Texto atenuado + icono punteado
 * en vez de una pastilla de color, para que se lea como "sin datos" y no
 * como un estado mas del producto. */
function UnavailableValue() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground italic">
      <CircleDashed className="size-3.5 shrink-0" />
      No disponible
    </span>
  )
}

/**
 * features/products/components/ProductDrawer.tsx
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1, Bloque 5: vista rapida de un producto sobre
 * `WorkspacePanel.tsx` (Design System, ya existente — panel deslizante
 * desde el borde derecho, primer consumidor real fuera de Ventas). Se
 * convierte en la interaccion PRIMARIA al hacer click sobre una fila de
 * `ProductsTable.tsx` (`onRowClick`, Bloque 5) — reemplaza el atajo de
 * "doble click abre Editar" de Bloque 4: ahora click abre el Drawer, y la
 * edicion completa es una accion explicita desde aca (boton "Editar
 * producto") o desde el menu "..." de la fila (`RowMenuItem` "Editar"),
 * nunca implicita al interactuar con la fila.
 *
 * Recibe el `Product` completo tal como ya esta cargado en
 * `ProductsPage.tsx`/`ProductsTable.tsx` — sin peticion nueva al backend
 * para los campos propios de `Product`. Decision A ("sin proveedor, sin
 * inventar datos") sigue aplicando a nivel de MODELO: `Product` no tiene
 * `supplierId`. Decision B ("sin selector de sucursal") queda superada por
 * el rediseño de este bloque: la existencia real ya no depende de que
 * `ProductsPage.tsx` pida el listado con `sucursalId` — se resuelve aca
 * mismo con `useInventory({ productId })` (filtro real del backend, suma
 * de todas las sucursales), reutilizando `StockStatusBadge`/
 * `resolveStockStatus` ya compartidos con `InventoryPage.tsx`.
 *
 * "Margen" es el unico valor que no viene directo del backend: se calcula
 * en el cliente a partir de `salePrice`/`cost` (ambos ya presentes en
 * `Product`), mismo criterio ya usado para "Inactivos" en
 * `ProductsKpiRow.tsx` (derivar de datos ya cargados, sin endpoint nuevo).
 *
 * Rediseño de Productos (panel de contexto): sección "Contexto" nueva —
 * última compra (`useProductLastPurchase`, ya construido para Compras),
 * última venta (`useProductLastSale`, mismo patrón, nuevo hook), y último
 * movimiento de inventario (`Inventory.updatedAt` — no existe un endpoint
 * de movimientos consultable hoy, así que se usa honestamente el dato mas
 * cercano ya real: la última vez que la existencia cambió). "Última
 * modificación" ya vivía en "Detalles" (`product.updatedAt`), sin cambios.
 * "Duplicar producto" se agrega como acción visible en el pie, mismo
 * patrón ya aprobado en Compras ("Duplicar compra anterior").
 *
 * Rediseño de workspace (aprobado): barra "Anterior"/"Siguiente" arriba
 * del header — ver el comentario de `onNavigate`/`previousProduct`/
 * `nextProduct` en `ProductDrawerProps`. Solo se renderiza cuando
 * `onNavigate` está presente (opcional y aditivo).
 *
 * Header — solucion ESTRUCTURAL final (aprobado, "la X sigue desalineada
 * respecto a Anterior/Siguiente, no quiero mas ajustes de padding"): los
 * intentos anteriores (`pr-14` para reservar espacio, luego `h-11` para
 * que la barra "contenga" a la X) seguian fallando porque la causa real
 * no era de tamaño — es que la X de `WorkspacePanelContent` es un boton
 * `absolute top-4 right-4` posicionado respecto a TODO el panel, sin
 * ninguna relacion estructural con el contenido de esta barra. Ningun
 * valor de padding/alto puede alinearla de forma confiable con algo de lo
 * que no es hijo. Fix definitivo, 100% local a este archivo (no se tocó
 * `WorkspacePanel.tsx`): cuando existe `onNavigate`, se apaga la X global
 * (`showCloseButton={!onNavigate}` en `WorkspacePanelContent` — prop ya
 * existente y opcional, mismo default para el resto de los 15+ Drawers
 * que no la usan) y se renderiza un `WorkspacePanelClose` propio como
 * ULTIMO HIJO REAL del mismo `flex` de la barra — separado por un
 * divisor vertical sutil (`h-5 w-px bg-border`). Al ser un hermano mas
 * dentro de un `flex items-center`, su centrado vertical respecto a
 * "Anterior"/"Siguiente" lo resuelve el propio modelo flexbox, no un
 * numero — no puede volver a desalinearse por un futuro ajuste de
 * padding. Cuando `onNavigate` esta ausente (no hay barra), el
 * comportamiento es identico al de siempre: X global del panel, con el
 * `pr-14` que ya trae por defecto `WorkspacePanelHeader`.
 *
 * Footer — solucion ESTRUCTURAL final (aprobado, "pensar como diseñador
 * senior para un Drawer angosto, no tres botones intentando entrar en
 * una fila"): en un panel `size="sm"` (máx. 380px, ~332px de contenido
 * util) cualquier distribucion horizontal de 3 botones con icono+texto
 * (`Duplicar producto`, `Editar producto`) se siente apretada sin
 * importar el `gap`/`justify-*` — el problema era de composicion, no de
 * margenes. Layout final de dos filas dentro de `WorkspacePanelFooter`
 * (`flex-col items-stretch`, override local — el default del componente
 * compartido, una fila `justify-end`, sigue intacto para el resto de
 * Drawers): fila 1, "Editar producto" a `w-full`, unica accion primaria
 * (relleno de marca); fila 2, "Cerrar" y "Duplicar producto" con
 * `flex-1` cada uno (mismo ancho exacto, `variant="outline"`, jerarquia
 * secundaria). El CTA de ancho completo le da a la accion mas importante
 * toda la presencia horizontal disponible; la fila de dos acciones
 * iguales resuelve el ajuste de las dos restantes sin depender de la
 * longitud de cada texto — patron estandar en paneles angostos (Notion,
 * Linear, hojas moviles) para el caso "primaria + acciones secundarias
 * agrupadas".
 *
 * Pulido visual (aprobado, "compactar para reducir scroll"): separacion
 * entre secciones del body (`gap-7`→`gap-5`), padding vertical propio del
 * body (`py-4`, antes heredaba `py-5` de `WorkspacePanelBody`), filas de
 * `InfoRow` (`py-2.5`→`py-2`) y encabezados de seccion (`mb-2.5`→`mb-2`)
 * mas ajustados. Tarjeta de "Precio de venta": padding `py-3.5`→`py-3`,
 * precio principal `text-[1.75rem]`→`text-2xl`, "Costo"/"Margen" mas
 * cerca del precio y entre si (`mt-3 gap-3 pt-3`→`mt-2.5 gap-2 pt-2.5`).
 * Misma jerarquia (precio > costo/margen > filas de detalle), solo menos
 * aire entre cada nivel — sin cambios de datos ni de las secciones que se
 * muestran.
 *
 * Segunda pasada de compactacion (aprobado, "recuperar altura real, no
 * unos pocos pixeles"): ademas de ajustar paddings, se aborda lo que mas
 * altura ocupaba. Header: miniatura `size-16`→`size-12`, `py-5`→`py-3`,
 * titulo `text-xl`→`text-lg` (~104px→~74px). Barra "Anterior/Siguiente":
 * botones `size="sm"`→`size="xs"`, `py-2.5`→`py-1.5` (~49px→~36px).
 * Tarjeta de precio: segunda vuelta de recorte (`py-3`→`py-2.5`, precio
 * `text-2xl`→`text-xl`). `InfoRow`: `py-2`→`py-1.5` en las 11 filas
 * restantes. Seccion "Inventario": las 3 filas Sí/No de configuracion
 * (Controla inventario/Peso variable/Usa control por lotes) se pliegan en
 * una unica fila de chips (`Badge`, ya existente en el Design System) —
 * mismos 3 datos, misma fuente (`product.trackInventory`/
 * `isVariableWeight`/`requiresBatch`), sin logica nueva, ~2 filas menos.
 * Recorte total estimado sobre la version anterior: ~200-220px de alto en
 * un producto tipico (sin "Descripción"), suficiente para que la mayoria
 * de la informacion entre sin scroll en una resolucion de escritorio
 * estandar (~900px+ de alto util). Jerarquia y legibilidad verificadas:
 * ningun texto baja de `text-xs`/`0.6875rem`, mismos componentes
 * (`Badge`/`StockStatusBadge`/`CategoryBadge`) sin variantes nuevas.
 *
 * Tercera pasada de compactacion (aprobado, "la anterior no fue
 * suficiente, seguia pidiendo scroll"): recorte adicional de padding
 * vertical en todos los niveles ya compactados, sin tocar tipografia por
 * debajo del piso ya establecido (`text-xs`/`0.6875rem`). Header:
 * `py-3`→`py-2`, miniatura `size-12`→`size-10`. Barra "Anterior/
 * Siguiente": `py-1.5`→`py-1`. Cuerpo (`WorkspacePanelBody`):
 * `gap-4`→`gap-3`, `py-3`→`py-2`. Tarjeta de precio: `py-2.5`→`py-2`,
 * fila Costo/Margen `mt-2 pt-2`→`mt-1.5 pt-1.5`. `InfoRow`: `py-1.5`→
 * `py-1` en las 11 filas restantes. `SectionHeading`: `mb-1.5`→`mb-1`.
 * Pie: `pt-3 pb-5`→`pt-2 pb-4`. Recorte adicional estimado: ~110-120px,
 * sobre las ~200-220px ya recuperadas en la pasada anterior (~310-340px
 * en total respecto de la version original, previa a cualquier
 * compactacion). Mismas secciones, mismos datos, mismo comportamiento —
 * unicamente espaciados.
 */
export function ProductDrawer({
  product,
  onOpenChange,
  onEdit,
  onNavigate,
  previousProduct,
  nextProduct,
  currentPosition,
  totalCount,
}: ProductDrawerProps) {
  const navigate = useNavigate()

  const margin =
    product && product.salePrice > 0
      ? ((product.salePrice - product.cost) / product.salePrice) * 100
      : null

  const { data: inventoryResponse } = useInventory(
    { productId: product?.id ?? '', limit: 50 },
    { enabled: product !== null },
  )
  const inventoryRows = inventoryResponse?.data ?? []
  const totalStock = inventoryRows.reduce((sum, row) => sum + row.quantity, 0)
  const reorderPoints = inventoryRows
    .map((row) => row.reorderPoint)
    .filter((value): value is number => value !== null)
  const reorderPoint = reorderPoints.length > 0 ? Math.min(...reorderPoints) : null
  // Proxy honesto de "último movimiento": la fila de existencia mas
  // reciente refleja el ultimo cambio de cantidad — sin tipo/motivo del
  // movimiento (eso viviria en `InventoryMovement`, sin endpoint de
  // consulta hoy), pero real, no inventado.
  const lastInventoryUpdate = inventoryRows
    .map((row) => row.updatedAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

  const { data: lastPurchase } = useProductLastPurchase(product?.id ?? '')
  const { data: lastSale } = useProductLastSale(product?.id ?? '')

  const handleDuplicate = () => {
    if (!product) {
      return
    }

    onOpenChange(false)
    navigate('/products/new', { state: { duplicateFrom: product } })
  }

  return (
    <WorkspacePanel open={product !== null} onOpenChange={onOpenChange}>
      <WorkspacePanelContent size="sm" showCloseButton={!onNavigate}>
        {product && (
          <>
            {onNavigate && (
              <div className="flex shrink-0 items-center gap-2 border-b bg-muted/60 py-1.5 pr-3 pl-5">
                <div className="flex flex-1 items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={!previousProduct}
                    onClick={() => previousProduct && onNavigate(previousProduct)}
                    className="gap-1"
                  >
                    <ChevronLeft className="size-3.5" />
                    Anterior
                  </Button>

                  {currentPosition !== undefined && totalCount !== undefined && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {currentPosition} / {totalCount}
                    </span>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={!nextProduct}
                    onClick={() => nextProduct && onNavigate(nextProduct)}
                    className="gap-1"
                  >
                    Siguiente
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>

                <div className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />

                <WorkspacePanelClose
                  render={
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Cerrar" className="shrink-0">
                      <X className="size-4" />
                    </Button>
                  }
                />
              </div>
            )}

            <WorkspacePanelHeader className="flex-row items-center gap-3 bg-muted/40 py-2">
              <ProductThumbnail
                imageUrl={product.imageUrl}
                title={product.name}
                containerClassName="size-10 shrink-0 rounded-lg"
                textClassName="text-base text-brand/50"
              />
              <div className="min-w-0 flex-1">
                <WorkspacePanelTitle className="truncate text-lg font-bold">
                  {product.name}
                </WorkspacePanelTitle>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {product.sku ?? 'Sin SKU'}
                </p>
              </div>
              <ProductStatusBadge active={product.active} />
            </WorkspacePanelHeader>

            <WorkspacePanelBody className="flex flex-col gap-3 py-2 pr-8">
              <section className="rounded-xl border border-brand/15 bg-brand/5 px-4 py-2">
                <p className="text-[0.6875rem] font-semibold tracking-wide text-brand/70 uppercase">
                  Precio de venta
                </p>
                <p className="mt-0.5 text-xl leading-none font-bold tabular-nums text-brand">
                  {formatCurrency(product.salePrice)}
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-2 border-t border-brand/15 pt-1.5">
                  <div>
                    <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
                      Costo
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(product.cost)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
                      Margen
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeading>Información general</SectionHeading>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Categoría"
                    value={
                      <CategoryBadge
                        categoryId={product.categoryId}
                        label={product.category.name}
                        color={product.category.color}
                      />
                    }
                  />
                  <InfoRow
                    label="Impuesto"
                    value={`${product.tax.name} (${(product.tax.rate * 100).toFixed(0)}%)`}
                  />
                  <InfoRow
                    label="Unidad de medida"
                    value={product.unitOfMeasure === 'KILOGRAM' ? 'Kilogramo' : 'Unidad'}
                  />
                  <InfoRow
                    label="Código de barras"
                    value={
                      <span className="font-mono">{product.barcode ?? '—'}</span>
                    }
                  />
                  <InfoRow
                    label="Código CABYS"
                    value={
                      <span className="font-mono">{product.cabysCode ?? '—'}</span>
                    }
                  />
                </div>
              </section>

              <section>
                <SectionHeading>Inventario</SectionHeading>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Existencia"
                    value={
                      inventoryRows.length > 0 ? (
                        <StockStatusBadge
                          quantity={totalStock}
                          unitOfMeasure={product.unitOfMeasure}
                          reorderPoint={reorderPoint}
                        />
                      ) : (
                        <UnavailableValue />
                      )
                    }
                  />
                  {/* Compactacion (aprobado, "reducir scroll"): las 3
                      filas Si/No de configuracion (Controla inventario/
                      Peso variable/Bloque LOTES-08 Usa control por lotes)
                      se pliegan en una sola fila de chips — mismos 3
                      datos, mismo `Badge` ya usado en el resto del ERP,
                      solo lectura (la edicion sigue viviendo en
                      ProductFormSummary.tsx). Ninguno activo muestra "—",
                      mismo criterio que el resto de valores ausentes. */}
                  <InfoRow
                    label="Atributos"
                    value={
                      [
                        product.trackInventory && 'Controla inventario',
                        product.isVariableWeight && 'Peso variable',
                        product.requiresBatch && 'Usa control por lotes',
                      ].filter((label): label is string => Boolean(label)).length > 0 ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {product.trackInventory && <Badge variant="muted">Controla inventario</Badge>}
                          {product.isVariableWeight && <Badge variant="muted">Peso variable</Badge>}
                          {product.requiresBatch && <Badge variant="muted">Usa por lotes</Badge>}
                        </div>
                      ) : (
                        '—'
                      )
                    }
                  />
                </div>
              </section>

              <section>
                <SectionHeading>Contexto</SectionHeading>
                <div className="divide-y divide-border">
                  <InfoRow
                    label="Última compra"
                    value={
                      lastPurchase ? (
                        <>
                          <Truck className="size-3.5 shrink-0 text-muted-foreground" />
                          {formatCurrency(lastPurchase.lastUnitCost)} · {lastPurchase.lastSupplierName}
                        </>
                      ) : (
                        <UnavailableValue />
                      )
                    }
                  />
                  <InfoRow
                    label="Última venta"
                    value={
                      lastSale ? (
                        <>
                          <ShoppingCart className="size-3.5 shrink-0 text-muted-foreground" />
                          {formatQuantity(lastSale.quantity, product.unitOfMeasure)} ·{' '}
                          {formatDateTime(lastSale.saleDate)}
                        </>
                      ) : (
                        <UnavailableValue />
                      )
                    }
                  />
                  <InfoRow
                    label="Último movimiento de inventario"
                    value={
                      lastInventoryUpdate ? (
                        <>
                          <History className="size-3.5 shrink-0 text-muted-foreground" />
                          {formatDateTime(lastInventoryUpdate)}
                        </>
                      ) : (
                        <UnavailableValue />
                      )
                    }
                  />
                </div>
              </section>

              {product.description && (
                <section>
                  <SectionHeading>Descripción</SectionHeading>
                  <p className="text-sm text-foreground">{product.description}</p>
                </section>
              )}

              <section>
                <SectionHeading>Detalles</SectionHeading>
                <div className="divide-y divide-border">
                  <InfoRow label="Creado" value={formatDateTime(product.createdAt)} />
                  <InfoRow label="Última actualización" value={formatDateTime(product.updatedAt)} />
                </div>
              </section>
            </WorkspacePanelBody>

            <WorkspacePanelFooter className="flex-col items-stretch gap-2 pt-4 pb-6 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.12)]">
              <Can permission={PERMISSIONS.PRODUCTS_UPDATE}>
                <Button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active"
                >
                  <Pencil className="size-4" />
                  Editar producto
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
                  onClick={handleDuplicate}
                  className="flex-1 gap-2"
                >
                  <Copy className="size-4" />
                  Duplicar producto
                </Button>
              </div>
            </WorkspacePanelFooter>
          </>
        )}
      </WorkspacePanelContent>
    </WorkspacePanel>
  )
}
