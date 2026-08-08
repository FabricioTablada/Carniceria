import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PillOption {
  value: string
  label: string
}

interface PillGroupProps {
  options: PillOption[]
  value: string
  onChange: (value: string) => void
}

/** Debe coincidir con el `gap-2.5` real de la fila (0.625rem = 10px con el
 * `rem` base del proyecto) — usado para el calculo de cuantas pildoras
 * entran por grupo. */
const PILL_GAP_PX = 10

/** Espacio reservado por flecha (boton `size-8` = 32px + separacion de
 * 8px hasta la primera/ultima pildora) — 40px, EXACTAMENTE el mismo valor
 * que el padding `pl-10`/`pr-10` (40px) aplicado a la fila visible, para
 * que el ancho que se usa en el calculo sea el mismo que el ancho
 * realmente disponible una vez reservado el espacio de las flechas. */
const ARROW_RESERVED_PX = 40

function pillClassName(active: boolean) {
  return active
    ? 'h-8 shrink-0 touch-manipulation rounded-full bg-brand px-3 text-sm font-bold text-brand-foreground shadow-[0_8px_18px_-8px_var(--brand)]'
    : 'h-8 shrink-0 touch-manipulation rounded-full border border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 text-sm font-semibold text-[var(--pos-ink-muted)] transition-colors hover:border-brand/30 hover:bg-brand/5 hover:text-[var(--pos-ink)]'
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={pillClassName(active)}>
      {label}
    </button>
  )
}

function ScrollArrow({
  direction,
  onClick,
}: {
  direction: 'left' | 'right'
  onClick: () => void
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'left' ? 'Ver categorías anteriores' : 'Ver más categorías'}
      className={cn(
        'absolute top-1/2 z-10 flex size-8 shrink-0 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--pos-border)] bg-[var(--pos-panel)] text-[var(--pos-ink-muted)] shadow-sm transition-colors hover:bg-brand/10 hover:text-brand',
        direction === 'left' ? 'left-0' : 'right-0',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

/** Agrupa indices de opcion en "paginas" que entran completas en
 * `availableWidth` — cada pagina aprovecha el maximo de pildoras
 * completas posible, nunca corta una a la mitad: si la siguiente no
 * entra completa, empieza una pagina nueva. */
function buildPages(widths: number[], availableWidth: number): number[][] {
  const pages: number[][] = []
  let current: number[] = []
  let currentWidth = 0

  widths.forEach((width, index) => {
    const widthWithThis = current.length === 0 ? width : currentWidth + PILL_GAP_PX + width

    if (widthWithThis > availableWidth && current.length > 0) {
      pages.push(current)
      current = [index]
      currentWidth = width
    } else {
      current.push(index)
      currentWidth = widthWithThis
    }
  })

  if (current.length > 0) {
    pages.push(current)
  }

  return pages.length > 0 ? pages : [[]]
}

/**
 * components/ui/PillGroup.tsx
 * -----------------------------------------------------------------------------
 * Selector exclusivo en fila horizontal, controlado (sin estado interno de
 * seleccion). API publica SIN CAMBIOS (`options`/`value`/`onChange`) desde
 * el Bloque 9 original — todo lo de aca es interno.
 *
 * Carrusel por paginas (aprobado, reemplaza el scroll continuo original):
 *  - Una fila oculta (`invisible`, fuera de flujo mediante `absolute`,
 *    medida con el estilo ACTIVO/`font-bold` — el mas ancho de los dos
 *    posibles, para nunca subestimar cuanto ocupa una pildora) mide el
 *    ancho real de cada pildora con la misma tipografia/padding que se va
 *    a mostrar.
 *  - `buildPages` arma "paginas": cada una son las pildoras completas que
 *    entran en el ancho disponible — nunca una pildora a medias, y
 *    siempre el maximo posible por pagina (greedy, de izquierda a
 *    derecha).
 *  - El ancho disponible se mide sobre `measureContainerRef`, el
 *    contenedor EXTERIOR — nunca cambia de tamaño por la aparicion o
 *    desaparicion de flechas (las flechas son overlays `absolute`, fuera
 *    del flujo, no le quitan espacio). Esto es deliberado: en una version
 *    anterior se medía un contenedor cuyo ancho SÍ cambiaba segun había o
 *    no flechas (margen condicional), lo que disparaba el
 *    `ResizeObserver` en cada cambio de pagina y producia un bucle que
 *    aprovechaba menos ancho del real y hacia que la flecha derecha
 *    pareciera "no navegar" (el recalculo posterior a cada click volvia a
 *    saltar a la pagina de la categoria seleccionada).
 *  - Si con TODO el ancho disponible ya entran todas en una sola pagina,
 *    no hacen falta flechas — se usa ese ancho completo, sin reservar
 *    espacio de mas. Si no entran, se recalcula con el ancho disponible
 *    MENOS el espacio de las 2 flechas (`ARROW_RESERVED_PX` por lado) y la
 *    fila visible gana el mismo padding (`pl-10`/`pr-10`) SOLO del lado
 *    donde hay flecha, para que ninguna pildora quede tapada.
 *  - Cada flecha avanza/retrocede exactamente UN grupo completo
 *    (`currentPage +/- 1`); se muestran/ocultan segun exista o no un
 *    grupo anterior/posterior (`currentPage > 0` / `currentPage < ultima`).
 *  - Un `ResizeObserver` sobre el contenedor exterior (estable) recalcula
 *    los grupos cuando cambia el ancho real disponible (ventana angosta,
 *    panel derecho "Expandido").
 *  - Al cambiar `value`, se salta automaticamente al grupo que contiene
 *    esa categoria — la seleccionada siempre queda visible.
 *
 * Pulido visual (aprobado, unico consumidor: `SalesPOSPage.tsx`): pildoras
 * mas bajas (`h-10` -> `h-9`) y mejor separadas (`gap-2` -> `gap-2.5`),
 * estado activo mas elegante (sombra tintada de marca en vez de
 * `shadow-sm` generico) y tokens exclusivos del POS (`--pos-*`) en vez de
 * `bg-card`/`text-muted-foreground` (compartidos con el Backoffice).
 *
 * Rediseño del POS (aprobado, "reducir ligeramente la altura de la fila de
 * categorías"): `h-9` -> `h-8`, mismo padding horizontal reducido en
 * proporción (`px-4` -> `px-3.5`) — solo aprovechamiento de espacio, mismo
 * comportamiento/props de siempre.
 *
 * Pulido visual final del POS (aprobado, "aprovechar completamente el
 * ancho — que entren más categorías por fila"): `px-3.5` -> `px-3` (mismo
 * padding en la fila de medición, así que `buildPages` sigue calculando
 * sobre el ancho real) y la separación VISIBLE entre píldoras baja de
 * `gap-1.5` a `gap-1` — la estimación usada para paginar (`PILL_GAP_PX`,
 * ligada al `gap-2.5` de la fila de medición) no se toca, así que esto
 * solo agrega margen de seguridad extra, nunca desborda. El botón de
 * desplazamiento y el hueco antes de él ya se mostraban únicamente cuando
 * hace falta (`canGoBack`/`canGoForward`, sin cambios en este bloque).
 */
export function PillGroup({ options, value, onChange }: PillGroupProps) {
  const measureContainerRef = useRef<HTMLDivElement>(null)
  const measureRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pages, setPages] = useState<number[][]>(() => [options.map((_, index) => index)])
  const [currentPage, setCurrentPage] = useState(0)

  // Mantiene visible la categoria seleccionada saltando al grupo que la
  // contiene. Ajuste de estado durante el render (no en un efecto): evita
  // el render en cascada que dispara `setState` sincrono dentro de un
  // efecto — mismo patron ya usado en otros puntos del modulo POS.
  const [trackedSelection, setTrackedSelection] = useState({ value, pages })
  if (trackedSelection.value !== value || trackedSelection.pages !== pages) {
    setTrackedSelection({ value, pages })

    const optionIndex = options.findIndex((option) => option.value === value)
    if (optionIndex !== -1) {
      const pageIndex = pages.findIndex((page) => page.includes(optionIndex))
      if (pageIndex !== -1 && pageIndex !== currentPage) {
        setCurrentPage(pageIndex)
      }
    }
  }

  // Mide anchos reales + arma los grupos. `useLayoutEffect` (no
  // `useEffect`): corre antes de que el navegador pinte, para no mostrar
  // un instante "todas en una fila" y despues saltar a paginado. Observa
  // el contenedor EXTERIOR (estable, ver comentario de la funcion) — asi
  // los clicks de flecha (que solo cambian `currentPage`, no el tamaño
  // real de nada) nunca disparan una remedicion.
  useLayoutEffect(() => {
    const container = measureContainerRef.current
    if (!container || options.length === 0) {
      return
    }

    const measure = () => {
      const widths = measureRefs.current.map((el) => el?.offsetWidth ?? 0)
      if (widths.some((width) => width === 0)) {
        return
      }

      const fullWidth = container.clientWidth
      const singlePage = buildPages(widths, fullWidth)

      const nextPages =
        singlePage.length <= 1 ? singlePage : buildPages(widths, fullWidth - ARROW_RESERVED_PX * 2)

      setPages(nextPages)
      setCurrentPage((page) => Math.min(page, Math.max(nextPages.length - 1, 0)))
    }

    measure()

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [options])

  const hasMultiplePages = pages.length > 1
  const canGoBack = hasMultiplePages && currentPage > 0
  const canGoForward = hasMultiplePages && currentPage < pages.length - 1
  const visibleIndices = pages[currentPage] ?? []

  return (
    <div ref={measureContainerRef} className="relative flex items-center">
      {/* Fila de medicion: mismo tipografia/padding que las pildoras
          reales (estilo activo, el mas ancho), fuera de flujo visual —
          nunca se ve, solo aporta `offsetWidth` real por pildora. No
          afecta el ancho de `measureContainerRef` (position absolute). */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex w-max flex-nowrap items-center gap-2.5"
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(el) => {
              measureRefs.current[index] = el
            }}
            className={pillClassName(true)}
            tabIndex={-1}
          >
            {option.label}
          </button>
        ))}
      </div>

      {canGoBack && <ScrollArrow direction="left" onClick={() => setCurrentPage((page) => page - 1)} />}

      {/* El padding reserva el espacio visual de las flechas SOLO del
          lado donde hay una — no afecta el ancho de `measureContainerRef`
          (ese es el padre, position relative, ancho fijo). */}
      <div className={cn('min-w-0 flex-1 overflow-hidden', canGoBack && 'pl-10', canGoForward && 'pr-10')}>
        <div className="flex flex-nowrap items-center gap-1">
          {visibleIndices.map((index) => {
            const option = options[index]

            return (
              <Pill
                key={option.value}
                label={option.label}
                active={option.value === value}
                onClick={() => onChange(option.value)}
              />
            )
          })}
        </div>
      </div>

      {canGoForward && <ScrollArrow direction="right" onClick={() => setCurrentPage((page) => page + 1)} />}
    </div>
  )
}
