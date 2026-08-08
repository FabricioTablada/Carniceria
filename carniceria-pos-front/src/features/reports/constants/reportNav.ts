import {
  Boxes,
  PieChart,
  ShoppingCart,
  Trophy,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/**
 * features/reports/constants/reportNav.ts
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado): fuente única de los 9 reportes existentes
 * — antes vivía como un arreglo local dentro de `ReportsIndexPage.tsx`
 * (`REPORTS`), ahora se extrae para reutilizarse en 2 lugares más sin
 * duplicar la lista: la navegación agrupada del propio índice y la franja
 * "Reportes relacionados" que cada página de reporte agrega al final
 * (mismo grupo temático, sin la página actual). Mismos 9 destinos, mismas
 * rutas, mismo texto que ya existía — `group` es el único dato nuevo
 * (puramente de presentación, para agrupar visualmente).
 */
export type ReportGroup = 'sales' | 'operations' | 'finance'

export interface ReportNavItem {
  id: string
  title: string
  description: string
  path: string
  icon: LucideIcon
  group: ReportGroup
}

export const REPORT_GROUP_LABELS: Record<ReportGroup, string> = {
  sales: 'Ventas',
  operations: 'Operación',
  finance: 'Finanzas',
}

export const REPORT_NAV_ITEMS: ReportNavItem[] = [
  {
    id: 'sales',
    title: 'Reporte de ventas',
    description: 'Detalle de las ventas completadas registradas en el sistema.',
    path: '/reports/sales',
    icon: ShoppingCart,
    group: 'sales',
  },
  {
    id: 'sales-by-category',
    title: 'Ventas por categoría',
    description: 'Cantidad e importe vendido, agrupado por categoría de producto.',
    path: '/reports/sales-by-category',
    icon: PieChart,
    group: 'sales',
  },
  {
    id: 'sales-by-cashier',
    title: 'Ventas por cajero',
    description: 'Cantidad de ventas, importe vendido y ticket promedio por cajero.',
    path: '/reports/sales-by-cashier',
    icon: Users,
    group: 'sales',
  },
  {
    id: 'top-products',
    title: 'Productos más vendidos',
    description: 'Ranking de productos por cantidad e importe vendido.',
    path: '/reports/top-products',
    icon: Trophy,
    group: 'sales',
  },
  {
    id: 'purchases',
    title: 'Reporte de compras',
    description: 'Detalle de las compras registradas en el sistema.',
    path: '/reports/purchases',
    icon: Truck,
    group: 'operations',
  },
  {
    id: 'inventory',
    title: 'Reporte de inventario',
    description: 'Existencias de productos por sucursal registradas en el sistema.',
    path: '/reports/inventory',
    icon: Boxes,
    group: 'operations',
  },
  {
    id: 'low-stock',
    title: 'Bajo inventario',
    description: 'Productos cuya existencia está en o por debajo de su punto de reorden.',
    path: '/reports/low-stock',
    icon: TriangleAlert,
    group: 'operations',
  },
  {
    id: 'profit',
    title: 'Reporte de utilidad',
    description: 'Detalle de costo y precio por línea de venta registrada en el sistema.',
    path: '/reports/profit',
    icon: TrendingUp,
    group: 'finance',
  },
  {
    // Wireframe aprobado "Caja — Centro de Control": Caja
    // (`/cash-session/open`) es ahora la única fuente de verdad para
    // sesiones de caja — este tile del Centro de Análisis sigue existiendo
    // (sigue siendo un dato de interés financiero), pero apunta
    // directamente ahí en vez de a una pantalla propia de Reportes.
    id: 'cash',
    title: 'Historial de caja',
    description: 'Sesiones de caja registradas en el sistema.',
    path: '/cash-session/open',
    icon: Wallet,
    group: 'finance',
  },
]
