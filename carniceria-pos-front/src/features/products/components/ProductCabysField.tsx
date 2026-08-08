import { useEffect, useRef, useState } from 'react'
import { Popover, PopoverContent } from '@/components/ui/Popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredMark } from '@/components/ui/RequiredMark'
import { LoadingState } from '@/components/ui/LoadingState'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCabysLookup } from '../hooks/useCabysLookup'
import { formatOfficialTaxRate, interpretOfficialTaxRate } from '../utils/cabysTaxIndicator'

const CABYS_CODE_PATTERN = /^\d{13}$/

interface ProductCabysFieldProps {
  /** `cabysCode` actual del formulario (componente controlado, sin estado
   * propio del valor persistido). */
  value: string
  /** Se dispara con el texto tal cual lo escribe el usuario — el
   * formulario sigue validando el formato de 13 digitos (`product.schema.ts`),
   * este campo no le agrega ninguna regla nueva. */
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  /** Mejora UX (indicador visual del impuesto oficial): tasa (puntos
   * porcentuales) del impuesto actualmente elegido en `ProductTaxField` —
   * `null`/`undefined` mientras no haya ninguno seleccionado. Puramente
   * informativo/preventivo, nunca decide si el formulario puede guardar
   * (esa validacion sigue siendo exclusiva del backend). */
  selectedTaxRate?: number | null
}

/**
 * features/products/components/ProductCabysField.tsx
 * -----------------------------------------------------------------------------
 * Version 1.1, Bloque 2 — asistente inteligente de CABYS. A diferencia de
 * `ProductCategoryField.tsx`/`ProductTaxField.tsx` (un boton que ABRE un
 * dialogo separado), este campo integra la busqueda directamente sobre el
 * mismo `<Input>`: es a la vez el campo de texto editable y el ancla de un
 * `Popover` (`components/ui/Popover.tsx`) con las coincidencias de
 * `useCabysLookup` — sin boton adicional, sin dialogo modal, por decision
 * explicita del bloque aprobado.
 *
 * Deliberadamente SIN `PopoverTrigger`: ese primitivo (via el `useButton`
 * de base-ui) fuerza `role="button"` sobre el elemento que envuelve —
 * correcto para un boton, semanticamente incorrecto sobre un `<input>` de
 * texto editable (confirmado en validacion real contra el navegador:
 * quedaba expuesto como boton para lectores de pantalla). En su lugar,
 * `Popover` se controla directamente (`open`/`onOpenChange`, ya
 * controlado) y `PopoverContent` se ancla explicitamente a `inputRef` —
 * ver el prop `anchor` agregado a `components/ui/Popover.tsx` para este
 * caso (opcional, sin efecto en sus consumidores existentes).
 *
 * Dos caminos disparan la misma busqueda (`GET /cabys/lookup`, con
 * debounce de 300ms via `useDebouncedValue`, mismo criterio que el resto
 * del proyecto):
 *  - El usuario escribe libremente (codigo o descripcion) → el popover se
 *    abre mostrando resultados a medida que tipea.
 *  - El texto escrito coincide exactamente con el formato de 13 digitos →
 *    se dispara ademas una busqueda exacta por ese codigo (mismo endpoint,
 *    `search=<codigo>`) para mostrar su descripcion como referencia, o un
 *    aviso si no pertenece al catalogo cargado — sin bloquear el guardado
 *    ni asignar nada automaticamente.
 *
 * El unico valor persistido sigue siendo el codigo de 13 digitos
 * (`cabysCode` del formulario) — la descripcion mostrada debajo es
 * puramente informativa, nunca se envia al backend.
 *
 * Version 1.1, Bloque 4 (pulido de UX): Escape y clic-afuera se manejan
 * a MANO acá (`handleKeyDown`/el `useEffect` de `pointerdown`) — no por
 * eleccion, sino porque se confirmo con evidencia real (navegador real,
 * no solo lectura de codigo) que el descarte nativo de base-ui NO
 * cierra el panel en ninguno de los dos casos cuando el foco esta en el
 * `<input>` en vez de en el propio Popup: `useDismiss` (base-ui,
 * `PopoverRoot.mjs`) aplica sus props de "elemento de referencia" al
 * `Trigger`, que deliberadamente no se usa (ver comentario de mas
 * arriba sobre `role="button"`) — sin ese registro, ni Escape ni el
 * clic-afuera llegan a disparar `onOpenChange`. Ambos casos se
 * reprodujeron y confirmaron antes de escribir esta solucion manual,
 * tal como pedia el bloque aprobado.
 */
export function ProductCabysField({
  value,
  onChange,
  error,
  disabled = false,
  selectedTaxRate = null,
}: ProductCabysFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Fix (doble clic para cerrar el panel): `handleSelect` reenfoca el
  // input para no perder continuidad de edicion — pero ese `.focus()`
  // dispara sincronicamente el `onFocus` de abajo, cuya clausura todavia
  // ve el `value` VIEJO (el texto de busqueda previo a la seleccion, no
  // el codigo recien elegido, porque `onChange` recien se aplica al
  // terminar este mismo handler) y reabria el panel, deshaciendo el
  // `setIsOpen(false)` de la propia seleccion. Esta bandera (un ref, no
  // estado — no debe disparar un render propio) le avisa al `onFocus`
  // inmediatamente siguiente que ese foco en particular viene de una
  // seleccion ya resuelta, no de un re-enfoque genuino del usuario.
  const suppressNextFocusOpenRef = useRef(false)
  const [isOpen, setIsOpen] = useState(false)
  // Descripcion (y, desde la mejora UX del indicador de impuesto, el
  // `taxIndicator` oficial) ya conocidos de una seleccion explicita en el
  // popover — tiene prioridad sobre la verificacion automatica de abajo
  // mientras coincida con el valor actual del campo (ver `resolvedDescription`
  // / `resolvedTaxIndicator`).
  const [selectedDescription, setSelectedDescription] = useState<{
    code: string
    description: string
    taxIndicator: string | null
  } | null>(null)

  const debouncedSearch = useDebouncedValue(value, 300)
  const isExactCode = CABYS_CODE_PATTERN.test(value)

  // Busqueda para el listado del popover: solo mientras esta abierto y hay
  // texto (evita traer "los primeros N codigos" sin ningun termino, que no
  // es un listado util para elegir). `limit: 50` es el tope maximo ya
  // permitido por el backend (`LOOKUP_MAX_LIMIT`, `shared/utils/lookup.ts`)
  // — sin cambios de backend, solo se deja de limitar a 20 del lado del
  // frontend.
  const listQuery = useCabysLookup(
    { search: debouncedSearch || undefined, limit: 50 },
    isOpen && debouncedSearch.length > 0,
  )

  // Verificacion automatica de un codigo exacto de 13 digitos, tal como lo
  // exige el punto 3 del bloque aprobado — corre siempre que el texto
  // tenga ese formato, aunque el popover este cerrado.
  const exactQuery = useCabysLookup(
    { search: debouncedSearch, limit: 1 },
    isExactCode && debouncedSearch === value,
  )

  const exactMatchItem = isExactCode && exactQuery.data ? exactQuery.data.data[0] : undefined

  // Item resuelto (descripcion + `taxIndicator` oficial) del codigo actual
  // — `null` cuando el codigo todavia no se pudo resolver (ni por
  // seleccion explicita en el popover, ni por la verificacion automatica
  // de abajo, ni porque no pertenece al catalogo cargado). Distinto de
  // "resuelto pero sin informacion oficial de impuesto" (`taxIndicator`
  // `null`/`"na"` dentro de un item que SI existe) — esa distincion es la
  // que separa el aviso "no pertenece al catalogo" (ya existente, mas
  // abajo) del nuevo aviso "informacion tributaria no disponible" (mejora
  // UX del indicador de impuesto).
  const resolvedItem =
    selectedDescription?.code === value ? selectedDescription : (exactMatchItem ?? null)

  const resolvedDescription = resolvedItem?.description ?? null

  // Mejora UX (indicador visual del impuesto oficial): `undefined` mientras
  // el codigo no se resolvio contra el catalogo (no se afirma nada sobre su
  // impuesto oficial); `null` cuando SI se resolvio pero el catalogo no
  // trae informacion utilizable ("na", vacio); un numero (puntos
  // porcentuales) en cualquier otro caso — mismo criterio que
  // `interpretOfficialTaxRate` (replica exacta del backend).
  const officialTaxRate = resolvedItem ? interpretOfficialTaxRate(resolvedItem.taxIndicator) : undefined

  const taxRateMatches =
    officialTaxRate !== undefined && officialTaxRate !== null && selectedTaxRate !== null
      ? officialTaxRate === selectedTaxRate
      : null

  const showNotInCatalogWarning =
    isExactCode && exactQuery.data && exactQuery.data.data.length === 0 && debouncedSearch === value

  const results = listQuery.data?.data ?? []

  const handleSelect = (code: string, description: string, taxIndicator: string | null) => {
    setSelectedDescription({ code, description, taxIndicator })
    onChange(code)
    setIsOpen(false)
    // El boton clickeado se desmonta al cerrar el popover — sin esto el
    // foco quedaria perdido (en el <body>) en vez de seguir en el campo,
    // rompiendo la continuidad de edicion/tabulacion. La bandera evita
    // que este mismo `.focus()` reabra el panel (ver comentario de la
    // bandera, mas arriba) — se consume en el `onFocus` de abajo.
    suppressNextFocusOpenRef.current = true
    inputRef.current?.focus()
  }

  const handleInputChange = (rawValue: string) => {
    if (selectedDescription && selectedDescription.code !== rawValue) {
      setSelectedDescription(null)
    }
    onChange(rawValue)
    setIsOpen(rawValue.length > 0)
  }

  // Clic-afuera: confirmado con evidencia real que el descarte nativo de
  // base-ui no cierra el panel en este caso (ver comentario de cabecera).
  // Un click dentro del propio input o dentro del panel (identificado por
  // el atributo `data-slot="popover-content"` que ya expone
  // `components/ui/Popover.tsx`, sin necesitar una ref nueva) nunca debe
  // cerrarlo — cualquier otro click si.
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      const insideInput = target ? inputRef.current?.contains(target) : false
      const insidePopover = target?.closest('[data-slot="popover-content"]')
      if (!insideInput && !insidePopover) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && isOpen) {
      // Mismo criterio que cualquier combobox: Escape cierra el panel
      // sugerido sin vaciar el campo ni sacar el foco de el.
      event.stopPropagation()
      setIsOpen(false)
    }
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const related = event.relatedTarget as Element | null
    // Perder el foco hacia DENTRO del propio panel (ej. Tab hacia un
    // resultado) no debe cerrarlo — cualquier otro destino de foco si.
    if (!related?.closest('[data-slot="popover-content"]')) {
      setIsOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="product-form-cabysCode">
        Código CABYS
        <RequiredMark />
      </Label>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Input
          id="product-form-cabysCode"
          ref={inputRef}
          placeholder="Buscá por código o descripción — ej. 0111100000000"
          disabled={disabled}
          aria-invalid={!!error}
          className="font-mono"
          autoComplete="off"
          value={value}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => {
            if (suppressNextFocusOpenRef.current) {
              // Foco disparado por el propio `handleSelect`, no un
              // re-enfoque genuino del usuario — no reabrir el panel.
              suppressNextFocusOpenRef.current = false
              return
            }
            if (value.length > 0) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />

        <PopoverContent
          anchor={inputRef}
          align="start"
          sideOffset={4}
          // Ancho generoso e independiente del ancho del campo (antes
          // `w-[var(--anchor-width)]`, demasiado angosto para
          // descripciones CABYS reales de 60-150+ caracteres) — acotado a
          // `90vw` para nunca desbordar en pantallas chicas. Alto también
          // ampliado (antes `max-h-64` ≈ 5 filas visibles) y acotado a
          // `60vh` para no salirse del viewport. Sin overflow horizontal:
          // la descripción de cada fila envuelve en varias líneas en vez
          // de truncarse, así nunca hace falta scroll horizontal.
          className="w-[min(36rem,90vw)] p-1.5"
          initialFocus={false}
        >
          {listQuery.isLoading && (
            <div className="p-2">
              <LoadingState message="Buscando..." />
            </div>
          )}

          {listQuery.isError && (
            <p className="p-3 text-sm text-destructive">Ocurrió un error al buscar el catálogo CABYS.</p>
          )}

          {!listQuery.isLoading && !listQuery.isError && results.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              No se encontraron códigos CABYS que coincidan con la búsqueda.
            </p>
          )}

          {!listQuery.isLoading && !listQuery.isError && results.length > 0 && (
            <div className="flex max-h-[min(28rem,60vh)] flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
              {results.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code, item.description, item.taxIndicator)}
                  className="flex w-full items-start gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="mt-0.5 w-[7.5rem] shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {item.code}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug text-foreground">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {resolvedDescription && (
        <p className="text-xs text-muted-foreground">{resolvedDescription}</p>
      )}

      {/* Mejora UX (indicador visual del impuesto oficial CABYS) — puramente
          preventiva/informativa: nunca decide si el formulario puede
          guardar, esa validacion sigue siendo exclusiva del backend
          (`ValidationError`, sin cambios). */}
      {officialTaxRate !== undefined && officialTaxRate !== null && (
        <p className="text-xs text-muted-foreground">
          <span aria-hidden="true">✓</span> Impuesto oficial según BCCR: {formatOfficialTaxRate(officialTaxRate)}
        </p>
      )}

      {officialTaxRate === null && (
        <p className="text-xs text-muted-foreground">
          Información tributaria no disponible para este código CABYS.
        </p>
      )}

      {taxRateMatches === true && (
        <p className="text-xs font-medium text-emerald-600">
          <span aria-hidden="true">✓</span> El impuesto coincide con el catálogo oficial del BCCR.
        </p>
      )}

      {taxRateMatches === false && (
        <p className="text-xs font-medium text-amber-600">
          <span aria-hidden="true">⚠</span> El impuesto seleccionado no coincide con el impuesto oficial del
          código CABYS.
        </p>
      )}

      {showNotInCatalogWarning && (
        <p className="text-xs text-amber-600">
          Este código no pertenece al catálogo CABYS cargado.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
