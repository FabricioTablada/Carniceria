import { Button } from './button'
import { cn } from '@/lib/utils'
import type { PaginationMeta } from '@/hooks/usePagination'

/**
 * components/ui/Pagination.tsx
 * -----------------------------------------------------------------------------
 * Arquitectura de listados, Bloque 1: componente unico y completamente
 * generico de controles de paginacion, para ser reutilizado por CUALQUIER
 * listado del ERP (productos, categorias, promociones, proveedores,
 * inventario, etc.) — no existe ni debe existir una variante por modulo.
 *
 * Sin este componente, cada pagina que necesitaba paginacion real la
 * reimplementaba a mano (`ProductsPage.tsx`, `InventoryWastesPage.tsx`):
 * mismo texto "Página X de Y — N registros", mismos dos botones
 * Anterior/Siguiente leyendo `meta.hasPrev`/`meta.hasNext`. Este componente
 * reemplazara esa duplicacion en bloques futuros; en este bloque no se
 * conecta todavia a ninguna pagina existente.
 *
 * `meta` es siempre la respuesta literal del backend (`page`, `limit`,
 * `total`, `totalPages`, `hasNext`, `hasPrev` — identica en los 18 modulos
 * paginados, ver `shared/utils/pagination.ts` del backend). El componente
 * nunca recalcula esos valores por su cuenta: con catalogos de miles de
 * registros, la unica fuente confiable de "cuantas paginas hay realmente"
 * es el servidor, nunca una cuenta derivada en el cliente.
 *
 * Ventana de numeros de pagina: pensado explicitamente para catalogos
 * grandes (5 000, 20 000+ registros => cientos o miles de paginas). Nunca
 * renderiza un boton por cada pagina — eso seria inutilizable e incluso
 * pesado de renderizar con miles de paginas. En su lugar muestra siempre la
 * primera y la ultima pagina, mas un rango pequeño alrededor de la pagina
 * actual, con "…" para los huecos — el mismo patron de paginacion usado en
 * cualquier listado grande (ej. resultados de busqueda). Con pocas paginas
 * (el caso de hoy, ej. Productos con ~6 paginas) esto termina mostrando
 * simplemente todos los numeros, sin huecos.
 */
interface PaginationProps {
  /** Metadatos de paginacion tal como los devuelve el backend. */
  meta: PaginationMeta
  /** Se invoca con el numero de pagina destino al hacer clic en Anterior,
   * Siguiente, o un numero de pagina especifico. Quien consume el
   * componente decide como aplicar ese cambio (ej. `usePagination().setPage`). */
  onPageChange: (page: number) => void
  /** Sustantivo mostrado junto al total (ej. "productos", "categorías").
   * Por defecto "registros" — deliberadamente generico, ningun modulo
   * necesita un componente propio solo para cambiar esta palabra. */
  itemLabel?: string
  className?: string
}

const PAGE_WINDOW_RADIUS = 1

function getPageWindow(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  const pagesToShow = new Set<number>([1, totalPages])

  for (let page = currentPage - PAGE_WINDOW_RADIUS; page <= currentPage + PAGE_WINDOW_RADIUS; page++) {
    if (page >= 1 && page <= totalPages) {
      pagesToShow.add(page)
    }
  }

  const sortedPages = Array.from(pagesToShow).sort((a, b) => a - b)
  const window: (number | 'ellipsis')[] = []
  let previousPage: number | null = null

  for (const page of sortedPages) {
    if (previousPage !== null && page - previousPage > 1) {
      window.push('ellipsis')
    }
    window.push(page)
    previousPage = page
  }

  return window
}

export function Pagination({ meta, onPageChange, itemLabel = 'registros', className }: PaginationProps) {
  const { page, total, totalPages, hasNext, hasPrev } = meta
  const pageWindow = totalPages > 1 ? getPageWindow(page, totalPages) : []

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        Página {page} de {totalPages} — {total} {itemLabel}
      </p>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>

        {pageWindow.length > 0 && (
          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-sm text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === page ? 'default' : 'outline'}
                  size="sm"
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              ),
            )}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
