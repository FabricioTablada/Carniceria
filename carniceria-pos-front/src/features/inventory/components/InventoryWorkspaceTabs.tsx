import { useLocation, useNavigate } from 'react-router-dom'
import { Boxes, Layers3, PackageMinus, TriangleAlert } from 'lucide-react'
import { Tabs, TabsList, TabsTab } from '@/components/ui/Tabs'
import { useLowStock } from '@/features/reports/hooks/useLowStock'

const ROUTES = {
  inventory: '/inventory',
  alerts: '/inventory/alerts',
  batches: '/inventory/batches',
  waste: '/inventory/waste',
} as const

type WorkspaceTabValue = keyof typeof ROUTES

/**
 * features/inventory/components/InventoryWorkspaceTabs.tsx
 * -----------------------------------------------------------------------------
 * Rediseño de Inventario — "workspace unificado": Existencias/Alertas de
 * stock/Lotes/Mermas dejan de ser 3 botones sueltos en distintos Toolbars
 * (antes: "Historial de mermas"/"Lotes" en `InventoryPage.tsx`) y pasan a
 * ser pestañas persistentes, reutilizando el mismo `Tabs` ya construido
 * para Compras/Productos. Son pestañas de NAVEGACIÓN (cada una es una ruta
 * real ya existente, `/inventory`/`/inventory/alerts`/`/inventory/batches`/
 * `/inventory/waste`) — no un `TabsPanel` que intercambia contenido en
 * memoria, a propósito: cada pantalla ya tiene su propia consulta/estado
 * de filtros bien resuelto (Sprint UX/UI PIPASA V1); fusionarlas en un
 * único árbol de componentes duplicaría esa lógica en vez de reutilizarla.
 * El `value` se deriva de la URL actual; `onValueChange` navega.
 *
 * "Alertas de stock" (`/inventory/alerts`, nuevo): activa `useLowStock`
 * (ya existente, `features/reports`) dentro de Inventario — mismo hook,
 * mismo endpoint, sin cambio de backend. El badge de la pestaña reutiliza
 * ese mismo hook (TanStack Query cachea por `queryKey`, así que no dispara
 * una segunda consulta si `InventoryAlertsPage.tsx` ya está montada).
 *
 * Centro de Control de Inventario (aprobado): cada pestaña suma un ícono
 * — identidad visual consistente con el resto de la cáscara compartida
 * (`InventoryPage.tsx`/`BatchesPage.tsx`/`InventoryWastesPage.tsx`, ver
 * el Canvas Workspace único de cada una). Las 4 pestañas siguen siendo
 * rutas de navegación reales — este bloque no las convierte en
 * `TabsPanel` en memoria, por el mismo motivo ya documentado arriba.
 *
 * Navegación activa (aprobado, "cierre definitivo"): `TabsTab`/`TabsList`
 * (`components/ui/Tabs.tsx`) se reutilizan tal cual — sin tocar ese
 * archivo compartido (Compras/Productos/Caja/Ventas también lo usan con
 * su estilo de subrayado de siempre) — solo se sobreescribe la
 * presentación vía `className` (aditivo, mismo mecanismo ya pensado para
 * esa prop). Pestaña activa: `bg-brand`/`text-brand-foreground` (mismo
 * lenguaje "píldora rellena" que `SegmentedControl.tsx`), `rounded-lg`,
 * transición `duration-200`. `TAB_CLASSNAME` evita repetir la misma
 * cadena de clases 4 veces ("no duplicar código").
 */
const TAB_CLASSNAME =
  'inline-flex h-10 flex-1 min-w-fit items-center justify-center gap-2 rounded-lg border-b-0 mb-0 px-4 text-sm font-semibold text-muted-foreground transition-all duration-200 ease-out hover:bg-muted/60 hover:text-foreground data-[selected]:bg-brand data-[selected]:text-brand-foreground data-[selected]:shadow-sm'
export function InventoryWorkspaceTabs() {
  const location = useLocation()
  const navigate = useNavigate()

  const { data: lowStockItems } = useLowStock({})
  const alertsCount = lowStockItems?.length

  const activeTab: WorkspaceTabValue =
    (Object.keys(ROUTES) as WorkspaceTabValue[]).find((key) =>
      key === 'inventory' ? location.pathname === ROUTES.inventory : location.pathname.startsWith(ROUTES[key]),
    ) ?? 'inventory'

  return (
    <Tabs value={activeTab} onValueChange={(value) => navigate(ROUTES[value as WorkspaceTabValue])}>
      <TabsList className="gap-2 overflow-x-auto">
        <TabsTab value="inventory" className={TAB_CLASSNAME}>
          <Boxes className="size-4 shrink-0" />
          <span className="truncate">Existencias</span>
        </TabsTab>
        <TabsTab value="alerts" className={TAB_CLASSNAME}>
          <TriangleAlert className="size-4 shrink-0" />
          <span className="truncate">Alertas de stock{alertsCount ? ` (${alertsCount})` : ''}</span>
        </TabsTab>
        <TabsTab value="batches" className={TAB_CLASSNAME}>
          <Layers3 className="size-4 shrink-0" />
          <span className="truncate">Lotes</span>
        </TabsTab>
        <TabsTab value="waste" className={TAB_CLASSNAME}>
          <PackageMinus className="size-4 shrink-0" />
          <span className="truncate">Mermas</span>
        </TabsTab>
      </TabsList>
    </Tabs>
  )
}
