import { useEffect, useState } from 'react'

/**
 * hooks/useDebouncedValue.ts
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 2: hook generico y unico para debounce
 * de un valor — reemplaza las 3-4 reimplementaciones independientes del
 * mismo patron `useState` + `useEffect(setTimeout, 300)` que existian en
 * `ProductSearchDialog.tsx`, `CategorySearchDialog.tsx` y `SalesPOSPage.tsx`
 * (ver analisis aprobado, causa raiz C). Este bloque solo migra los dos
 * primeros; `SalesPOSPage.tsx` no se toca (fuera de alcance: "no modificar
 * formularios/paginas de negocio todavia").
 *
 * Sin logica de busqueda: no sabe que es una API, un termino de busqueda ni
 * un filtro — solo retrasa la propagacion de CUALQUIER valor que cambie
 * seguido, el mismo primitivo que ya usaban los tres sitios de forma
 * independiente.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => clearTimeout(timeoutId)
  }, [value, delayMs])

  return debouncedValue
}
