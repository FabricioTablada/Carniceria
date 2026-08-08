/**
 * utils/permissionModule.ts
 * -----------------------------------------------------------------------------
 * Deriva el "módulo" de un código de permiso (`products.create` -> `products`)
 * a partir de la convención `modulo.accion` ya usada en
 * `constants/permissions.ts`. El backend NO tiene un campo de módulo real en
 * `Permission` (solo `code`/`description`) — esto es puramente una lectura de
 * la convención de nomenclatura ya existente, no un dato nuevo ni un cambio
 * de contrato.
 *
 * Compartido entre `features/permissions/components/PermissionTable.tsx`
 * (listado agrupado) y `features/roles/components/RolePermissionSelector.tsx`
 * (selector de permisos de un rol) — ambos necesitan el mismo criterio de
 * agrupamiento/orden/búsqueda, así que vive en `utils/` en vez de duplicarse
 * en cada feature (mismo criterio que `stockStatus.ts`).
 */

const MODULE_LABELS: Record<string, string> = {
  products: 'Productos',
  categories: 'Categorías',
  taxes: 'Impuestos',
  promotions: 'Promociones',
  suppliers: 'Proveedores',
  customers: 'Clientes',
  sales: 'Ventas',
  returns: 'Devoluciones',
  purchases: 'Compras',
  inventory: 'Inventario',
  batches: 'Lotes',
  cash: 'Caja',
  'cash-movements': 'Movimientos de caja',
  'cash-registers': 'Cajas registradoras',
  users: 'Usuarios',
  roles: 'Roles',
  settings: 'Configuración',
  reports: 'Reportes',
}

/** Prefijo antes del primer punto (`sales.void` -> `sales`). Si el código
 * no tiene punto, se devuelve tal cual. */
export function getPermissionModuleKey(code: string): string {
  const separatorIndex = code.indexOf('.')
  return separatorIndex === -1 ? code : code.slice(0, separatorIndex)
}

/** Resto del código luego del primer punto (`sales.void` -> `void`). */
export function getPermissionAction(code: string): string {
  const separatorIndex = code.indexOf('.')
  return separatorIndex === -1 ? code : code.slice(separatorIndex + 1)
}

/** Nombre legible del módulo. Si el backend agrega un módulo que todavía no
 * está en `MODULE_LABELS`, devuelve el prefijo capitalizado en vez de
 * mostrar el código crudo o romper — mismo criterio "degradación sin
 * romper" que el resto de los mapeos de catálogo del proyecto. */
export function formatPermissionModuleLabel(moduleKey: string): string {
  const known = MODULE_LABELS[moduleKey]
  if (known) {
    return known
  }

  return moduleKey
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export interface PermissionModuleGroup<T> {
  moduleKey: string
  label: string
  items: T[]
}

/**
 * Agrupa `items` por módulo derivado de `code` y ordena tanto los GRUPOS
 * (alfabéticamente por `label`) como los permisos DENTRO de cada grupo (por
 * acción: `products.create` antes que `products.view`). Ordenar los grupos
 * por `label` en vez de por orden de aparición en `items` es deliberado:
 * el orden en que el backend devuelve el catálogo (`GET /permissions`) no
 * tiene un `ORDER BY` explícito garantizado, así que depender del orden de
 * llegada podría producir un agrupamiento distinto entre una carga y otra
 * — ordenar por `label` es determinístico sin importar el orden de origen.
 */
export function groupPermissionsByModule<T extends { code: string }>(
  items: T[],
): PermissionModuleGroup<T>[] {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const moduleKey = getPermissionModuleKey(item.code)
    const existing = groups.get(moduleKey)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(moduleKey, [item])
    }
  }

  return Array.from(groups.entries())
    .map(([moduleKey, groupItems]) => ({
      moduleKey,
      label: formatPermissionModuleLabel(moduleKey),
      items: [...groupItems].sort((a, b) =>
        getPermissionAction(a.code).localeCompare(getPermissionAction(b.code)),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

/** Coincidencia de búsqueda por código, descripción o módulo derivado —
 * usada tanto en el listado de Permisos como en el buscador interno de
 * `RolePermissionSelector`. */
export function matchesPermissionSearch(
  item: { code: string; description?: string | null },
  search: string,
): boolean {
  const term = search.trim().toLowerCase()
  if (!term) {
    return true
  }

  const moduleLabel = formatPermissionModuleLabel(getPermissionModuleKey(item.code)).toLowerCase()

  return (
    item.code.toLowerCase().includes(term) ||
    (item.description ?? '').toLowerCase().includes(term) ||
    moduleLabel.includes(term)
  )
}
