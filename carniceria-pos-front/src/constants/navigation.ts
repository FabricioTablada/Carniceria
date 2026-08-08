import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  KeyRound,
  Package,
  Tags,
  Percent,
  BadgePercent,
  Building2,
  UserRound,
  ShoppingCart,
  Truck,
  Boxes,
  Wallet,
  BarChart3,
  Settings,
} from 'lucide-react'
import { PERMISSIONS, type Permission } from './permissions'

/**
 * Secciones visuales del sidebar del Backoffice (`Sidebar.tsx`), en el
 * orden en que se muestran. Unica lista de secciones del sistema: cada
 * `NavItem` declara la suya (`section`, campo obligatorio) en vez de que
 * `Sidebar.tsx` mantenga su propia lista de `paths` por seccion — asi un
 * modulo nuevo agregado a `NAV_ITEMS` sin `section` es un error de
 * compilacion (campo requerido), no un item que queda oculto en silencio
 * por haber olvidado actualizar una segunda lista (causa raiz del bug de
 * "Promociones" ausente del sidebar).
 */
export const NAV_SECTION_ORDER = [
  'General',
  'Operación',
  'Catálogo e inventario',
  'Administración',
  'Sistema',
] as const

export type NavSection = (typeof NAV_SECTION_ORDER)[number]

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** null = visible para cualquier usuario autenticado, sin chequeo de permiso. */
  permission: Permission | null
  /**
   * Si es false, el item se muestra (sujeto a permiso) pero no navega:
   * su ruta todavia no existe en `routes/index.tsx`.
   */
  enabled: boolean
  /** Seccion del sidebar donde se agrupa este item — ver `NAV_SECTION_ORDER`. */
  section: NavSection
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    permission: PERMISSIONS.REPORTS_VIEW,
    enabled: true,
    section: 'General',
  },
  {
    label: 'Usuarios',
    path: '/users',
    icon: Users,
    permission: PERMISSIONS.USERS_MANAGE,
    enabled: true,
    section: 'Administración',
  },
  {
    label: 'Roles',
    path: '/roles',
    icon: ShieldCheck,
    permission: PERMISSIONS.ROLES_MANAGE,
    enabled: true,
    section: 'Administración',
  },
  {
    label: 'Permisos',
    path: '/permissions',
    icon: KeyRound,
    // Mismo permiso que 'Roles': el backend siembra un unico codigo
    // 'roles.manage' ('Administrar roles y permisos', prisma/seed.ts) que
    // cubre ambas areas — no existe un codigo 'permissions.manage' separado.
    permission: PERMISSIONS.ROLES_MANAGE,
    enabled: true,
    section: 'Administración',
  },
  {
    label: 'Productos',
    path: '/products',
    icon: Package,
    permission: PERMISSIONS.PRODUCTS_VIEW,
    enabled: true,
    section: 'Catálogo e inventario',
  },
  {
    label: 'Categorías',
    path: '/categories',
    icon: Tags,
    permission: PERMISSIONS.CATEGORIES_VIEW,
    enabled: true,
    section: 'Catálogo e inventario',
  },
  {
    label: 'Impuestos',
    path: '/taxes',
    icon: Percent,
    permission: PERMISSIONS.TAXES_VIEW,
    enabled: true,
    section: 'Catálogo e inventario',
  },
  {
    label: 'Promociones',
    path: '/promotions',
    icon: BadgePercent,
    permission: PERMISSIONS.PROMOTIONS_VIEW,
    enabled: true,
    section: 'Catálogo e inventario',
  },
  {
    label: 'Proveedores',
    path: '/suppliers',
    icon: Building2,
    permission: PERMISSIONS.SUPPLIERS_VIEW,
    enabled: true,
    section: 'Catálogo e inventario',
  },
  {
    label: 'Clientes',
    path: '/customers',
    icon: UserRound,
    permission: PERMISSIONS.CUSTOMERS_VIEW,
    enabled: true,
    section: 'Catálogo e inventario',
  },
  {
    label: 'Ventas',
    path: '/sales',
    icon: ShoppingCart,
    permission: PERMISSIONS.SALES_VIEW,
    enabled: true,
    section: 'Operación',
  },
  {
    label: 'Compras',
    path: '/purchases',
    icon: Truck,
    permission: PERMISSIONS.PURCHASES_VIEW,
    enabled: true,
    section: 'Operación',
  },
  {
    label: 'Inventario',
    path: '/inventory',
    icon: Boxes,
    permission: PERMISSIONS.INVENTORY_VIEW,
    enabled: true,
    section: 'Catálogo e inventario',
  },
  {
    label: 'Caja',
    path: '/cash-session/open',
    icon: Wallet,
    permission: PERMISSIONS.CASH_OPEN,
    enabled: true,
    section: 'Operación',
  },
  {
    label: 'Reportes',
    path: '/reports',
    icon: BarChart3,
    permission: PERMISSIONS.REPORTS_VIEW,
    enabled: true,
    section: 'Sistema',
  },
  {
    label: 'Configuración',
    path: '/settings',
    icon: Settings,
    permission: PERMISSIONS.SETTINGS_MANAGE,
    enabled: true,
    section: 'Sistema',
  },
]

/**
 * Ruta a la que debe ir un usuario recien autenticado (o que navega a `/`
 * sin permiso de Dashboard): si tiene `reports.view`, el Dashboard; si no,
 * el primer modulo habilitado de `NAV_ITEMS` (en el mismo orden en que se
 * muestran en el Sidebar) al que su permiso le da acceso. Evita que el
 * Dashboard dispare sus queries (`reports.view`/`purchases.view`) contra un
 * usuario sin acceso, que es lo que generaba multiples 403 justo despues
 * del login.
 */
export function getDefaultRoute(permissions: Permission[]): string {
  if (permissions.includes(PERMISSIONS.REPORTS_VIEW)) {
    return '/'
  }

  const firstAvailable = NAV_ITEMS.find(
    (item) =>
      item.path !== '/' &&
      item.enabled &&
      (item.permission === null || permissions.includes(item.permission)),
  )

  return firstAvailable?.path ?? '/'
}
