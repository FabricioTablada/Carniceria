import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS, NAV_SECTION_ORDER, type NavItem } from '@/constants/navigation'
import { usePermissions } from '@/hooks/usePermissions'

/** Rediseño de layout (aprobado): recuerda el estado colapsado/expandido
 * entre sesiones — mismo criterio "sin store nuevo" que el resto del
 * proyecto (solo dos stores de Zustand existen, ninguno para esto);
 * `localStorage` alcanza para una preferencia puramente de UI. */
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'backoffice-sidebar-collapsed'

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
  return stored === null ? true : stored === 'true'
}

/**
 * components/common/Sidebar.tsx
 * -----------------------------------------------------------------------------
 * Sidebar del Backoffice (Dashboard/modulos administrativos), usado
 * exclusivamente por `DashboardLayout.tsx` — verificado, ningun otro
 * consumidor.
 *
 * Rediseño de layout (aprobado): sidebar ultracompacto con toggle manual
 * (boton tipo hamburguesa, sin expansion por hover — a diferencia de
 * `PosSidebar.tsx`, a pedido explicito), que recuerda su estado entre
 * sesiones (`localStorage`). Se reutiliza el MECANISMO de
 * `PosSidebar.tsx` (ancho colapsado/expandido, ocultar etiquetas por
 * completo en vez de atenuarlas, `title` nativo como tooltip).
 *
 * Pulido visual final (aprobado, "misma calidad y lenguaje que el POS"):
 * la superficie oscura propia (`bg-sidebar`, rojo-marron, logo Pipasa en
 * un bloque blanco) se descarta a favor de la MISMA identidad clara y
 * minimalista ya aprobada para el POS — pero usando los tokens genericos
 * del Design System (`bg-card`/`border-border`/`text-foreground`/
 * `text-muted-foreground`/`bg-brand`), no los tokens `--pos-*` (esos son
 * exclusivos de `.pos-surface`, sin efecto fuera del POS). El bloque
 * grande de logo se elimina por completo (misma decision ya tomada en
 * `PosSidebar.tsx`: "el riel inicia directamente con las acciones") — el
 * toggle de colapsar/expandir (unica pieza de UI que el POS no tiene,
 * comportamiento ya aprobado y sin cambios) queda como un boton suelto,
 * sin bloque/tarjeta propia, para no reintroducir la sensacion de
 * "encabezado comprimido". Jerarquia visual, tamaños de icono, paddings y
 * el estado activo (pastilla solida) copian 1:1 los valores ya usados en
 * `PosSidebar.tsx`, solo cambiando la fuente de color (`--brand` en vez de
 * marca sobre superficie oscura).
 *
 * `--sidebar`/`--sidebar-active`/etc. (tokens de color especificos del
 * Backoffice oscuro) quedan sin consumidores tras este bloque y se
 * retiran de `index.css` — no hay ninguna otra pantalla que dependa de
 * ellos (verificado por busqueda).
 *
 * Separador entre grupos cuando esta colapsado: el Backoffice tiene 5
 * secciones (`NAV_SECTION_ORDER`) contra 2-3 en el POS — sin ninguna
 * senal de agrupacion, los iconos seguidos perderian toda estructura
 * visual. Una linea divisoria sutil reemplaza al texto del encabezado de
 * seccion solo cuando esta colapsado.
 *
 * Sin cambios: agrupacion por `NAV_SECTION_ORDER`/`NavItem.section`,
 * filtro por permisos via `usePermissions().hasPermission` (misma fuente
 * de verdad que `Can.tsx`), panel "hundido" del grupo Administracion
 * (recoloreado a claro, mismo criterio visual).
 *
 * Ajuste final (aprobado, "sin scroll interno, mas liviano colapsado"):
 * iconos/filas/paddings reducidos (size-10→size-8, size-8→size-7 en el
 * subgrupo denso de Administracion, `py-2.5`→`py-1.5`/`py-1`) y espacio
 * entre grupos comprimido (`gap-6`→`gap-4`) para que las 5 secciones
 * completas entren sin `overflow-y-auto` real en una pantalla estandar —
 * `overflow-y-auto` se mantiene en `<nav>` solo como red de seguridad
 * (viewports muy bajos), no como comportamiento esperado.
 *
 * Ultimo pulido (aprobado, "equilibrio vertical, colapsado mas ligero"):
 * `<nav>` gana `justify-between` — con `gap-4` como separacion MINIMA
 * entre grupos, el espacio sobrante (cuando el contenido es mas bajo que
 * el alto disponible, el caso normal ahora que todo entra sin scroll) se
 * reparte de forma pareja entre los 5 grupos en vez de acumularse como un
 * hueco vacio al final — el riel ya no "termina antes" del borde inferior
 * de `<main>`, sin necesidad de una altura fija ni de un `flex-1`
 * artificial por grupo. Iconos del riel colapsado (icon-only, sin label
 * que equilibre el peso visual de la fila) bajan un escalon mas que los
 * del riel expandido — mismo criterio ya aplicado entre `dense`/no-dense,
 * ahora tambien entre colapsado/expandido. Estado activo colapsado:
 * gana un halo suave (`bg-brand/10` en toda la fila, mismo tono que el
 * hover) detras del chip solido del icono — ya no es un icono "flotando"
 * sin contexto de fila, pero tampoco vuelve al bloque solido de ancho
 * completo del POS (criterio ya aprobado: "liviano, sin bloques
 * pesados"), balance entre ambos.
 */
export function Sidebar() {
  const { hasPermission } = usePermissions()
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
  }, [collapsed])

  const isItemVisible = (item: NavItem) =>
    !item.permission || hasPermission(item.permission)

  const renderNavItem = (item: NavItem, dense = false) => {
    const itemContent = item.enabled ? (
      <NavLink
        to={item.path}
        end={item.path === '/sales'}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'group flex items-center gap-2.5 rounded-xl transition-all duration-200 ease-out',
            collapsed
              ? 'justify-center px-0 py-1.5'
              : cn('px-2.5', dense ? 'py-1' : 'py-1.5'),
            dense ? 'text-[0.8125rem]' : 'text-[0.875rem]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-amber/50',
            isActive
              ? collapsed
                ? 'bg-brand/10 font-semibold'
                : 'bg-brand font-semibold text-brand-foreground shadow-[0_8px_20px_-8px_var(--brand)]'
              : 'font-medium text-muted-foreground hover:bg-brand/10 hover:text-foreground',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                dense ? (collapsed ? 'size-6' : 'size-7') : collapsed ? 'size-7' : 'size-8',
                isActive
                  ? collapsed
                    ? 'bg-brand shadow-[0_4px_10px_-4px_var(--brand)]'
                    : 'bg-brand-foreground/15'
                  : 'bg-muted group-hover:bg-brand/10',
              )}
            >
              <item.icon
                className={cn(
                  'shrink-0 transition-colors duration-200',
                  dense ? (collapsed ? 'size-3' : 'size-3.5') : collapsed ? 'size-3.5' : 'size-4',
                  isActive ? 'text-brand-foreground' : 'text-muted-foreground group-hover:text-brand',
                )}
              />
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        )}
      </NavLink>
    ) : (
      <span
        aria-disabled="true"
        title="Próximamente"
        className={cn(
          'flex cursor-not-allowed items-center gap-2.5 rounded-xl text-muted-foreground/40 select-none',
          collapsed ? 'justify-center px-0 py-1.5' : cn('px-2.5', dense ? 'py-1' : 'py-1.5'),
          dense ? 'text-[0.8125rem]' : 'text-[0.875rem]',
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg bg-muted/40',
            dense ? (collapsed ? 'size-6' : 'size-7') : collapsed ? 'size-7' : 'size-8',
          )}
        >
          <item.icon
            className={dense ? (collapsed ? 'size-3' : 'size-3.5') : collapsed ? 'size-3.5' : 'size-4'}
          />
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </span>
    )

    return <div key={item.path}>{itemContent}</div>
  }

  const visibleSections = NAV_SECTION_ORDER.filter((section) =>
    NAV_ITEMS.some((item) => item.section === section && isItemVisible(item)),
  )

  return (
    <aside
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-[0_18px_45px_-24px_rgba(0,0,0,0.2)] transition-[width] duration-200',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center pt-2 pb-0.5',
          collapsed ? 'justify-center px-2.5' : 'justify-end px-4',
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <nav
        className={cn(
          'flex min-h-0 flex-1 flex-col justify-between gap-4 overflow-y-auto pt-1 pb-2',
          collapsed ? 'px-2.5' : 'px-4',
        )}
      >
        {visibleSections.map((section, index) => {
          const items = NAV_ITEMS.filter(
            (item) => item.section === section && isItemVisible(item),
          )
          const isAdminSection = section === 'Administración'

          return (
            <div key={section} className="flex flex-col gap-0.5">
              {collapsed ? (
                index > 0 && <div className="mx-1 mb-1 h-px shrink-0 bg-border" />
              ) : (
                <p className="flex items-center gap-1.5 px-2.5 pb-1 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
                  <span
                    className={cn(
                      'h-2.5 w-0.5 shrink-0 rounded-full',
                      isAdminSection ? 'bg-border' : 'bg-brand/50',
                    )}
                  />
                  {section}
                </p>
              )}

              {isAdminSection ? (
                <div className="flex flex-col gap-0.5 rounded-xl bg-muted/60 p-1 shadow-[inset_0_2px_6px_-2px_rgba(0,0,0,0.06)]">
                  {items.map((item) => renderNavItem(item, true))}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => renderNavItem(item))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
