import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Ban,
  Clock,
  PauseCircle,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { KbdHint } from '@/components/ui/KbdHint'
import { LoadingState } from '@/components/ui/LoadingState'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatQuantity } from '@/utils/formatQuantity'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { Product } from '@/features/products/types/product.types'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { CustomerSearchDialog } from '@/features/customers/components/CustomerSearchDialog'
import type { LookupItem } from '@/types/lookup'
import { usePromotions } from '@/features/promotions/hooks/usePromotions'
import { useTopProducts } from '@/features/reports/hooks/useTopProducts'
import { PillGroup } from '@/components/ui/PillGroup'
import { useAuthStore } from '@/stores/authStore'
import { useCashSessionStore } from '@/features/cashSession/store/cashSessionStore'
import { useCashSession } from '@/features/cashSession/hooks/useCashSession'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCreateSale } from '../hooks/useCreateSale'
import { useFavoriteProducts } from '../hooks/useFavoriteProducts'
import { useSaleQuote } from '../hooks/useSaleQuote'
import { getSaleErrorMessage } from '../utils/saleErrors'
import type {
  CreateSaleDto,
  CreateSaleQuoteDto,
  PaymentMethod,
  Sale,
  SaleDiscountType,
} from '../types/sale.types'
import { PosHeader } from '../components/PosHeader'
import { ProductResults } from '../components/ProductResults'
import { CartItems, type CartLine } from '../components/CartItems'
import { CartDiscountDialog } from '../components/CartDiscountDialog'
import { PromotionsAvailableDialog } from '../components/PromotionsAvailableDialog'
import { PromotionsActivationDialog } from '../components/PromotionsActivationDialog'
import { CartSummary } from '../components/CartSummary'
import { CheckoutPanel } from '../components/CheckoutPanel'
import { ProductWeightDialog } from '../components/ProductWeightDialog'
import { SaleReceiptDialog } from '../components/SaleReceiptDialog'
import { SessionSalesDialog } from '../components/SessionSalesDialog'
import { ELECTRONIC_PAYMENT_METHODS, PAYMENT_METHOD_OPTIONS } from '../utils/payment'
import { usePosSearchFocusRef } from '@/layouts/PosSearchFocusContext'
import { usePosQuickActionsRef } from '@/layouts/PosQuickActionsContext'

/** Rediseño del POS ("centro operativo", aprobado): "Modo Vender" (armar
 * el pedido) vs "Modo Cobrar" (panel de pago acoplado) — mismo lienzo,
 * nunca un modal. Reemplaza a `isConfirmSaleDialogOpen`. */
type PosMode = 'sell' | 'charge'

/** Rediseño del POS (aprobado): "ventas suspendidas" — una venta puesta en
 * espera para atender a otro cliente, y retomada despues exactamente como
 * quedo. Estado puramente local (en memoria, sin persistencia entre
 * recargas ni backend nuevo): mismo shape que ya usa el carrito activo,
 * solo guardado aparte mientras esta en espera. */
interface SuspendedSale {
  id: string
  cart: CartLine[]
  discountType: SaleDiscountType
  discountValue: number
  paymentMethod: PaymentMethod
  paymentReference: string
  amountPaid: string
  // Bloque 8.5: cliente seleccionado al momento de suspender — sin esto,
  // reanudar una venta suspendida perdía el cliente asociado (siempre
  // volvía a "Público General"), contradiciendo el criterio de "retomada
  // despues exactamente como quedo" de arriba.
  customer: LookupItem | null
  suspendedAt: string
}

/** Tamaño de "pagina" del catalogo del POS — combinado con el `limit`
 * ampliable de "Ver más productos" (`ProductResults.tsx`), reutiliza el
 * mismo filtro `limit` que ya soporta `useProducts`, sin paginacion nueva. */
const PRODUCTS_PAGE_SIZE = 20

/** Rediseño del POS (aprobado, "catálogo inteligente"): valores centinela
 * para el mismo `PillGroup` que ya elige categoría — comparten un único
 * control de selección (mismo criterio de "un solo filtro activo a la
 * vez" que ya regía Categoría). No son IDs reales de categoría, así que
 * nunca chocan con uno (`Category.id` es un UUID). */
const CATALOG_SMART_FILTERS = {
  FAVORITES: '__favorites__',
  RECENT: '__recent__',
  TOP: '__top__',
  PROMOTED: '__promoted__',
} as const

/** Cuántos productos recuerda "Recientes" — mismo criterio que un límite
 * defensivo de UI (no una regla de negocio), suficiente para una fila o
 * dos de catálogo. */
const RECENT_PRODUCTS_LIMIT = 12

export function SalesPOSPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  // "Ver más productos": mismo `limit` que ya soportaba `useProducts`
  // (`ProductFilters.limit`) — sube de a `PRODUCTS_PAGE_SIZE` en vez de
  // pedir todo el catalogo de una vez. Se reinicia al cambiar busqueda/
  // categoria (efecto mas abajo), para no arrastrar un limite ampliado a
  // un filtro distinto.
  const [visibleProductsLimit, setVisibleProductsLimit] = useState(PRODUCTS_PAGE_SIZE)
  // Rediseño del POS (aprobado, "catálogo inteligente — Recientes"):
  // productos agregados al carrito EN ESTA SESIÓN DE NAVEGADOR, más
  // recientes primero — array en memoria, sin backend ni persistencia
  // entre recargas (mismo criterio que "ventas suspendidas").
  const [recentProducts, setRecentProducts] = useState<Product[]>([])
  const { favoriteIds, toggleFavorite } = useFavoriteProducts()
  const [cart, setCart] = useState<CartLine[]>([])
  const [discountType, setDiscountType] = useState<SaleDiscountType>('NONE')
  const [discountValue, setDiscountValue] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [paymentReference, setPaymentReference] = useState('')
  // Rediseño del POS (aprobado): monto recibido, como texto (mismo criterio
  // que `paymentReference`) — reutiliza `CreateSaleDto.amountPaid`, ya
  // soportado por el backend (`sales.service.ts` ya calcula `changeGiven` a
  // partir de el), que el POS nunca enviaba hasta este bloque.
  const [amountPaid, setAmountPaid] = useState('')
  // Bloque 8.3: cliente seleccionado para la venta actual — `null` =
  // "Público General" (comportamiento por defecto). `LookupItem` es
  // suficiente: el header solo necesita mostrar el nombre, y la venta
  // solo necesita el id.
  const [selectedCustomer, setSelectedCustomer] = useState<LookupItem | null>(null)
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
  // Rediseño del POS (aprobado): "Modo Vender"/"Modo Cobrar" — reemplaza a
  // `isConfirmSaleDialogOpen`. El panel de cobro deja de ser un modal: es
  // el mismo lienzo, en otro modo.
  const [posMode, setPosMode] = useState<PosMode>('sell')
  // Rediseño del POS (aprobado): ventas suspendidas — array en memoria,
  // sin backend ni persistencia entre recargas (ver comentario del tipo
  // `SuspendedSale` arriba).
  const [suspendedSales, setSuspendedSales] = useState<SuspendedSale[]>([])
  const [isSuspendedListOpen, setIsSuspendedListOpen] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isSessionSalesOpen, setIsSessionSalesOpen] = useState(false)
  // Rediseño del POS ("terminal profesional", aprobado): "cambiar
  // definitivamente la decisión del peso variable" — ya no se espera una
  // báscula electrónica. `pendingWeightProduct` abre
  // `ProductWeightDialog.tsx` tanto para agregar por primera vez un
  // producto por KILOGRAMO (`initialWeight: 0`) como para editar el peso
  // ya cargado de una línea existente (`initialWeight` = esa cantidad).
  const [pendingWeightProduct, setPendingWeightProduct] = useState<{
    product: Product
    initialWeight: number
  } | null>(null)
  // Mismo ref que usa PosLayout.tsx para devolver el foco al buscador al
  // cerrar "Movimiento de caja" (Escape/Cancelar) — provisto por contexto
  // para no duplicar el ref ni la logica de foco en dos lugares distintos.
  const fallbackSearchInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = usePosSearchFocusRef() ?? fallbackSearchInputRef

  const cashSessionId = useCashSessionStore((state) => state.cashSessionId)
  // Resuelve la sucursal de la sesion de caja activa — se la pasamos a
  // `useProducts` (mas abajo) como `sucursalId` para que el catalogo
  // completo traiga el stock de cada producto embebido en la misma
  // respuesta (Fase 18, Bloque 18.1/18.2) en vez de que cada tarjeta lo
  // pida por separado. Mismo hook que ya usa el resto del modulo de Caja
  // para leer una sesion por id.
  const { data: cashSession } = useCashSession(cashSessionId ?? '')
  const {
    mutate: createSale,
    isPending: isConfirmingSale,
    isError: isConfirmSaleError,
    error: confirmSaleError,
  } = useCreateSale()

  // Rediseño del POS ("terminal profesional", aprobado): "foco automático
  // al entrar al POS" — mismo input/ref que ya enfoca F2, solo que ahora
  // también al montar la pantalla, listo para escribir o escanear sin un
  // primer click.
  useEffect(() => {
    searchInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounce (~300ms) para no disparar una peticion HTTP por cada
  // caracter tipeado: el input (searchTerm) se actualiza al instante,
  // pero la query solo usa el valor una vez que el usuario deja de
  // tipear por ese lapso.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Reinicia "Ver más productos" al cambiar de busqueda o categoria — un
  // limite ampliado por "Ver más" en un filtro no debe arrastrarse al
  // siguiente (mismo criterio que resetear pagina a 1 en un filtro nuevo,
  // ya usado en el resto del ERP). Ajuste de estado DURANTE el render
  // (no en un efecto: el linter de `set-state-in-effect` lo rechaza como
  // "cascading render" evitable) — mismo patron ya usado en
  // `ProductSearchDialog.tsx` (`prevOpen`) para resetear estado derivado
  // cuando cambia un input, sin disparar un render extra de mas.
  const [prevProductFilters, setPrevProductFilters] = useState({
    search: debouncedSearchTerm,
    categoryId: selectedCategoryId,
  })
  if (
    prevProductFilters.search !== debouncedSearchTerm ||
    prevProductFilters.categoryId !== selectedCategoryId
  ) {
    setPrevProductFilters({ search: debouncedSearchTerm, categoryId: selectedCategoryId })
    setVisibleProductsLimit(PRODUCTS_PAGE_SIZE)
  }

  // Bloque P.8.2: `quoteDto` es exactamente el subconjunto de estado que
  // afecta la cotizacion (`items`/`discountType`/`discountValue`) — nada
  // de busqueda, metodo de pago o referencia de pago participa, para que
  // ninguno de esos cambios dispare un recalculo. `useMemo` (no
  // `useState`) porque es un valor DERIVADO de `cart`/`discountType`/
  // `discountValue`, no un estado propio; solo cambia de referencia
  // cuando alguna de esas tres cosas realmente cambia.
  const quoteDto: CreateSaleQuoteDto = useMemo(
    () => ({
      discountType,
      discountValue,
      items: cart.map((line) => ({
        productId: line.product.id,
        taxId: line.product.taxId,
        quantity: line.quantity,
        unitPrice: line.product.salePrice,
      })),
    }),
    [cart, discountType, discountValue],
  )

  // Mismo patron de debounce (~300ms) que la busqueda de productos, aca
  // aplicado al carrito/descuento: cada +/-, cada tecla del descuento
  // dispara este efecto, pero `POST /sales/quote` solo se llama una vez
  // que el cajero deja de editar por ese lapso.
  const [debouncedQuoteDto, setDebouncedQuoteDto] = useState(quoteDto)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuoteDto(quoteDto)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [quoteDto])

  // `POST /sales/quote` es la UNICA fuente de verdad de subtotal/
  // impuestos/descuentos/total (objetivo del Bloque P.8) — este componente
  // ya no vuelve a sumar nada por su cuenta. `enabled` se basa en el
  // carrito YA DEBOUNCEADO (`debouncedQuoteDto.items`), no en `cart` en
  // vivo: `SaleQuoteSchema` (backend) exige al menos un item, asi que
  // habilitar la consulta con el carrito en vivo (antes de que el debounce
  // resuelva) dispararia una peticion invalida con `items: []` en el
  // instante en que se agrega la primera linea.
  const quote = useSaleQuote(debouncedQuoteDto, {
    enabled: debouncedQuoteDto.items.length > 0,
  })
  const hasQuoteError = quote.isError
  // El carrito puede haberse vaciado (venta confirmada, "Quitar" en la
  // ultima linea) mientras `useSaleQuote` todavia conserva el ultimo
  // resultado exitoso via `keepPreviousData` — sin este chequeo, el
  // resumen mostraria un total obsoleto encima de un carrito vacio.
  const hasCartItems = cart.length > 0
  const quoteData = hasCartItems ? quote.data : undefined

  // Reutiliza el hook y el filtro `search` ya aprobados de Products
  // (busqueda server-side vía GET /products?search=...). No se crea
  // ningun hook ni endpoint nuevo, y no se descarga el catalogo completo
  // para filtrarlo en memoria.
  const { data: categoriesData, isLoading: isCategoriesLoading } = useCategories()

  // Bloque POS-05: mismo hook `usePromotions`, ahora SIN el filtro
  // `active: true` — UNA sola consulta (sin peticion adicional) que trae el
  // catalogo completo, del que se derivan por `useMemo` las dos vistas que
  // necesita el POS: `activePromotions` (fila de chips y
  // `PromotionsAvailableDialog.tsx`, de solo lectura, igual que antes) y
  // `allPromotions` (catalogo completo, para `PromotionsActivationDialog.tsx`,
  // que necesita ver tambien las inactivas para poder activarlas). Mismo
  // patron ya usado en este archivo para derivar `visibleProducts` de
  // `data` sin pedir una segunda vez el catalogo de productos.
  //
  // Version 1.0.3, Bloque 6 (causa raiz real, confirmada por codigo): sin
  // `limit`, el backend aplicaba su default (`DEFAULT_LIMIT = 20`,
  // `shared/utils/pagination.ts`) sobre el catalogo COMPLETO de
  // promociones (activas + inactivas, sin filtrar), ordenado por
  // `priority desc, createdAt desc` — una promocion activa real podia
  // quedar fuera de esas primeras 20 filas (por ejemplo, detras de
  // promociones inactivas mas nuevas o de mayor prioridad ya vencidas), y
  // entonces nunca llegaba a `activePromotions`: la pildora "En promocion"
  // (y el boton "Promociones" del header) la mostraban como inexistente,
  // aunque el motor de ventas (`findActiveForEvaluation`, sin paginar) SI
  // la aplicara correctamente al vender. `limit: 100` (el maximo que el
  // backend ya soporta, `MAX_LIMIT` en `shared/utils/pagination.ts` —
  // ningun cambio de backend) elimina ese tope para el volumen real
  // esperado ("decenas de promociones, no miles", segun el propio
  // repositorio del backend). No se agrega `active: true` a esta llamada
  // a proposito: `allPromotions` (sin filtrar) sigue siendo la fuente
  // correcta para `PromotionsActivationDialog.tsx`, que necesita ver
  // tambien las inactivas para poder activarlas — el filtro a "solo
  // activas" para la pildora ya vive del lado del cliente, en la linea de
  // abajo (`activePromotions`), sin cambios.
  const { data: promotionsResponse } = usePromotions({ limit: 100 })
  const allPromotions = useMemo(() => promotionsResponse?.data ?? [], [promotionsResponse])
  const activePromotions = useMemo(
    () => allPromotions.filter((promotion) => promotion.active),
    [allPromotions],
  )

  // `quoteData.appliedPromotions` (Bloque P.8.2) es la UNICA fuente de
  // verdad de "que aplico realmente el motor" — se reutiliza tal cual para
  // marcar el badge "Aplicada" en `PromotionsAvailableDialog.tsx`.
  const appliedPromotionIds = useMemo(
    () => new Set((quoteData?.appliedPromotions ?? []).map((promotion) => promotion.promotionId)),
    [quoteData],
  )

  const [isPromotionsDialogOpen, setIsPromotionsDialogOpen] = useState(false)
  // Bloque POS-05: dialogo de activacion/desactivacion, independiente del
  // anterior (que sigue siendo de solo lectura, solo promociones activas).
  const [isPromotionsActivationOpen, setIsPromotionsActivationOpen] = useState(false)

  // `limit: visibleProductsLimit` (antes fijo en 100): mismo filtro real
  // de `useProducts`, ahora empieza en `PRODUCTS_PAGE_SIZE` y crece de a
  // pasos con "Ver más productos" (`ProductResults.tsx`) — sin esto, el
  // default de 20 dejaba inaccesibles los productos mas alla de la
  // primera pagina al navegar sin buscar/filtrar por categoria (ej. la
  // pestaña "Todos").
  //
  // Fase 18 (Bloque 18.2): `sucursalId` hace que cada producto de la
  // respuesta ya traiga su `stock` en esta misma peticion (ver
  // `products.repository.ts` del backend) — elimina la necesidad de que
  // `ProductCatalogCard.tsx` pida el inventario de cada producto por
  // separado (`useInventory`, patron N+1 diagnosticado en la Fase 18).
  // Corrección del sistema de invalidación (aprobado): `refetchOnWindowFocus`
  // habilitado únicamente para este catálogo — ver `useProducts.ts` para el
  // motivo (garantiza stock actualizado al volver a la pestaña del POS,
  // incluso si la compra que lo actualizó se recibió desde otra sesión del
  // navegador). No afecta el default global ni ningún otro consumidor.
  // Rediseño del POS (aprobado, "catálogo inteligente"): los 4 filtros
  // inteligentes comparten el mismo `PillGroup` que ya elegía categoría
  // (`selectedCategoryId`) — cuando el valor activo es uno de los
  // centinelas de `CATALOG_SMART_FILTERS`, no es un `categoryId` real, así
  // que no se envía al backend (se pide el catálogo sin filtrar por
  // categoría y se recorta del lado del cliente, ver `displayedProducts`
  // más abajo).
  const isSmartFilterActive = (Object.values(CATALOG_SMART_FILTERS) as string[]).includes(
    selectedCategoryId,
  )

  const { data, isLoading, isFetching, isError, error } = useProducts(
    {
      search: debouncedSearchTerm || undefined,
      categoryId: isSmartFilterActive ? undefined : selectedCategoryId || undefined,
      active: true,
      limit: visibleProductsLimit,
      sucursalId: cashSession?.sucursalId,
    },
    { refetchOnWindowFocus: true },
  )

  // Bloque POS-02: un producto con control de inventario y sin unidades
  // disponibles (`stock: null` = sin fila de `Inventory` todavia, o
  // `quantity <= 0`) no debe poder venderse desde el POS — desaparece del
  // catalogo hasta que vuelva a tener existencia, en vez de mostrarse
  // deshabilitado o con un badge "Agotado". Filtro puramente de
  // PRESENTACION: `data.data`/`data.meta.total` (usados mas abajo para
  // "Ver más productos") no se tocan, siguen reflejando la respuesta real
  // del backend — si se filtrara tambien esa cuenta, "Ver más productos"
  // podria desaparecer de la vista aunque todavia queden paginas por
  // traer del backend.
  const visibleProducts = useMemo(
    () =>
      (data?.data ?? []).filter(
        (product) => !product.trackInventory || (product.stock?.quantity ?? 0) > 0,
      ),
    [data],
  )

  // Rediseño del POS (aprobado, "catálogo inteligente — En promoción"):
  // cruza `activePromotions` (ya cargado más abajo... en realidad más
  // arriba, ver `usePromotions()`) contra cada producto — solo los 2
  // alcances simples (`PRODUCT`/`CATEGORY`); `COMBO`/`CART` no identifican
  // un producto individual, quedan fuera del rótulo (no son ambiguos, solo
  // no aplican a "este producto puntual"). Ningún dato nuevo: mismo
  // catálogo de promociones que ya alimenta `PromotionsAvailableDialog.tsx`.
  const promotedProductIdSet = useMemo(
    () =>
      new Set(
        activePromotions
          .filter((promotion) => promotion.scopeType === 'PRODUCT')
          .flatMap((promotion) => promotion.products.map((item) => item.productId)),
      ),
    [activePromotions],
  )
  const promotedCategoryIdSet = useMemo(
    () =>
      new Set(
        activePromotions
          .filter((promotion) => promotion.scopeType === 'CATEGORY')
          .flatMap((promotion) => promotion.categories.map((item) => item.categoryId)),
      ),
    [activePromotions],
  )
  const isProductPromoted = useCallback(
    (product: Product) =>
      promotedProductIdSet.has(product.id) || promotedCategoryIdSet.has(product.categoryId),
    [promotedProductIdSet, promotedCategoryIdSet],
  )

  // Rediseño del POS (aprobado, "catálogo inteligente — Más vendidos"):
  // reutiliza `GET /reports/top-products` (ya existente, ya usado en
  // Reportes) — único indicador de los 5 que agrega una petición nueva al
  // POS; se pide acotado a la sucursal de la sesión activa, sin rango de
  // fechas (ranking general, no "de hoy"). `TopProductItem` no trae el
  // `Product` completo (falta `salePrice`/`stock`/etc.) — por eso solo se
  // usa para marcar/filtrar productos que YA están en el catálogo cargado,
  // nunca para renderizar una tarjeta a partir de él directamente.
  const { data: topProductsData } = useTopProducts({
    sucursalId: cashSession?.sucursalId,
    limit: 24,
  })
  const topSellerIdSet = useMemo(
    () => new Set((topProductsData ?? []).map((item) => item.productId)),
    [topProductsData],
  )

  // Rediseño del POS (aprobado): sets de IDs para las tarjetas del
  // catálogo ACTUALMENTE cargado (badges "Promoción"/"Top ventas" y la
  // estrella de favoritos) — independientes de cuál filtro inteligente
  // esté activo, siempre visibles.
  const promotedProductIds = useMemo(
    () => new Set(visibleProducts.filter(isProductPromoted).map((product) => product.id)),
    [visibleProducts, isProductPromoted],
  )
  const topSellerProductIds = useMemo(
    () => new Set(visibleProducts.filter((product) => topSellerIdSet.has(product.id)).map((product) => product.id)),
    [visibleProducts, topSellerIdSet],
  )
  const favoriteProductIdsInView = useMemo(
    () => new Set(favoriteIds),
    [favoriteIds],
  )

  // Rediseño del POS (aprobado): recorta `visibleProducts` (ya cargado)
  // según el filtro inteligente activo — "Recientes" no depende del
  // catálogo paginado en absoluto (usa `recentProducts`, array propio),
  // los otros 3 sí (filtran dentro de lo que ya está en pantalla; un
  // favorito que hoy no está en la página cargada simplemente no aparece
  // acá, sigue siendo buscable a mano). "Ver más productos" no tiene
  // sentido en ningún filtro inteligente: se oculta.
  const displayedProducts = useMemo(() => {
    switch (selectedCategoryId) {
      case CATALOG_SMART_FILTERS.FAVORITES:
        return visibleProducts.filter((product) => favoriteIds.includes(product.id))
      case CATALOG_SMART_FILTERS.RECENT:
        return recentProducts
      case CATALOG_SMART_FILTERS.TOP:
        return visibleProducts.filter((product) => topSellerIdSet.has(product.id))
      case CATALOG_SMART_FILTERS.PROMOTED:
        return visibleProducts.filter(isProductPromoted)
      default:
        return visibleProducts
    }
  }, [selectedCategoryId, visibleProducts, favoriteIds, recentProducts, topSellerIdSet, isProductPromoted])

  // Rediseño del POS (aprobado, "carrito vacío — accesos rápidos, solo si
  // mejora la experiencia"): favoritos (resueltos dentro del catálogo YA
  // cargado) + recientes, combinados y sin duplicar, tope de 6 — mismos
  // datos que ya alimentan los filtros inteligentes de arriba, ningún
  // cálculo nuevo. Vacío (sin favoritos ni recientes todavía) es el caso
  // normal de un turno recién empezado: `CartItems.tsx` vuelve al estado
  // vacío de siempre en ese caso, sin ruido visual agregado.
  const emptyCartQuickAccessProducts = useMemo(() => {
    const favorites = visibleProducts.filter((product) => favoriteIds.includes(product.id))
    const combined = [...favorites, ...recentProducts]
    const seen = new Set<string>()
    const deduped: Product[] = []
    for (const product of combined) {
      if (!seen.has(product.id)) {
        seen.add(product.id)
        deduped.push(product)
      }
    }
    return deduped.slice(0, 6)
  }, [visibleProducts, favoriteIds, recentProducts])

  // Bloque POS-01 (gestion inteligente de stock): confirmacion pendiente
  // de "estas por vender la ultima unidad disponible" — `null` = ninguna
  // confirmacion abierta. Guarda el producto completo (no solo el id)
  // porque `ConfirmDialog` necesita su nombre para el mensaje.
  const [pendingLastUnitProduct, setPendingLastUnitProduct] = useState<Product | null>(null)

  // Agrega UNA unidad de `product` al carrito (nueva linea a cantidad 1, o
  // +1 sobre la linea ya existente) — unico punto que de verdad modifica
  // `cart` para "sumar una unidad". Tanto tocar un producto del catalogo
  // (`handleSelectProduct`) como el boton "+" de una linea ya en el
  // carrito (`handleIncrease`) pasan por `handleAddUnit` (mas abajo), que
  // valida stock ANTES de llamar a esta funcion — evita repetir esa
  // validacion en dos lugares.
  // Rediseño del POS (aprobado, "catálogo inteligente — Recientes"): lleva
  // `product` al frente de `recentProducts` (sin duplicarlo), recortado a
  // `RECENT_PRODUCTS_LIMIT` — mismo criterio que cualquier lista "más
  // recientes primero" de UI, sin backend.
  const trackRecentProduct = useCallback((product: Product) => {
    setRecentProducts((prev) => [product, ...prev.filter((item) => item.id !== product.id)].slice(0, RECENT_PRODUCTS_LIMIT))
  }, [])

  const addUnitToCart = useCallback(
    (product: Product) => {
      trackRecentProduct(product)
      setCart((prev) => {
        const existing = prev.find((line) => line.product.id === product.id)

        if (existing) {
          return prev.map((line) =>
            line.product.id === product.id
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        }

        return [...prev, { product, quantity: 1 }]
      })
    },
    [trackRecentProduct],
  )

  // Bloque POS-01: unico punto de entrada para "sumar una unidad de este
  // producto al carrito" — valida el stock disponible ANTES de tocar
  // `cart`, sin esperar a la cotizacion ni al boton "Cobrar". Si el
  // producto no lleva control de inventario (`trackInventory: false`) o
  // no hay dato de stock para la sucursal actual (`stock: null`), no hay
  // nada contra que validar: se agrega libremente, mismo comportamiento
  // que antes de este bloque.
  // `useCallback` (no funcion inline suelta): el efecto de resolucion del
  // escaneo (mas abajo) la necesita como dependencia estable — sin esto,
  // al recrearse en cada render dispararia ese efecto de mas.
  const handleAddUnit = useCallback(
    (product: Product) => {
      const availableStock = product.stock?.quantity
      const currentQuantity = cart.find((line) => line.product.id === product.id)?.quantity ?? 0

      if (product.trackInventory && availableStock != null) {
        // Ya en el tope (defensivo: el boton "+"/la tarjeta ya deberian
        // impedir llegar aca en ese estado) — no hacer nada.
        if (currentQuantity >= availableStock) {
          return
        }

        // Esta unidad dejaria el producto en 0 unidades disponibles: pedir
        // confirmacion antes de agregarla (punto 4 del bloque), en vez de
        // agregarla directo.
        if (currentQuantity + 1 === availableStock) {
          setPendingLastUnitProduct(product)
          return
        }
      }

      addUnitToCart(product)
    },
    [cart, addUnitToCart],
  )

  const handleConfirmLastUnit = () => {
    if (pendingLastUnitProduct) {
      addUnitToCart(pendingLastUnitProduct)
    }

    setPendingLastUnitProduct(null)
  }

  // Rediseño del POS ("terminal profesional", aprobado): punto de entrada
  // UNICO para "agregar/editar este producto desde el catálogo, el
  // escáner o la búsqueda" — decide entre el flujo de peso (KILOGRAM,
  // `ProductWeightDialog.tsx`) y el flujo de unidades de siempre
  // (`handleAddUnit`, sin cambios). Nunca se mezclan ambos comportamientos
  // en el mismo producto. `useCallback`: lo necesita el efecto de
  // resolución del escaneo (mas abajo) como dependencia estable.
  const handleAddOrEditProduct = useCallback(
    (product: Product) => {
      if (product.unitOfMeasure === 'KILOGRAM') {
        const existingQuantity = cart.find((line) => line.product.id === product.id)?.quantity ?? 0
        setPendingWeightProduct({ product, initialWeight: existingQuantity })
        return
      }

      handleAddUnit(product)
    },
    [cart, handleAddUnit],
  )

  const handleSelectProduct = (product: Product) => {
    handleAddOrEditProduct(product)
  }

  // Rediseño del POS (aprobado): abre `ProductWeightDialog.tsx` para
  // EDITAR el peso ya cargado de una línea KILOGRAM — mismo dialogo que
  // `handleAddOrEditProduct`, con `initialWeight` ya distinto de 0.
  const handleEditWeight = (productId: string) => {
    const line = cart.find((cartLine) => cartLine.product.id === productId)

    if (line) {
      setPendingWeightProduct({ product: line.product, initialWeight: line.quantity })
    }
  }

  // Bloque 7.28: cierra `ProductWeightDialog.tsx` y devuelve el foco al
  // buscador — mismo criterio ya usado en `handleReceiptOpenChange` (mas
  // abajo) para "Venta completada": cualquier cierre (confirmar peso,
  // cancelar, Escape, click afuera) debe dejar el buscador listo para el
  // siguiente escaneo. Antes solo se limpiaba `pendingWeightProduct`, sin
  // devolver el foco — el campo de peso del dialogo lo captura con
  // `autoFocus` al abrir y nada lo devolvia al cerrarse, rompiendo el
  // siguiente escaneo continuo (bug real reportado en la app instalada).
  const handleWeightDialogClose = () => {
    setPendingWeightProduct(null)
    searchInputRef.current?.focus()
  }

  // Confirma el peso ingresado en `ProductWeightDialog.tsx` — misma
  // validacion de stock disponible que ya usa `handleAddUnit` para
  // productos por unidad, adaptada a un valor decimal en vez de "sumar
  // uno": si el peso pedido supera el stock disponible, se avisa y NO se
  // agrega/actualiza la linea (el dialogo permanece abierto para que el
  // cajero corrija). Un peso de 0 o menos quita la linea del carrito
  // (equivalente a "Quitar").
  const handleConfirmWeight = (weight: number) => {
    if (!pendingWeightProduct) {
      return
    }

    const { product } = pendingWeightProduct
    const availableStock = product.stock?.quantity

    if (product.trackInventory && availableStock != null && weight > availableStock) {
      toast.error(
        `Solo hay ${formatQuantity(availableStock, 'KILOGRAM')} disponibles de "${product.name}".`,
      )
      return
    }

    trackRecentProduct(product)
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id)

      if (existing) {
        return prev.map((line) => (line.product.id === product.id ? { ...line, quantity: weight } : line))
      }

      return [...prev, { product, quantity: weight }]
    })

    handleWeightDialogClose()
  }

  // Rediseño del POS (aprobado): cantidad editable para productos por
  // UNIDAD (`CartItems.tsx`, click sobre el número) — mismo tope de stock
  // que ya aplica el stepper +/-1, solo que el cajero escribe el valor
  // exacto en vez de tocar "+" repetidas veces.
  const handleSetQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((line) => {
        if (line.product.id !== productId) {
          return line
        }

        const availableStock = line.product.stock?.quantity
        const maxAllowed =
          line.product.trackInventory && availableStock != null ? availableStock : Infinity

        return { ...line, quantity: Math.max(1, Math.min(quantity, maxAllowed)) }
      }),
    )
  }

  // Bloque POS-03 (lector de codigo de barras), corregido: NO existe una
  // segunda via de consulta. El lector escribe en el mismo input que la
  // busqueda manual, asi que el termino escaneado pasa por el MISMO
  // `useProducts`/`debouncedSearchTerm` de siempre (arriba) — esta
  // variable solo recuerda "hay un Enter de escaneo pendiente de
  // resolver para este termino", para que el efecto de abajo sepa cuando
  // debe reaccionar. `null` = ningun escaneo pendiente (estado normal de
  // busqueda manual, sin ningun efecto extra sobre ella).
  const [pendingScanTerm, setPendingScanTerm] = useState<string | null>(null)

  // Se dispara con el Enter automatico del lector. No lanza ninguna
  // peticion propia: solo marca el termino actual como "pendiente de
  // escaneo" y deja que el debounce YA EXISTENTE (efecto de arriba) y la
  // MISMA consulta del catalogo (`useProducts`, mas abajo) hagan su
  // trabajo de siempre. Si ya hay un escaneo pendiente sin resolver, un
  // segundo Enter (lector rebotando) no hace nada.
  const handleSearchEnter = () => {
    const scannedTerm = searchTerm.trim()

    if (!scannedTerm || pendingScanTerm !== null) {
      return
    }

    setPendingScanTerm(scannedTerm)
  }

  // Resuelve el escaneo pendiente reutilizando el resultado de la MISMA
  // consulta del catalogo (`data`/`isFetching` de `useProducts`, abajo) —
  // sin esto, cada escaneo dispararia una peticion HTTP independiente en
  // paralelo a la del catalogo (rechazado en revision). Espera a que
  // `debouncedSearchTerm` alcance el termino escaneado (el mismo debounce
  // de 300ms de la busqueda manual, sin forzarlo ni adelantarlo) y a que
  // la consulta ya no este en vuelo (`!isFetching`, evita leer datos
  // todavia correspondientes al termino anterior).
  useEffect(() => {
    if (pendingScanTerm === null) {
      return
    }

    if (debouncedSearchTerm !== pendingScanTerm || isFetching) {
      return
    }

    const matchedProducts = data?.data ?? []

    // El propio `setState` se difiere fuera del cuerpo sincrono del
    // efecto (patron ya usado por los debounce de arriba, con
    // `setTimeout`) — evita la cascada de renders que el linter
    // (`set-state-in-effect`) rechaza al llamarlo directo.
    const timeoutId = setTimeout(() => {
      // Autoagregado UNICAMENTE si la busqueda resuelve a exactamente un
      // producto — con 0 o 2+ resultados no se hace nada automatico (el
      // cajero sigue pudiendo buscar/elegir a mano, sin ningun mensaje
      // nuevo). Misma decision unidad/peso que un tap en el catalogo
      // (`handleAddOrEditProduct`), sin duplicarla: un producto por
      // KILOGRAMO escaneado abre `ProductWeightDialog.tsx` en vez de
      // agregarse directo.
      if (matchedProducts.length === 1) {
        handleAddOrEditProduct(matchedProducts[0])
      }

      // Al finalizar el procesamiento (en cualquiera de los 3 casos: 1, 0
      // o varios resultados) se limpia el campo y vuelve el foco al
      // buscador, listo para el siguiente escaneo continuo.
      setPendingScanTerm(null)
      setSearchTerm('')
      searchInputRef.current?.focus()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [pendingScanTerm, debouncedSearchTerm, isFetching, data, handleAddOrEditProduct, searchInputRef])

  const handleIncrease = (productId: string) => {
    const line = cart.find((cartLine) => cartLine.product.id === productId)

    if (line) {
      handleAddUnit(line.product)
    }
  }

  const handleDecrease = (productId: string) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: line.quantity - 1 }
            : line,
        )
        // Si la cantidad llega a 0, la linea se elimina automaticamente.
        .filter((line) => line.quantity > 0),
    )
  }

  const handleRemove = (productId: string) => {
    setCart((prev) => prev.filter((line) => line.product.id !== productId))
  }

  // "Nueva venta" (sidebar)/"Vaciar" (encabezado del carrito): mismos 4
  // setters que ya se llamaban al completar una venta (`onSuccess` de
  // `handleConfirmSale`, mas abajo, que ahora reutiliza esta misma
  // funcion) — ningun estado nuevo, solo un segundo punto de entrada
  // manual a la misma limpieza.
  const handleClearCart = () => {
    setCart([])
    setSearchTerm('')
    setDiscountType('NONE')
    setDiscountValue(0)
    setPaymentReference('')
    // Bloque POS-04: sin este reseteo, una venta pagada con un metodo
    // electronico dejaba ese mismo metodo seleccionado para la siguiente
    // venta mientras `paymentReference` ya se habia vaciado arriba —
    // bloqueando "Cobrar" (`hasMissingPaymentReference`) hasta que el
    // cajero lo notara y lo corrigiera a mano.
    setPaymentMethod('CASH')
    // Bloque 8.3: cada venta nueva empieza en "Público General" — mismo
    // criterio que el resto de los campos de esta funcion.
    setSelectedCustomer(null)
    // Rediseño del POS (aprobado): mismo criterio que `paymentReference` —
    // sin esto, un monto recibido tipeado en una venta quedaria visible
    // (y potencialmente insuficiente) para la siguiente.
    setAmountPaid('')
    // Vuelve siempre a Modo Vender — "Nueva venta"/vaciar nunca deberia
    // dejar al cajero parado en medio del panel de cobro de la venta
    // anterior.
    setPosMode('sell')
    // Limpia cualquier escaneo del lector de codigo de barras (Bloque
    // POS-03) que hubiera quedado pendiente de resolver al confirmar la
    // venta o vaciar el carrito.
    setPendingScanTerm(null)
  }

  // Rediseño del POS (aprobado): "Suspender venta" — guarda una foto del
  // pedido actual (mismo shape que ya usa el carrito activo) y libera la
  // pantalla via `handleClearCart` (mismos setters de siempre). Sin
  // backend: la lista vive solo en memoria de este componente.
  const handleSuspendSale = () => {
    if (cart.length === 0) {
      return
    }

    const snapshot: SuspendedSale = {
      id: crypto.randomUUID(),
      cart,
      discountType,
      discountValue,
      paymentMethod,
      paymentReference,
      amountPaid,
      customer: selectedCustomer,
      suspendedAt: new Date().toISOString(),
    }

    setSuspendedSales((prev) => [snapshot, ...prev])
    handleClearCart()
    toast.success('Venta suspendida. Podés reanudarla desde "Ventas en espera".')
  }

  // "Reanudar": solo con el pedido actual vacio — evita perder un carrito
  // en curso al traer de vuelta uno suspendido (mismo criterio defensivo
  // que el resto de acciones destructivas del POS).
  const handleResumeSale = (suspendedId: string) => {
    if (cart.length > 0) {
      toast.error('Vaciá o cobrá el pedido actual antes de reanudar otro.')
      return
    }

    const suspended = suspendedSales.find((sale) => sale.id === suspendedId)
    if (!suspended) {
      return
    }

    setCart(suspended.cart)
    setDiscountType(suspended.discountType)
    setDiscountValue(suspended.discountValue)
    setPaymentMethod(suspended.paymentMethod)
    setPaymentReference(suspended.paymentReference)
    setAmountPaid(suspended.amountPaid)
    setSelectedCustomer(suspended.customer)
    setSuspendedSales((prev) => prev.filter((sale) => sale.id !== suspendedId))
    setIsSuspendedListOpen(false)
  }

  const handleDiscardSuspendedSale = (suspendedId: string) => {
    setSuspendedSales((prev) => prev.filter((sale) => sale.id !== suspendedId))
  }

  // "Aplicar descuento": NO toca `discountType` — una version anterior
  // forzaba `setDiscountType('PERCENTAGE')` aca, lo que pisaba la eleccion
  // del cajero en `CartDiscount.tsx` (QA: "el descuento se activa
  // inmediatamente y ya no permite escoger el tipo correctamente").
  // `CartDiscount` sigue siendo la UNICA fuente que cambia `discountType`
  // (via `onDiscountTypeChange`, sin tocar) — esta accion solo abre/cierra
  // el Dialog que lo contiene (Bloque 2, "descuento manual como flujo
  // profesional de ERP": antes una seccion que se expandia dentro del
  // panel derecho, ahora un `Dialog` reutilizado del Design System).
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false)

  // Bloque 3 ("separar completamente promociones de descuento manual"):
  // dos handlers independientes, cada uno con su propio punto de entrada
  // fijo en el panel derecho — ninguno depende del otro ni de cuantas
  // promociones esten activas. `handleOpenPromotions` abre siempre el
  // mismo panel de solo lectura `PromotionsAvailableDialog.tsx` (con 0
  // promociones activas, ese dialogo muestra su propio estado vacio, no
  // se oculta el punto de entrada — asi funciona un ERP: la accion existe
  // siempre, el contenido es lo que varia).
  const handleDiscountAction = () => {
    setIsDiscountDialogOpen(true)
  }

  const handleOpenPromotions = () => {
    setIsPromotionsDialogOpen(true)
  }

  // Bloque POS-05: abre `PromotionsActivationDialog.tsx` (catalogo
  // completo, activar/desactivar) — independiente de `handleOpenPromotions`
  // de arriba (que sigue abriendo el panel de solo lectura de siempre).
  const handleOpenPromotionsActivation = () => {
    setIsPromotionsActivationOpen(true)
  }

  // Ver PosQuickActionsContext.ts — registra los handlers de arriba (mas
  // "Ventas de la sesión", ya existente) en el `RefObject` compartido con
  // `PosSidebar.tsx`. En un efecto (no durante el render): el linter de
  // `refs` no puede verificar que el `RefObject` obtenido via `useContext`
  // sea realmente un ref, asi que trata la mutacion de `.current` durante
  // el render como insegura — el efecto reasigna en cada render (los
  // handlers no estan memoizados), sin ningun estado ni logica nueva.
  const quickActionsRef = usePosQuickActionsRef()
  useEffect(() => {
    if (quickActionsRef) {
      quickActionsRef.current = {
        onNewSale: handleClearCart,
        onFocusDiscount: handleDiscountAction,
        onOpenSessionSales: () => setIsSessionSalesOpen(true),
        onOpenPromotionsCatalog: handleOpenPromotionsActivation,
      }
    }
  })

  const handleConfirmSale = () => {
    // RequireCashSession ya garantiza que esta ruta solo se renderiza con
    // una sesion de caja activa; el chequeo de abajo es defensivo.
    if (!cashSessionId || cart.length === 0) {
      return
    }

    // Rediseño del POS (aprobado): "monto recibido y cálculo de vuelto
    // reutilizando amountPaid ya soportado por el backend". Hallazgo del
    // bloque de análisis: `sales.service.ts` calcula
    // `changeGiven = amountPaid - total`, pero si `amountPaid` se omite
    // usa `0` (no el total) — el POS nunca lo enviaba, asi que TODA venta
    // quedaba con `changeGiven` negativo en los datos. Ahora siempre se
    // envia un valor real: el que tecleo el cajero, o el total exacto si
    // no tecleo nada (mismo comportamiento "pago exacto" que el cajero ya
    // asumia, ahora reflejado correctamente en el dato guardado).
    const parsedAmountPaid = Number(amountPaid) || 0

    const payload: CreateSaleDto = {
      cashSessionId,
      // Bloque 8.3: cliente seleccionado en el POS — `null` si quedó en
      // "Público General" (comportamiento por defecto, sin cambios).
      customerId: selectedCustomer?.id ?? null,
      paymentMethod,
      // QA-007: solo se envia cuando el metodo de pago la requiere y el
      // cajero la escribio — para CASH (o si quedara vacia) se omite, el
      // backend la guarda como `null`.
      paymentReference: paymentReference.trim() || undefined,
      amountPaid: parsedAmountPaid > 0 ? parsedAmountPaid : total,
      discountType,
      discountValue,
      // QA critico: `taxId` se omitia aca pese a estar disponible en
      // `line.product` (el carrito guarda el `Product` completo, ver
      // `CartItems.tsx`) — el backend trataba la ausencia como "sin
      // impuesto" (comportamiento correcto de su lado, `CreateSaleItemDto.taxId`
      // es opcional por diseno), asi que toda venta del POS perdia el
      // impuesto del producto sin importar si `Product.taxId` estaba
      // asignado.
      items: cart.map((line) => ({
        productId: line.product.id,
        taxId: line.product.taxId,
        quantity: line.quantity,
        unitPrice: line.product.salePrice,
      })),
    }

    createSale(payload, {
      onSuccess: (sale) => {
        handleClearCart()
        setCompletedSale(sale)
        // Recien al completarse la venta: vuelve a Modo Vender (via
        // `handleClearCart`) y abre "Venta completada". El foco vuelve al
        // buscador cuando ese dialogo se cierra (ver
        // `handleReceiptOpenChange`), no antes — de lo contrario el propio
        // dialogo se lo roba al abrirse.
        setIsReceiptOpen(true)
        // Bloque POS-08: confirmacion inmediata y no intrusiva — el
        // `SaleReceiptDialog` que se abre arriba ya es la confirmacion
        // principal (pantalla completa), este toast es solo un aviso
        // rapido con el folio, igual criterio que el resto de eventos
        // puntuales de exito de este bloque.
        toast.success('Venta registrada correctamente', {
          description: sale.documentNumber ? `Folio: ${sale.documentNumber}` : undefined,
        })
      },
      onError: (error) => {
        // Bloque POS-08: el `ErrorAlert` de mas abajo (`isConfirmSaleError`)
        // sigue mostrando el detalle persistente — este toast es el aviso
        // inmediato, para una pantalla multi-panel donde el cajero podria
        // no tener la vista puesta en ese bloque en el momento del error.
        toast.error('No se pudo completar la venta', {
          description: getSaleErrorMessage(error),
        })
      },
    })
  }

  const handleBackToSell = () => {
    setPosMode('sell')
  }

  // Se dispara cuando "Venta completada" cambia de estado (cerrar,
  // Escape, click afuera): al cerrarse, devuelve el foco al buscador —
  // misma accion que F2, lista para escanear el siguiente producto.
  const handleReceiptOpenChange = (open: boolean) => {
    setIsReceiptOpen(open)

    if (!open) {
      searchInputRef.current?.focus()
    }
  }

  // Boton de escaneo/codigo de barras del header (Bloque 9): handler
  // dedicado y separado a proposito — hoy unicamente enfoca el buscador
  // (mismo gesto que F2), pero queda preparado para que integrar un
  // lector de codigo de barras real, mas adelante, sea reemplazar
  // UNICAMENTE el cuerpo de esta funcion, sin tocar `PosHeader.tsx` ni su
  // punto de entrada visual.
  const handleBarcodeScanner = () => {
    searchInputRef.current?.focus()
  }

  // Bloque P.8.2: cantidad de unidades es un simple conteo del carrito
  // (no una magnitud monetaria) — sigue derivandose aca, no de la
  // cotizacion. `subtotal`/`taxTotal`/`automaticDiscountTotal`/
  // `discountAmount`/`total` YA NO se calculan en el frontend: son
  // exactamente los mismos numeros que `POST /sales/quote` devolvio,
  // leidos tal cual de `quoteData`. Sin cotizacion todavia (carrito vacio,
  // o el primer resultado aun no llego), se muestran en 0 — no es un
  // calculo alternativo, es el estado inicial trivial mientras no hay
  // nada que cotizar.
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const subtotal = quoteData?.subtotal ?? 0
  const taxTotal = quoteData?.taxTotal ?? 0
  const automaticDiscountTotal = quoteData?.automaticDiscountTotal ?? 0
  const discountAmount = quoteData?.discountTotal ?? 0
  const total = quoteData?.total ?? 0

  // Un descuento fuera de rango (porcentaje > 100, o monto fijo > subtotal)
  // no debe poder confirmarse: mismo criterio que "carrito vacio" para
  // bloquear el boton, Enter y F8 — el backend igual lo rechazaria, pero
  // evita el viaje de red y el mensaje de error generico. `subtotal` aca
  // ya es el de la cotizacion (ajustado por promociones automaticas si
  // las hay), igual que en `computeCartDiscountAmount` del backend.
  const hasInvalidDiscount =
    discountValue < 0 ||
    (discountType === 'PERCENTAGE' && discountValue > 100) ||
    (discountType === 'FIXED' && discountValue > subtotal)

  // QA-007: tarjeta/SINPE/transferencia exigen una referencia antes de
  // poder confirmar — mismo criterio que `hasInvalidDiscount` (el backend
  // igual lo rechazaria via CreateSaleSchema, pero esto evita el viaje de
  // red y el mensaje de error generico).
  const hasMissingPaymentReference =
    ELECTRONIC_PAYMENT_METHODS.includes(paymentMethod) && paymentReference.trim().length === 0

  // Rediseño del POS (aprobado): "monto recibido" — solo bloquea si el
  // cajero ESCRIBIO un monto y ese monto no alcanza el total (dejarlo
  // vacio sigue significando "pago exacto", igual que siempre).
  const parsedAmountPaidForValidation = Number(amountPaid) || 0
  const hasInsufficientPayment =
    (paymentMethod === 'CASH' || paymentMethod === 'MIXED') &&
    amountPaid.trim().length > 0 &&
    parsedAmountPaidForValidation < total

  // Rediseño del POS (aprobado): "Cobrar" ya no abre un modal — pasa a
  // Modo Cobrar (mismo lienzo, panel acoplado). Entrar a ese modo solo
  // exige un carrito válido (descuento correcto, cotización sin error);
  // el metodo/referencia/monto recibido se eligen DENTRO del panel de
  // cobro, asi que no bloquean la transicion en si — `canConfirmCharge`
  // (con esos tres extra) es quien habilita el boton final dentro del
  // panel.
  const canEnterCharge =
    cart.length > 0 &&
    !isConfirmingSale &&
    !hasInvalidDiscount &&
    !hasQuoteError &&
    Boolean(quoteData)

  const canConfirmCharge = canEnterCharge && !hasMissingPaymentReference && !hasInsufficientPayment

  const handleGoToCharge = () => {
    if (canEnterCharge) {
      setPosMode('charge')
    }
  }

  // Atajos de teclado del POS (F2: enfocar buscador; F8/Enter: avanzar a
  // Modo Cobrar o confirmar el cobro, segun `posMode`; Esc: volver a Modo
  // Vender). F4 (abrir "Movimiento de caja") vive en `PosLayout.tsx`, que
  // es quien posee ese estado — mismo criterio de "el dueno del estado
  // maneja su propio atajo" ya usado en el resto del POS.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (event.key === 'Escape' && posMode === 'charge') {
        event.preventDefault()
        handleBackToSell()
        return
      }

      if (event.key === 'F8') {
        event.preventDefault()

        if (posMode === 'sell') {
          handleGoToCharge()
        } else if (canConfirmCharge) {
          handleConfirmSale()
        }
        return
      }

      // Rediseño del POS (aprobado, "flujo de pago — reducir clics/
      // movimientos del mouse"): F1–F5 eligen método de pago, F6 carga el
      // monto exacto — solo dentro de Modo Cobrar (`CheckoutPanel.tsx`
      // montado), mismo `setPaymentMethod`/`setAmountPaid` de siempre, sin
      // ninguna regla nueva. Mismo orden que `PAYMENT_METHOD_OPTIONS`
      // (Efectivo/Tarjeta/SINPE/Transferencia/Mixto), la misma fila de
      // tarjetas tocables que ya existía.
      if (posMode === 'charge') {
        const functionKeyMatch = /^F([1-5])$/.exec(event.key)
        if (functionKeyMatch) {
          event.preventDefault()
          const option = PAYMENT_METHOD_OPTIONS[Number(functionKeyMatch[1]) - 1]
          if (option) {
            setPaymentMethod(option.value)
          }
          return
        }

        if (event.key === 'F6') {
          event.preventDefault()
          setAmountPaid(String(total))
          return
        }
      }

      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null
        const isTextField =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable

        // Foco en el buscador (u otro campo de texto): se deja el
        // comportamiento actual de Enter tal cual, sin agregar logica
        // nueva sobre el.
        if (isTextField) {
          return
        }

        if (posMode === 'sell') {
          handleGoToCharge()
        } else if (canConfirmCharge) {
          handleConfirmSale()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [posMode, canConfirmCharge, handleGoToCharge, handleConfirmSale, handleBackToSell, searchInputRef, total])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PosHeader
        userFullName={user?.fullName ?? ''}
        userRole={user?.role ?? ''}
        isCashSessionOpen={Boolean(cashSessionId)}
        sucursalName={cashSession?.sucursal.name}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchInputRef={searchInputRef}
        onSearchEnter={handleSearchEnter}
        onBackToAdmin={() => navigate('/')}
        onOpenSessionSales={() => setIsSessionSalesOpen(true)}
        onScanBarcode={handleBarcodeScanner}
        onOpenPromotions={handleOpenPromotions}
        activePromotionsCount={activePromotions.length}
        itemCount={itemCount}
        total={total}
        customerName={selectedCustomer?.label}
        onOpenCustomerPicker={() => setIsCustomerDialogOpen(true)}
      />

      <CustomerSearchDialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onSelect={(customer) => {
          setSelectedCustomer(customer)
          setIsCustomerDialogOpen(false)
        }}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Rediseño del POS ("terminal profesional", aprobado): "catálogo
            completamente protagonista" — ya no comparte una fracción fija
            del ancho con el carrito (que ahora es angosto y fijo, ver mas
            abajo): ocupa TODO el espacio restante (`flex-1`), sin importar
            si el carrito esta a 260px o el panel de cobro a 384px. Solo
            ocupa espacio en Modo Vender — en Modo Cobrar desaparece por
            completo para que el pedido y el panel de pago tengan todo el
            ancho, sin scroll de mas. */}
        {posMode === 'sell' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-4">
            {/* Categorías: `shrink-0` explicito — sin esto, un flex-col deja
                que sus hijos se compriman por defecto (`flex-shrink: 1`); las
                categorías deben permanecer siempre visibles, solo la grilla de
                productos (mas abajo) hace scroll. */}
            {!isCategoriesLoading && (
              <div className="shrink-0">
                <PillGroup
                  options={[
                    { value: '', label: 'Todos' },
                    { value: CATALOG_SMART_FILTERS.FAVORITES, label: '⭐ Favoritos' },
                    { value: CATALOG_SMART_FILTERS.RECENT, label: '🕒 Recientes' },
                    { value: CATALOG_SMART_FILTERS.TOP, label: '🔥 Más vendidos' },
                    { value: CATALOG_SMART_FILTERS.PROMOTED, label: '🏷 En promoción' },
                    ...(categoriesData?.data ?? []).map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                  value={selectedCategoryId}
                  onChange={setSelectedCategoryId}
                />
              </div>
            )}

            {isLoading && <LoadingState message="Buscando productos..." />}

            {isError && (
              <ErrorAlert>
                {error?.message ?? 'Ocurrió un error al buscar productos.'}
              </ErrorAlert>
            )}

            {!isLoading && !isError && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ProductResults
                  products={displayedProducts}
                  emptyMessage={
                    selectedCategoryId === CATALOG_SMART_FILTERS.FAVORITES
                      ? 'Todavía no marcaste productos como favoritos.'
                      : selectedCategoryId === CATALOG_SMART_FILTERS.RECENT
                        ? 'Todavía no agregaste productos en esta sesión.'
                        : selectedCategoryId === CATALOG_SMART_FILTERS.TOP
                          ? 'Sin datos de más vendidos para mostrar.'
                          : selectedCategoryId === CATALOG_SMART_FILTERS.PROMOTED
                            ? 'No hay productos en promoción en este momento.'
                            : undefined
                  }
                  onSelect={handleSelectProduct}
                  hasMore={!isSmartFilterActive && Boolean(data && data.data.length < data.meta.total)}
                  onLoadMore={() => setVisibleProductsLimit((limit) => limit + PRODUCTS_PAGE_SIZE)}
                  isLoadingMore={isFetching}
                  promotedProductIds={promotedProductIds}
                  topSellerProductIds={topSellerProductIds}
                  favoriteProductIds={favoriteProductIdsInView}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            )}
          </div>
        )}

        {/* Rediseño del POS ("terminal profesional", aprobado): ancho FIJO
            y angosto (no redimensionable, ~25% menos que la version
            anterior) — "el catálogo debe ser el protagonista", el carrito
            deja de competir por ancho. Siempre visible, en ambos modos
            (nunca se oculta ni se mueve durante el cobro). Superficie
            propia del POS (`--pos-panel`/`--pos-border`), ya no
            `bg-pos-content-muted` (token compartido con el Backoffice).
            Pulido visual (aprobado): "el ancho actual quedó demasiado
            pequeño" — sube ~15% (`w-72`/288px -> 330px), sigue FIJO/no
            redimensionable, el catálogo sigue ganando la mayoria del
            espacio (`flex-1`).
            Rediseño del POS (aprobado, "aumentar ligeramente el ancho del
            carrito para mejorar la lectura de nombres largos/peso/
            promociones"): 570px -> 610px (~7%) — sigue FIJO/no
            redimensionable, la grilla del catálogo baja a 5 columnas en
            esta misma iteración, así que sigue teniendo de sobra la
            mayoría del ancho disponible. */}
        <div className="flex w-[610px] shrink-0 flex-col overflow-hidden border-l border-[var(--pos-border)] bg-[var(--pos-panel-2)]">
          {/* Encabezado del carrito: fijo (no hace scroll con las lineas).
              "Suspender"/"En espera" (ventas suspendidas) solo tienen
              sentido en Modo Vender — en Modo Cobrar el pedido queda de
              solo lectura mientras se cobra. Se retira "Expandir": el
              carrito ya no cambia de ancho. */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-4 text-brand" />
              <h2 className="text-sm font-bold tracking-tight text-[var(--pos-ink)]">Pedido</h2>
              {itemCount > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {itemCount}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              {posMode === 'sell' && (
                <>
                  {cart.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleSuspendSale}
                      disabled={isConfirmingSale}
                      aria-label="Suspender venta"
                      title="Suspender venta"
                      className="text-[var(--pos-ink-muted)] hover:bg-accent-amber/15 hover:text-accent-amber"
                    >
                      <PauseCircle className="size-3.5" />
                    </Button>
                  )}

                  <Popover open={isSuspendedListOpen} onOpenChange={setIsSuspendedListOpen}>
                    <PopoverTrigger
                      className="relative flex size-8 items-center justify-center rounded-lg text-[var(--pos-ink-muted)] transition-colors hover:bg-[var(--pos-bg)] hover:text-[var(--pos-ink)] disabled:pointer-events-none disabled:opacity-40"
                      disabled={suspendedSales.length === 0}
                      aria-label="Ventas en espera"
                      title="Ventas en espera"
                    >
                      <Clock className="size-4" />
                      {suspendedSales.length > 0 && (
                        <Badge
                          variant="accent"
                          className="absolute -top-1 -right-1 min-w-4 justify-center px-1 py-0 text-[0.625rem] leading-4"
                        >
                          {suspendedSales.length}
                        </Badge>
                      )}
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={8}
                      className="w-72 border-[var(--pos-border)] bg-[var(--pos-panel)] p-2"
                    >
                      <p className="px-1.5 pb-1.5 text-xs font-semibold tracking-wide text-[var(--pos-ink-muted)] uppercase">
                        Ventas en espera
                      </p>
                      <div className="flex flex-col gap-1">
                        {suspendedSales.map((suspended) => {
                          const suspendedItemCount = suspended.cart.reduce(
                            (sum, line) => sum + line.quantity,
                            0,
                          )
                          const suspendedTotal = suspended.cart.reduce(
                            (sum, line) => sum + line.product.salePrice * line.quantity,
                            0,
                          )

                          return (
                            <div
                              key={suspended.id}
                              className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-[var(--pos-bg)]"
                            >
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold text-[var(--pos-ink)]">
                                  {suspended.cart.length}{' '}
                                  {suspended.cart.length === 1 ? 'línea' : 'líneas'} ·{' '}
                                  {suspendedItemCount} u.
                                </span>
                                <span className="truncate text-xs text-[var(--pos-ink-muted)]">
                                  {formatCurrency(suspendedTotal)}
                                </span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleResumeSale(suspended.id)}
                                disabled={cart.length > 0}
                              >
                                Reanudar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Descartar venta suspendida"
                                onClick={() => handleDiscardSuspendedSale(suspended.id)}
                                className="text-[var(--pos-ink-muted)] hover:bg-destructive/15 hover:text-destructive"
                              >
                                <Ban className="size-3.5" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {cart.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleClearCart}
                      disabled={isConfirmingSale}
                      aria-label="Vaciar pedido"
                      title="Vaciar pedido"
                      className="text-[var(--pos-ink-muted)] hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Lista de productos: UNICA seccion con scroll de todo el panel
              derecho — el carrito es el protagonista de esta columna, sin
              `max-h`: llena todo el espacio que le queda una vez compactado
              el bloque de abajo (totales/Cobrar), objetivo 6-8 lineas
              completas visibles. Todo lo de abajo es `shrink-0`: nunca se
              comprime ni sale de pantalla por mas lineas que tenga el
              carrito. Se mantiene visible en Modo Cobrar tambien — "el
              pedido debe permanecer visible durante todo el proceso de
              cobro" — pero de SOLO LECTURA (`readOnly`, ver
              `CartItems.tsx`): no se puede agregar, quitar ni modificar
              ninguna linea hasta volver a Modo Vender. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CartItems
              lines={cart}
              onIncrease={handleIncrease}
              onDecrease={handleDecrease}
              onRemove={handleRemove}
              onSetQuantity={handleSetQuantity}
              onEditWeight={handleEditWeight}
              quoteItems={quoteData?.items}
              readOnly={posMode === 'charge'}
              quickAccessProducts={emptyCartQuickAccessProducts}
              onQuickAdd={handleSelectProduct}
            />
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 py-2.5">
            {/* Card de totales: solo el resultado ya calculado
                (Subtotal/Descuento/Impuestos/TOTAL) — visible en ambos
                modos, "el TOTAL debe ser el elemento visual mas importante
                de toda la pantalla". */}
            <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-bg)] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_10px_24px_-18px_rgba(0,0,0,0.15)]">
              <CartSummary
                subtotal={subtotal}
                taxTotal={taxTotal}
                automaticDiscountTotal={automaticDiscountTotal}
                discountAmount={discountAmount}
                total={total}
                isUpdating={hasCartItems && quote.isFetching}
              />
            </div>

            {posMode === 'sell' && (
              <Button
                type="button"
                onClick={handleGoToCharge}
                disabled={!canEnterCharge}
                className="h-16 w-full rounded-[1.25rem] bg-brand text-lg font-extrabold text-brand-foreground shadow-[0_14px_32px_-10px_oklch(0.4708_0.1367_24_/_0.6)] transition-transform duration-150 hover:bg-brand-hover active:scale-[0.99] active:bg-brand-active"
              >
                <span className="flex w-full items-center justify-between px-2">
                  Cobrar
                  <KbdHint className="border-brand-foreground/30 bg-brand-foreground/15 text-brand-foreground">
                    F8
                  </KbdHint>
                </span>
              </Button>
            )}
          </div>

          {/* Bloque P.8.2: error de la COTIZACION (ej. stock insuficiente,
              producto inactivo) — distinto del error de CONFIRMAR la venta
              (`isConfirmSaleError`, mas abajo, sin cambios). Bloquea
              unicamente el boton/Enter/F8 de avanzar a Modo Cobrar (via
              `canEnterCharge`); el carrito sigue totalmente editable para
              que el cajero pueda corregirlo (ej. bajar la cantidad que
              superaba el stock disponible). */}
          {hasQuoteError && (
            <div className="px-4 py-2">
              <ErrorAlert>{getSaleErrorMessage(quote.error)}</ErrorAlert>
            </div>
          )}

          {isConfirmSaleError && (
            <div className="px-4 py-2">
              <ErrorAlert>{getSaleErrorMessage(confirmSaleError)}</ErrorAlert>
            </div>
          )}

          {/* Footer operativo: SOLO atajos de teclado reales — cambia
              segun el modo (mismos listeners ya existentes en este
              archivo/`PosLayout.tsx`). "Caja abierta/cerrada" no se repite
              aca: ya lo muestra `PosHeader.tsx` arriba. */}
          <div className="flex shrink-0 items-center gap-3 border-t border-[var(--pos-border)] bg-[var(--pos-panel)] px-3 py-1.5 text-xs text-[var(--pos-ink-muted)]">
            {posMode === 'sell' ? (
              <>
                <span className="flex items-center gap-1.5">
                  <KbdHint>F2</KbdHint> Buscar
                </span>
                <span className="flex items-center gap-1.5">
                  <KbdHint>F4</KbdHint> Movimiento
                </span>
                <span className="flex items-center gap-1.5">
                  <KbdHint>F8</KbdHint> Cobrar
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <KbdHint>F8</KbdHint> Confirmar cobro
                </span>
                <span className="flex items-center gap-1.5">
                  <KbdHint>ESC</KbdHint> Volver al pedido
                </span>
              </>
            )}
          </div>
        </div>

        {/* Rediseño del POS ("terminal profesional", aprobado): "el Modo
            Cobrar debe entrar como panel deslizante" — SIEMPRE montado
            (nunca aparece/desaparece de golpe). Nunca un modal: convive
            con el pedido (columna de arriba), que permanece visible en
            todo momento.
            Pulido visual (aprobado, "el área derecha está demasiado
            vacía"): antes un ancho FIJO angosto (384px) dejaba todo el
            resto de la pantalla en blanco, ya que el catálogo (el otro
            `flex-1` de esta fila) deja de montarse en Modo Cobrar. Ahora
            este panel es el que gana ese mismo `flex-1` en su lugar —
            ocupa TODO el espacio que el catálogo dejó libre, en vez de
            una franja fija — y se sigue animando con
            `transition-[max-width]` (`max-w-0` -> `max-w-full`, en vez de
            `w-0` -> `w-96`) para conservar el mismo efecto de panel
            deslizante, ahora responsive en vez de un ancho fijo. */}
        <div
          className={cn(
            'flex flex-1 flex-col overflow-hidden border-l border-[var(--pos-border)] bg-[var(--pos-bg)] transition-[max-width] duration-300 ease-out',
            posMode === 'charge' ? 'max-w-full' : 'max-w-0',
          )}
        >
          <CheckoutPanel
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            paymentReference={paymentReference}
            onPaymentReferenceChange={setPaymentReference}
            total={total}
            subtotal={subtotal}
            taxTotal={taxTotal}
            automaticDiscountTotal={automaticDiscountTotal}
            discountAmount={discountAmount}
            itemCount={itemCount}
            amountPaid={amountPaid}
            onAmountPaidChange={setAmountPaid}
            onConfirmSale={handleConfirmSale}
            onBack={handleBackToSell}
            confirmDisabled={!canConfirmCharge}
            isConfirming={isConfirmingSale}
            active={posMode === 'charge'}
          />
        </div>
      </div>

      <SaleReceiptDialog
        open={isReceiptOpen}
        onOpenChange={handleReceiptOpenChange}
        sale={completedSale}
      />

      <SessionSalesDialog
        open={isSessionSalesOpen}
        onOpenChange={setIsSessionSalesOpen}
        cashSessionId={cashSessionId}
      />

      <PromotionsAvailableDialog
        open={isPromotionsDialogOpen}
        onOpenChange={setIsPromotionsDialogOpen}
        promotions={activePromotions}
        appliedPromotionIds={appliedPromotionIds}
        cart={cart}
      />

      <PromotionsActivationDialog
        open={isPromotionsActivationOpen}
        onOpenChange={setIsPromotionsActivationOpen}
        promotions={allPromotions}
      />

      <ConfirmDialog
        open={pendingLastUnitProduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingLastUnitProduct(null)
          }
        }}
        title="Última unidad disponible"
        description={
          pendingLastUnitProduct
            ? `Vas a vender la última unidad disponible de "${pendingLastUnitProduct.name}". Quedará temporalmente fuera del catálogo del POS hasta que se reabastezca. ¿Deseás continuar?`
            : undefined
        }
        confirmText="Sí, agregar"
        cancelText="Cancelar"
        onConfirm={handleConfirmLastUnit}
      />

      <CartDiscountDialog
        open={isDiscountDialogOpen}
        onOpenChange={setIsDiscountDialogOpen}
        discountType={discountType}
        discountValue={discountValue}
        onDiscountTypeChange={setDiscountType}
        onDiscountValueChange={setDiscountValue}
        subtotal={subtotal}
        disabled={isConfirmingSale}
      />

      <ProductWeightDialog
        open={pendingWeightProduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            handleWeightDialogClose()
          }
        }}
        productName={pendingWeightProduct?.product.name ?? ''}
        unitPrice={pendingWeightProduct?.product.salePrice ?? 0}
        initialWeight={pendingWeightProduct?.initialWeight ?? 0}
        onConfirm={handleConfirmWeight}
      />
    </div>
  )
}