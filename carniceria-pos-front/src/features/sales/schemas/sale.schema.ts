import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  CreateSaleDto,
  CreateSaleItemDto,
  UpdateSaleDto,
} from '../types/sale.types'

/** Estados soportados (enum `SaleStatus` del backend). */
const saleStatusSchema = z.enum(['COMPLETED', 'CANCELLED', 'REFUNDED'])

/** Metodos de pago soportados (enum `PaymentMethod` del backend). */
const paymentMethodSchema = z.enum([
  'CASH',
  'CARD',
  'SINPE_MOVIL',
  'TRANSFER',
  'MIXED',
])

/** Tipos de descuento de carrito soportados (enum `SaleDiscountType` del
 * backend). */
const saleDiscountTypeSchema = z.enum(['NONE', 'PERCENTAGE', 'FIXED'])

/**
 * Replica exacta de `CreateSaleItemSchema` (modules/sales/validation.ts,
 * backend): mismos campos que `CreateSaleItemDto`, misma nulabilidad en
 * `taxId`, misma opcionalidad en `discount`.
 */
const createSaleItemSchema: z.ZodType<CreateSaleItemDto> = z.object({
  productId: z
    .string()
    .min(1, 'El producto es obligatorio.')
    .regex(UUID_REGEX, 'El producto debe ser un identificador valido.'),
  taxId: z.string().regex(UUID_REGEX, 'El impuesto debe ser un identificador valido.').nullish(),
  quantity: z
    .number('La cantidad es obligatoria.')
    .positive('La cantidad debe ser un numero positivo.'),
  unitPrice: z
    .number('El precio unitario es obligatorio.')
    .min(0, 'El precio unitario debe ser mayor o igual a 0.'),
  discount: z
    .number()
    .min(0, 'El descuento debe ser mayor o igual a 0.')
    .optional(),
})

/**
 * Replica exacta de `CreateSaleSchema` (modules/sales/validation.ts,
 * backend). Mismos campos, mismas reglas, mismos mensajes. El backend usa
 * `required_error` (Zod v3); este proyecto usa Zod v4 (ver package.json),
 * donde ese estilo de opciones ya no existe, asi que el caracter
 * "obligatorio" de cada campo se expresa con `.min(1, mensaje)` (strings)
 * o el mensaje corto de `z.number(mensaje)` en vez de `required_error` —
 * la regla de validacion es identica, solo cambia la sintaxis de la API
 * de Zod entre versiones. Mismo criterio ya usado en `user.schema.ts`,
 * `role.schema.ts`, `product.schema.ts` y `category.schema.ts`.
 *
 * `sucursalId` y `userId` ya no se validan aqui: el backend los resuelve
 * desde `req.user`, no desde el body (ver `CreateSaleDto` en
 * `sale.types.ts`).
 */
export const createSaleSchema: z.ZodType<CreateSaleDto> = z.object({
  cashSessionId: z
    .string()
    .min(1, 'La sesion de caja es obligatoria.')
    .regex(UUID_REGEX, 'La sesion de caja debe ser un identificador valido.'),
  documentNumber: z.string().nullish(),
  status: saleStatusSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  saleDate: z.string().optional(),
  amountPaid: z
    .number()
    .min(0, 'El monto pagado debe ser mayor o igual a 0.')
    .optional(),
  notes: z.string().nullish(),
  discountType: saleDiscountTypeSchema.optional(),
  discountValue: z
    .number()
    .min(0, 'El descuento no puede ser negativo.')
    .optional(),
  items: z
    .array(createSaleItemSchema)
    .min(1, 'La venta debe incluir al menos un detalle.'),
})

/**
 * Replica exacta de `UpdateSaleSchema` (backend): mismos campos que
 * `createSaleSchema` salvo `items` (los detalles no se editan por esta
 * via, igual que en el backend), todos opcionales.
 */
export const updateSaleSchema: z.ZodType<UpdateSaleDto> = z.object({
  sucursalId: z
    .string()
    .regex(UUID_REGEX, 'La sucursal debe ser un identificador valido.')
    .optional(),
  userId: z
    .string()
    .regex(UUID_REGEX, 'El usuario debe ser un identificador valido.')
    .optional(),
  cashSessionId: z
    .string()
    .regex(UUID_REGEX, 'La sesion de caja debe ser un identificador valido.')
    .optional(),
  documentNumber: z.string().nullish(),
  status: saleStatusSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  saleDate: z.string().optional(),
  amountPaid: z
    .number()
    .min(0, 'El monto pagado debe ser mayor o igual a 0.')
    .optional(),
  notes: z.string().nullish(),
})