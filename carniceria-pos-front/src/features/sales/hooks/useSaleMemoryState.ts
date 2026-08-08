import { useState } from 'react'
import { usePagination, type UsePaginationResult } from '@/hooks/usePagination'

/**
 * features/sales/hooks/useSaleMemoryState.ts
 * -----------------------------------------------------------------------------
 * Ventas (aprobado, "mantener memoria de filtros/página mientras el
 * usuario permanezca en Ventas — seguir exactamente el patrón implementado
 * en Reportes"): mismo mecanismo EXACTO que
 * `features/reports/hooks/useReportMemoryState.ts` — un `Map` a nivel de
 * módulo (no un store de Zustand nuevo, no `localStorage`: desaparece con
 * un F5, igual que cualquier estado de React) que sobrevive a que
 * `SalesPage.tsx` se desmonte al navegar a otra ruta (POS, Reportes, etc.)
 * y se remonte al volver.
 *
 * Se duplica como archivo propio de este módulo (en vez de importar el de
 * `features/reports`) para no crear un acoplamiento entre dos features de
 * dominio distinto por una utilidad de 15 líneas sin lógica de negocio —
 * mismo criterio de independencia de módulos ya usado en el resto del
 * proyecto (cada feature tiene sus propios hooks, sin depender de los
 * internos de otro salvo datos de dominio compartido real, ej.
 * `useCashReportDetail`).
 */
const memory = new Map<string, unknown>()

export function useSaleMemoryState<T>(key: string, initial: T | (() => T)): [T, (value: T) => void] {
  const [value, setValueState] = useState<T>(() =>
    memory.has(key) ? (memory.get(key) as T) : initial instanceof Function ? initial() : initial,
  )

  const setValue = (next: T) => {
    memory.set(key, next)
    setValueState(next)
  }

  return [value, setValue]
}

/** Misma memoria de arriba, aplicada a `usePagination` (Arquitectura de
 * listados, Bloque 1 — ya existente, sin tocar). */
export function useSaleMemoryPagination(key: string): UsePaginationResult {
  const initialPage = memory.has(key) ? (memory.get(key) as number) : 1
  const pagination = usePagination({ initialPage })

  const setPage = (next: number) => {
    const clamped = Math.max(1, next)
    memory.set(key, clamped)
    pagination.setPage(clamped)
  }

  const resetPage = () => {
    memory.set(key, 1)
    pagination.resetPage()
  }

  return { ...pagination, setPage, resetPage }
}
