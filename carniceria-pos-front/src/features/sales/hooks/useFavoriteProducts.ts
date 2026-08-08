import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'pos-favorite-products'

function readStoredIds(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * features/sales/hooks/useFavoriteProducts.ts
 * -----------------------------------------------------------------------------
 * Rediseño del POS (aprobado, "catálogo inteligente — Favoritos"): NO existe
 * un campo `isFavorite` en `Product` ni falta agregarlo — es una preferencia
 * de interfaz por terminal, marcada a mano por el cajero, no un dato de
 * negocio. Persistida en `localStorage` (mismo criterio ya usado para la
 * densidad de tabla de Productos, `ProductsPage.tsx`) para sobrevivir a un
 * F5, sin backend ni endpoint nuevo.
 */
export function useFavoriteProducts() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStoredIds())

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds))
  }, [favoriteIds])

  const toggleFavorite = useCallback((productId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    )
  }, [])

  const isFavorite = useCallback((productId: string) => favoriteIds.includes(productId), [favoriteIds])

  return { favoriteIds, isFavorite, toggleFavorite }
}
