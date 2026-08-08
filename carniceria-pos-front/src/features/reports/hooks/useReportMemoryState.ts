import { useState } from 'react'
import { usePagination, type UsePaginationResult } from '@/hooks/usePagination'

/**
 * features/reports/hooks/useReportMemoryState.ts
 * -----------------------------------------------------------------------------
 * Centro de Análisis (aprobado, "mantener filtros/página/orden mientras el
 * usuario permanezca en Reportes"): un `Map` a nivel de módulo (no un
 * store de Zustand nuevo — CLAUDE.md es explícito en que solo existen 2 en
 * todo el proyecto, ninguno de Reportes; no persiste en `localStorage`
 * tampoco, así que desaparece con un F5, igual que cualquier estado de
 * React) sobrevive a que el componente se desmonte al navegar a otra
 * página del SPA y se remonte al volver — exactamente el mismo criterio
 * que ya usan `useState` en cada `*Page.tsx` de Reportes, solo que la
 * semilla inicial se lee de este `Map` en vez de siempre partir en blanco.
 *
 * Reemplazo casi transparente de `useState`: mismo `[value, setValue]`,
 * mismo criterio de "estado local de UI", la única diferencia es la clave
 * (`key`, única por reporte y por dato — ej. `'sales-report-filters'`)
 * para que cada reporte tenga su propia memoria, sin cruzarse entre sí.
 */
const memory = new Map<string, unknown>()

export function useReportMemoryState<T>(key: string, initial: T | (() => T)): [T, (value: T) => void] {
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
 * listados, Bloque 1 — ya existente, sin tocar) — la página solicitada
 * sobrevive a navegar a otro reporte y volver, mismo criterio que
 * `useReportMemoryState`. */
export function useReportMemoryPagination(key: string): UsePaginationResult {
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
