import { Search } from 'lucide-react'
import { Input } from './input'
import { Label } from './label'
import { cn } from '@/lib/utils'

/**
 * components/ui/SearchInput.tsx
 * -----------------------------------------------------------------------------
 * Arquitectura de selectores, Bloque 2: componente unico y reutilizable
 * para el campo de busqueda con icono — reemplaza el markup identico
 * copiado dos veces (`ProductSearchDialog.tsx`, `CategorySearchDialog.tsx`:
 * mismo icono `Search` posicionado en `absolute`, mismas clases
 * `h-11 pl-10 text-base`, mismo `Label` `sr-only`) en vez de una pieza
 * compartida (ver analisis aprobado, causa raiz C).
 *
 * Sin logica de busqueda ni de debounce: solo presenta un input controlado
 * con icono — el valor que expone es el termino "en vivo" tal como lo
 * teclea el usuario; el debounce vive en quien lo consume (via
 * `useDebouncedValue`), igual que en el diseño anterior de ambos dialogos.
 */
interface SearchInputProps {
  id: string
  /** Texto del `<Label>` — se renderiza `sr-only` (visualmente oculto,
   * accesible para lectores de pantalla), igual que en los dos dialogos
   * que originaron este componente. */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

export function SearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
}: SearchInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn('h-11 pl-10 text-base', className)}
        />
      </div>
    </div>
  )
}
