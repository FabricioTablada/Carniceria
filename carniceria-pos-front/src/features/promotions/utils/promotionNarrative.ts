import { formatCurrency } from '@/utils/formatCurrency'
import type {
  DayOfWeek,
  PromotionEffectType,
  PromotionScopeType,
} from '../types/promotion.types'

/**
 * features/promotions/utils/promotionNarrative.ts
 * -----------------------------------------------------------------------------
 * Sprint UX/UI PIPASA V1 — rediseño de Promociones. Traduce los campos
 * tecnicos de una promocion (`scopeType`/`effectType`/fechas/dias/etc.) a
 * oraciones en español, en vez de una lista de campos — el mismo dato
 * que ya existe, presentado como una persona lo diria, no como el modelo
 * de datos lo guarda. Usado por `PromotionLivePanel.tsx` (Bloque 1,
 * mientras se crea/edita) y `PromotionDrawer.tsx` (vista rapida de una
 * promocion ya guardada) para no duplicar esta logica en los dos lugares.
 *
 * Presentacion pura: no valida nada, no decide si una promocion es
 * "correcta" — solo arma texto a partir de los valores que ya tiene.
 */

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'lunes',
  TUESDAY: 'martes',
  WEDNESDAY: 'miércoles',
  THURSDAY: 'jueves',
  FRIDAY: 'viernes',
  SATURDAY: 'sábado',
  SUNDAY: 'domingo',
}

/** Orden natural de la semana (el array `daysOfWeek` no garantiza orden). */
const DAY_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

export interface PromotionNarrativeInput {
  scopeType?: PromotionScopeType | null
  effectType?: PromotionEffectType | null
  effectValue?: number | null
  buyQuantity?: number | null
  payQuantity?: number | null
  minQuantity?: number | null
  startDate?: string | null
  endDate?: string | null
  startTime?: string | null
  endTime?: string | null
  daysOfWeek?: DayOfWeek[] | null
  stackable?: boolean | null
  exclusiveGroup?: string | null
  /** Nombres ya resueltos — Producto/Combo: nombres de producto;
   * Categoría: nombres de categoria. Quien arma el input decide cual
   * lista corresponde segun `scopeType`. */
  selectedNames?: string[]
}

function formatDateOnly(value: string): string {
  // Los inputs `type="date"` entregan "AAAA-MM-DD" — se arma DD/MM/AAAA
  // a mano (sin `Date`/zona horaria de por medio) para evitar el
  // corrimiento de un dia que producen los `Date` en UTC vs local.
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

/** Frase de "a que aplica" — ej. "Costilla de Cerdo", "3 productos
 * seleccionados", "la categoría Carnes Rojas", "todo el carrito". */
export function buildScopePhrase(input: PromotionNarrativeInput): string {
  const names = input.selectedNames ?? []

  switch (input.scopeType) {
    case 'PRODUCT':
      if (names.length === 0) return 'los productos seleccionados'
      if (names.length === 1) return names[0]
      if (names.length <= 3) return names.join(', ')
      return `${names.length} productos seleccionados`
    case 'CATEGORY':
      if (names.length === 0) return 'las categorías seleccionadas'
      if (names.length === 1) return `la categoría ${names[0]}`
      if (names.length <= 3) return `las categorías ${names.join(', ')}`
      return `${names.length} categorías seleccionadas`
    case 'COMBO':
      return names.length > 0 ? `un combo de ${names.length} productos` : 'un combo de productos'
    case 'CART':
      return 'todo el carrito'
    default:
      return 'lo que definas'
  }
}

/** Frase del beneficio — ej. "20% de descuento en Costilla de Cerdo.",
 * "Compra 3 y paga 2 en un combo de 2 productos.". `null` si todavia no
 * hay suficiente informacion para armar una frase con sentido. */
export function buildEffectSentence(input: PromotionNarrativeInput): string | null {
  const scopePhrase = buildScopePhrase(input)

  switch (input.effectType) {
    case 'PERCENTAGE':
      if (input.effectValue == null) return null
      return `${input.effectValue}% de descuento en ${scopePhrase}.`
    case 'FIXED_AMOUNT':
      if (input.effectValue == null) return null
      return `${formatCurrency(input.effectValue)} de descuento en ${scopePhrase}.`
    case 'SPECIAL_PRICE':
      if (input.effectValue == null) return null
      return `Precio especial de ${formatCurrency(input.effectValue)} en ${scopePhrase}.`
    case 'FIXED_PRICE':
      if (input.effectValue == null) return null
      return `Precio fijo de ${formatCurrency(input.effectValue)} por unidad en ${scopePhrase}.`
    case 'BUY_X_PAY_Y': {
      if (input.buyQuantity == null || input.payQuantity == null) return null
      const free = input.buyQuantity - input.payQuantity
      const freeNote = free > 0 ? ` (${free} de regalo)` : ''
      return `Compra ${input.buyQuantity} y paga ${input.payQuantity} en ${scopePhrase}${freeNote}.`
    }
    default:
      return null
  }
}

/** Frase de condicion de compra — `null` si no hay cantidad minima. */
export function buildConditionSentence(input: PromotionNarrativeInput): string | null {
  if (input.minQuantity == null) return null
  return `Cantidad/peso mínimo: ${input.minQuantity}.`
}

/** Frase de vigencia — nunca `null`: siempre hay algo que decir, aunque
 * sea "sin límite" (que es el caso mas comun, no un dato faltante). */
export function buildVigenciaSentence(input: PromotionNarrativeInput): string {
  const parts: string[] = []

  if (input.startDate && input.endDate) {
    parts.push(`del ${formatDateOnly(input.startDate)} al ${formatDateOnly(input.endDate)}`)
  } else if (input.startDate) {
    parts.push(`a partir del ${formatDateOnly(input.startDate)}`)
  } else if (input.endDate) {
    parts.push(`hasta el ${formatDateOnly(input.endDate)}`)
  }

  if (input.startTime && input.endTime) {
    parts.push(`de ${input.startTime} a ${input.endTime}`)
  }

  const days = (input.daysOfWeek ?? []).slice().sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  if (days.length > 0 && days.length < 7) {
    parts.push(`los ${days.map((day) => DAY_LABELS[day]).join(', ')}`)
  }

  if (parts.length === 0) {
    return 'Sin fecha ni horario límite.'
  }

  return `Válida ${parts.join(', ')}.`
}

/** Frase de combinacion con otras promociones — siempre hay algo que
 * decir (default `stackable: false`, mismo default que el formulario). */
export function buildCombinationSentence(input: PromotionNarrativeInput): string {
  const base = input.stackable
    ? 'Se puede combinar con otras promociones.'
    : 'No combinable con otras promociones.'

  return input.exclusiveGroup ? `${base} (grupo: ${input.exclusiveGroup})` : base
}

/** Todas las oraciones de una promocion, en el orden en que se muestran
 * en el Resumen/Drawer — omite `null`s (secciones sin suficiente info
 * todavia, ej. beneficio a medio llenar). */
export function buildPromotionNarrative(input: PromotionNarrativeInput): string[] {
  return [
    buildEffectSentence(input),
    buildConditionSentence(input),
    buildVigenciaSentence(input),
    buildCombinationSentence(input),
  ].filter((sentence): sentence is string => sentence !== null)
}

export interface PromotionPreviewExample {
  /** Nombre del producto de referencia (real, si hay uno seleccionado; generico si no). */
  label: string
  /** `true` si `label` corresponde a un producto real seleccionado, no al ejemplo generico. */
  isRealProduct: boolean
  before: number
  after: number
}

/** Precio de ejemplo cuando no hay un producto real seleccionado — mismo
 * numero usado en el brief aprobado ("Costilla ₡5.000"), como referencia
 * neutra y facil de entender para cualquier persona de la carniceria. */
const GENERIC_EXAMPLE_PRICE = 5000
const GENERIC_EXAMPLE_LABEL = 'Producto de ejemplo'

/** Vista previa numerica del beneficio — puramente visual (nunca se
 * envia al backend). `referenceProduct` es el primer producto
 * seleccionado con su precio real (`ProductForm`/`ScopeCards` lo resuelve
 * desde `useProducts`, ya cargado, sin pedir nada nuevo); si no hay
 * ninguno (Categoría/Carrito, o Producto/Combo sin seleccion todavia) se
 * usa el ejemplo generico. */
export function computePreviewExample(
  input: Pick<PromotionNarrativeInput, 'effectType' | 'effectValue' | 'buyQuantity' | 'payQuantity'>,
  referenceProduct?: { name: string; salePrice: number } | null,
): PromotionPreviewExample | null {
  const before = referenceProduct?.salePrice ?? GENERIC_EXAMPLE_PRICE
  const label = referenceProduct?.name ?? GENERIC_EXAMPLE_LABEL
  const isRealProduct = Boolean(referenceProduct)

  switch (input.effectType) {
    case 'PERCENTAGE':
      if (input.effectValue == null) return null
      return { label, isRealProduct, before, after: before * (1 - input.effectValue / 100) }
    case 'FIXED_AMOUNT':
      if (input.effectValue == null) return null
      return { label, isRealProduct, before, after: Math.max(0, before - input.effectValue) }
    case 'SPECIAL_PRICE':
      if (input.effectValue == null) return null
      return { label, isRealProduct, before, after: input.effectValue }
    case 'FIXED_PRICE':
      // Mismo resultado que SPECIAL_PRICE para este ejemplo puntual: esta
      // vista previa siempre simula EXACTAMENTE 1 unidad de referencia
      // (`before`/`after` son "por unidad" en ambos casos aca), asi que a
      // esta escala ambos efectos coinciden — la diferencia real entre
      // "precio TOTAL" (SPECIAL_PRICE) y "precio POR UNIDAD" (FIXED_PRICE)
      // solo se manifiesta con cantidad > 1, que esta funcion no simula
      // (ver `promotionProfitabilityPreview.ts`, que si la simula).
      if (input.effectValue == null) return null
      return { label, isRealProduct, before, after: input.effectValue }
    default:
      return null
  }
}
