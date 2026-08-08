import { useState } from 'react'
import { UserRound, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { SearchInput } from '@/components/ui/SearchInput'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCustomerLookup } from '../hooks/useCustomerLookup'
import type { LookupItem } from '@/types/lookup'

interface CustomerSearchDialogProps {
  /** Controla si el dialogo esta abierto. Componente controlado, sin estado propio de apertura. */
  open: boolean
  /** Se dispara cuando el dialogo pide cambiar su estado (cerrar, Escape, click afuera). */
  onOpenChange: (open: boolean) => void
  /** Se dispara cuando el usuario elige un cliente registrado, o "Público
   * General" (`null`) — el POS reemplaza el cliente seleccionado del
   * carrito con lo que llegue aca. */
  onSelect: (customer: LookupItem | null) => void
}

/**
 * features/customers/components/CustomerSearchDialog.tsx
 * -----------------------------------------------------------------------------
 * Bloque 8.3 — selector de cliente del POS. Consume `useCustomerLookup`
 * (`GET /customers/lookup`, Bloque 8.2), igual criterio que
 * `SupplierSearchDialog.tsx`/`ProductSearchDialog.tsx`.
 *
 * A diferencia de esos dos, NO reutiliza `SearchPickerPanel.tsx`: ese
 * componente compartido siempre renderiza un boton "Crear nuevo", y la
 * creacion rapida de clientes desde el POS esta explicitamente fuera de
 * alcance de este bloque — se arma el mismo andamiaje (buscador + lista
 * con estados de carga/error/vacio) a mano, sin ese boton, en vez de
 * forzar ese componente compartido a un caso que no soporta.
 *
 * "Público General" es siempre la primera fila, fija, fuera de los
 * resultados de busqueda — la forma de "volver" a el sin necesidad de
 * buscar nada.
 */
export function CustomerSearchDialog({ open, onOpenChange, onSelect }: CustomerSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm)

  // Mismo patron que `SupplierSearchDialog.tsx`: se ajusta durante el
  // render (no en un efecto) para no disparar un set-state sincrono
  // dentro de un effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setSearchTerm('')
    }
  }

  const { data, isLoading, isError, error } = useCustomerLookup({
    active: true,
    search: debouncedSearchTerm || undefined,
    limit: 50,
  })

  const customers = data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[75vh] max-h-[640px] w-[90vw] max-w-xl flex-col gap-0 p-0">
        <div className="flex flex-col gap-3 border-b p-5">
          <DialogHeader>
            <DialogTitle>Seleccionar cliente</DialogTitle>
            <DialogDescription>
              Buscá un cliente registrado, o dejá la venta en "Público General".
            </DialogDescription>
          </DialogHeader>

          <SearchInput
            id="customer-search"
            label="Buscar cliente"
            placeholder="Nombre o identificación"
            value={searchTerm}
            onChange={setSearchTerm}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-muted"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <span className="truncate text-base font-semibold text-foreground">Público General</span>
          </button>

          <div className="my-2 border-t" />

          {isLoading && (
            <div className="p-2">
              <LoadingState message="Buscando clientes..." />
            </div>
          )}

          {isError && (
            <div className="p-2">
              <ErrorAlert>{error?.message ?? 'Ocurrió un error al buscar clientes.'}</ErrorAlert>
            </div>
          )}

          {!isLoading && !isError && (
            <div className="flex flex-col gap-1">
              {customers.length === 0 && (
                <div className="px-1 py-10 text-center text-sm text-muted-foreground">
                  No se encontraron clientes.
                </div>
              )}

              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => onSelect(customer)}
                  className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <UserRound className="size-5" />
                  </span>
                  <span className="truncate text-base font-semibold text-foreground">
                    {customer.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
