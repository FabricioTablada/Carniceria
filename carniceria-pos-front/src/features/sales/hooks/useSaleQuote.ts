import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { salesApi } from '../api/sales.api'
import type { CreateSaleQuoteDto, SaleQuoteResponse } from '../types/sale.types'

/**
 * features/sales/hooks/useSaleQuote.ts
 * -----------------------------------------------------------------------------
 * Bloque P.8.1: cotiza el carrito actual del POS contra `POST /sales/quote`
 * (Bloque P.7, backend) — unica fuente de verdad de subtotal/impuestos/
 * descuentos/total mientras se arma una venta. El frontend NO recalcula
 * nada de esto por su cuenta (objetivo del Bloque P.8): quien consuma este
 * hook debe leer los totales directamente de `data`, no volver a sumarlos.
 *
 * `queryKey: ['sales', 'quote', dto]` — `dto` (`CreateSaleQuoteDto`) es
 * exactamente el conjunto de datos que afecta la cotizacion (`items`,
 * `discountType`, `discountValue`) y nada mas: ningun estado puramente
 * visual del POS (busqueda de producto, metodo de pago, referencia de
 * pago, etc.) forma parte de `dto`, asi que ninguno de esos cambios
 * dispara un refetch. React Query serializa las claves del objeto de
 * forma estable (orden alfabetico) para el hash de cache, asi que la
 * misma combinacion de carrito/descuento siempre resuelve a la MISMA
 * entrada de cache sin importar el orden en que se haya armado `dto` —
 * clave deterministica.
 *
 * `placeholderData: keepPreviousData`: mientras el carrito cambia (nueva
 * `queryKey` en cada edicion), se sigue mostrando la ultima cotizacion
 * valida en vez de parpadear a "sin datos" durante el round-trip — el
 * cajero ve el carrito recalcularse en el sitio, sin saltos visuales.
 * Primer uso de esta opcion en el proyecto (no habia ningun caso previo
 * de "recalculo en vivo" que la necesitara).
 *
 * Disparo: quien use este hook (`SalesPOSPage.tsx`) es responsable de
 * debouncear los cambios del carrito antes de construir `dto` (mismo
 * patron de 300ms ya usado para la busqueda de productos) y de pasar
 * `enabled: false` cuando el carrito esta vacio — este hook no decide
 * ninguna de las dos cosas por su cuenta, solo ejecuta la consulta que se
 * le pide.
 */
export function useSaleQuote(dto: CreateSaleQuoteDto, options?: { enabled?: boolean }) {
  return useQuery<SaleQuoteResponse, AxiosError>({
    queryKey: ['sales', 'quote', dto],
    queryFn: () => salesApi.getSaleQuote(dto),
    enabled: options?.enabled,
    placeholderData: keepPreviousData,
  })
}
