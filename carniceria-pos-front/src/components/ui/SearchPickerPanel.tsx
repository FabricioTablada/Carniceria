import { Fragment, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { DialogHeader, DialogTitle, DialogDescription } from './Dialog'
import { Button } from './button'
import { ErrorAlert } from './ErrorAlert'
import { LoadingState } from './LoadingState'
import { SearchInput } from './SearchInput'

/**
 * components/ui/SearchPickerPanel.tsx
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 2: infraestructura generica del "modo
 * busqueda" de un picker (dialogo "buscar y elegir uno"). Centraliza la
 * parte que `ProductSearchDialog.tsx` y `CategorySearchDialog.tsx`
 * duplicaban byte a byte: header (titulo/descripcion) + campo de busqueda +
 * contador de resultados + boton "crear nuevo" + estados de
 * carga/error/vacio + lista con scroll propio (ver analisis aprobado,
 * causa raiz C).
 *
 * Deliberadamente generico sobre `T` (el tipo de item de resultado, ej.
 * `ProductLookupItem`/`CategoryLookupItem`): cada fila de resultado sigue
 * siendo completamente especifica de cada picker (miniatura+SKU+precio
 * para productos, categoria-padre+descripcion para categorias) via
 * `renderItem` — este componente NUNCA decide como se ve una fila, solo
 * el andamiaje alrededor (misma razon por la que no se intento forzar un
 * unico tamaño de dialogo: `<Dialog>`/`<DialogContent>` siguen viviendo en
 * cada picker especifico, con su propio `className` de tamaño).
 *
 * El "modo crear" (formulario embebido de creacion rapida) tampoco vive
 * aca: es especifico de cada entidad (`QuickProductForm`/`CategoryForm`) y
 * queda fuera de esta pieza — este componente solo cubre el modo busqueda.
 *
 * Mejora UX "Nueva compra" (agregar varios productos): `footer` es
 * opcional y aditivo — permite que un consumidor (ej.
 * `ProductSearchDialog.tsx` en modo seleccion multiple) agregue una barra
 * fija debajo de la lista (ej. "N seleccionados" + boton de confirmar) sin
 * que este componente sepa nada de seleccion multiple. Sin `footer`
 * (`CategorySearchDialog.tsx` y el modo simple de `ProductSearchDialog.tsx`),
 * el markup es exactamente el mismo que antes.
 */
interface SearchPickerPanelProps<T> {
  title: string
  description: string
  searchInputId: string
  searchLabel: string
  searchPlaceholder?: string
  searchTerm: string
  onSearchTermChange: (value: string) => void
  createLabel: string
  onCreateNew: () => void
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  loadingMessage: string
  emptyMessage: ReactNode
  items: T[]
  getItemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** Contenido fijo debajo de la lista con scroll (ej. barra de
   * confirmacion de seleccion multiple). Opcional, `undefined` por
   * defecto. */
  footer?: ReactNode
}

export function SearchPickerPanel<T>({
  title,
  description,
  searchInputId,
  searchLabel,
  searchPlaceholder,
  searchTerm,
  onSearchTermChange,
  createLabel,
  onCreateNew,
  isLoading,
  isError,
  errorMessage,
  loadingMessage,
  emptyMessage,
  items,
  getItemKey,
  renderItem,
  footer,
}: SearchPickerPanelProps<T>) {
  return (
    <>
      <div className="flex flex-col gap-3 border-b p-5">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <SearchInput
          id={searchInputId}
          label={searchLabel}
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={onSearchTermChange}
          autoFocus
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {!isLoading && !isError
              ? `${items.length} resultado${items.length === 1 ? '' : 's'}`
              : ' '}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCreateNew}
            className="gap-1.5 text-brand hover:bg-brand/5 hover:text-brand"
          >
            <Plus className="size-3.5" />
            {createLabel}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading && (
          <div className="p-2">
            <LoadingState message={loadingMessage} />
          </div>
        )}

        {isError && (
          <div className="p-2">
            <ErrorAlert>{errorMessage ?? 'Ocurrió un error al buscar.'}</ErrorAlert>
          </div>
        )}

        {!isLoading && !isError && (
          <div className="flex flex-col gap-1">
            {items.length === 0 && (
              <div className="px-1 py-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            )}

            {items.map((item) => (
              <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
            ))}
          </div>
        )}
      </div>

      {footer}
    </>
  )
}
