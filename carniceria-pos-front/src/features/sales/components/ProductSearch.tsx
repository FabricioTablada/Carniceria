import type { Ref } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KbdHint } from '@/components/ui/KbdHint'

interface ProductSearchProps {
  /** Termino de busqueda actual. El componente no mantiene estado propio. */
  value: string
  /** Se dispara con el nuevo termino en cada cambio. */
  onChange: (value: string) => void
  /** Ref al input nativo, para que SalesPOSPage.tsx pueda enfocarlo desde
   * el atajo de teclado F2. Puramente presentacional: el componente no
   * decide cuando se enfoca, solo expone el nodo. */
  inputRef?: Ref<HTMLInputElement>
  /** Bloque POS-03 (lector de codigo de barras): se dispara al presionar
   * Enter dentro del input — un lector en modo teclado escribe el codigo
   * y termina enviando Enter solo, sin intervencion del cajero. Este
   * componente no decide que hacer con ese Enter (ni resuelve nada de
   * busqueda/carrito), solo lo reporta — toda la logica de que hacer con
   * un escaneo vive en SalesPOSPage.tsx, mismo criterio que el resto de
   * este archivo (presentacion pura). Opcional: sin este prop, Enter
   * sigue sin hacer nada aca, igual que antes de este bloque. */
  onEnter?: () => void
}

/**
 * features/sales/components/ProductSearch.tsx
 * -----------------------------------------------------------------------------
 * Bloque 9 ("barra superior del POS"): el icono decorativo del input pasa
 * de `ScanLine` (escaneo) a `Search` (lupa) — ese icono representaba mal
 * la busqueda por texto; el escaneo de codigo de barras ahora tiene su
 * propio punto de entrada, separado, en `PosHeader.tsx`. Sin cambios de
 * props ni de comportamiento de busqueda.
 *
 * Bloque POS-03: `onEnter` es aditivo — la busqueda manual (`value`/
 * `onChange`) no cambia en nada, sigue siendo el mismo input controlado de
 * siempre. Enter no interfiere con tipear un nombre/SKU parcial: seguir
 * escribiendo despues de un Enter sin match simplemente sigue filtrando
 * como hoy (SalesPOSPage.tsx decide que hacer segun cuantos resultados
 * haya, este componente no lo sabe ni le importa).
 *
 * Rediseño del POS (aprobado, "el buscador debe sentirse como el punto
 * principal de entrada al POS"): crece (`h-12` -> `h-14`, `text-[0.9375rem]`
 * -> `text-base`), lupa e hint `F2` un poco más grandes, y gana un borde
 * de 2px que se tiñe de marca al enfocar (`focus-within`, en vez de solo
 * el anillo por defecto del `Input`) — mismo componente/props, solo más
 * peso visual dentro de `PosHeader.tsx`.
 */
export function ProductSearch({ value, onChange, inputRef, onEnter }: ProductSearchProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="pos-product-search" className="sr-only">
        Buscar producto
      </Label>
      <div className="relative rounded-xl border-2 border-transparent transition-colors focus-within:border-brand/50">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="pos-product-search"
          ref={inputRef}
          placeholder="Nombre, SKU o código de barras"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onEnter?.()
            }
          }}
          className="h-14 rounded-xl pr-14 pl-11 text-base"
        />
        <KbdHint className="absolute top-1/2 right-3.5 -translate-y-1/2">F2</KbdHint>
      </div>
    </div>
  )
}