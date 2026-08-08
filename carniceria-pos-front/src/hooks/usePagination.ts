import { useCallback, useState } from 'react'

/**
 * hooks/usePagination.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de listados, Bloque 1: pieza generica de infraestructura, sin
 * logica de ningun modulo especifico. Administra unicamente cual es la
 * pagina solicitada — la misma responsabilidad que hoy `ProductsPage.tsx` e
 * `InventoryWastesPage.tsx` resuelven cada uno con su propio
 * `useState(1)` + `setPage((current) => current +/- 1)`. Este hook
 * reemplazara esa duplicacion en bloques futuros; en este bloque no se
 * conecta a ninguna pagina existente.
 *
 * Deliberadamente NO calcula ni conoce `totalPages`/`hasNext`/`hasPrev`: esos
 * valores son responsabilidad exclusiva del backend (`shared/utils/pagination.ts`
 * del lado servidor) y viajan en `meta` en cada respuesta paginada — la
 * unica fuente de verdad sobre cuantas paginas existen realmente. Con
 * catalogos de miles de registros, recalcular eso en el cliente a partir de
 * un `total` potencialmente desactualizado (por un `refetch` en curso, un
 * filtro cambiando, etc.) invitaria a que el estado del cliente y el del
 * servidor diverjan; el componente `Pagination` (`components/ui/Pagination.tsx`)
 * consume `meta` directamente por esta misma razon.
 *
 * `page` nunca baja de 1 — ni por `setPage` con un valor menor, ni por
 * `goToPreviousPage` en la primera pagina. No hay limite superior aca: igual
 * que hoy, corresponde a quien consume el hook decidir cuando dejar de
 * avanzar (en la practica, deshabilitando el control segun `meta.hasNext`,
 * nunca segun un tope arbitrario del cliente).
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface UsePaginationOptions {
  /** Pagina inicial y valor al que vuelve `resetPage()`. Por defecto 1. */
  initialPage?: number
}

export interface UsePaginationResult {
  /** Pagina actualmente solicitada (1-indexada). */
  page: number
  /** Salta a una pagina especifica (clampada a un minimo de 1). */
  setPage: (page: number) => void
  /** Avanza una pagina. Sin tope superior propio — el consumidor decide
   * cuando deshabilitar esto en base a `meta.hasNext`. */
  goToNextPage: () => void
  /** Retrocede una pagina, sin bajar de 1. */
  goToPreviousPage: () => void
  /** Vuelve a `initialPage`. Pensado para llamarse cuando cambian los
   * filtros del listado (una pagina 5 con un filtro nuevo casi seguro deja
   * de tener sentido), igual que ya hacen a mano `ProductsPage.tsx` e
   * `InventoryWastesPage.tsx`. */
  resetPage: () => void
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationResult {
  const { initialPage = 1 } = options
  const [page, setPageState] = useState(initialPage)

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, next))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageState((current) => current + 1)
  }, [])

  const goToPreviousPage = useCallback(() => {
    setPageState((current) => Math.max(1, current - 1))
  }, [])

  const resetPage = useCallback(() => {
    setPageState(initialPage)
  }, [initialPage])

  return { page, setPage, goToNextPage, goToPreviousPage, resetPage }
}
