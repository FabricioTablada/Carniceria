import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  CreatePurchaseDto,
  CreatePurchaseItemDto,
  UpdatePurchaseDto,
} from '../types/purchase.types'

/** Estados soportados (enum `PurchaseStatus` del backend). */
const purchaseStatusSchema = z.enum(['DRAFT', 'RECEIVED', 'CANCELLED'])

/**
 * Replica exacta de `CreatePurchaseItemSchema`
 * (modules/purchases/validation.ts, backend): mismos campos que
 * `CreatePurchaseItemDto`, misma nulabilidad en `taxId`.
 *
 * Divergencia deliberada respecto del backend: `unitCost` exige `.positive()`
 * aqui (el backend acepta 0) porque un costo unitario de 0 en una compra real
 * es casi siempre un dato faltante, no un valor valido — mismo criterio de
 * "validar en el frontend lo que el backend deja pasar mas laxo mediante un
 * 400 generico" ya aplicado a `purchaseDate` en `createPurchaseSchema`.
 */
const createPurchaseItemSchema: z.ZodType<CreatePurchaseItemDto> = z.object({
  productId: z
    .string()
    .min(1, 'Debe seleccionar un producto.')
    .regex(UUID_REGEX, 'El producto debe ser un identificador valido.'),
  taxId: z.string().regex(UUID_REGEX, 'El impuesto debe ser un identificador valido.').nullish(),
  quantity: z
    .number('La cantidad es obligatoria.')
    .positive('La cantidad debe ser mayor que cero.'),
  unitCost: z
    .number('El costo unitario es obligatorio.')
    .positive('El costo unitario debe ser mayor que cero.'),
  // Bloque COST-06.1: mismo rango que `Product.expectedWastePercent`
  // (Bloque 14.4) — opcional, `null`/ausente = esta linea no especifica
  // una merma de lote.
  expectedWastePercent: z
    .number()
    .min(0, 'El porcentaje de merma esperada debe ser mayor o igual a 0.')
    .max(100, 'El porcentaje de merma esperada debe ser menor o igual a 100.')
    .nullish(),
  // Bloque LOTES-09: trazabilidad de lote de esta línea — visible en
  // `PurchaseItemRow.tsx` solo cuando el producto elegido tiene
  // `requiresBatch`. Se valida FORMATO/orden aquí (chequeo temprano de
  // UX); la regla autoritativa (contra la fecha de compra real) ya vive
  // en `batches/service.ts::create()` del backend y no se duplica aquí.
  supplierLotCode: z.string().nullish(),
  productionDate: z.string().nullish(),
  expiryDate: z.string().nullish(),
})
  .refine(
    (item) =>
      !item.productionDate || !item.expiryDate || item.expiryDate >= item.productionDate,
    {
      message: 'La fecha de vencimiento no puede ser anterior a la fecha de producción.',
      path: ['expiryDate'],
    },
  )

/**
 * Replica exacta de `CreatePurchaseSchema` (modules/purchases/validation.ts,
 * backend). Mismos campos, mismas reglas, mismos mensajes. El backend usa
 * `required_error` (Zod v3); este proyecto usa Zod v4 (ver package.json),
 * donde ese estilo de opciones ya no existe, asi que el caracter
 * "obligatorio" de cada campo se expresa con `.min(1, mensaje)` (strings)
 * o el mensaje corto de `z.number(mensaje)` en vez de `required_error` —
 * la regla de validacion es identica, solo cambia la sintaxis de la API
 * de Zod entre versiones. Mismo criterio ya usado en `user.schema.ts`,
 * `product.schema.ts`, `category.schema.ts`, `sale.schema.ts` e
 * `inventory.schema.ts`.
 *
 * Sin `sucursalId` ni `userId`: el backend los resuelve desde `req.user`
 * (JWT), no los acepta del cliente (mismo criterio ya aplicado en Sales y
 * en `openSession`/`closeSession` de Cash) — ver la nota correspondiente
 * en `purchase.types.ts`.
 *
 * Divergencia deliberada respecto del backend: `purchaseDate` es opcional
 * en `CreatePurchaseDto`/`CreatePurchaseSchema` (el backend, si se omite,
 * usa la fecha actual), pero aqui se exige no-vacio con `.min(1, ...)`. La
 * razon es el bug reportado: el `<input type="date">` de
 * `PurchaseHeaderFields.tsx` registra un string vacio ('') cuando el
 * usuario no elige fecha - un string vacio pasa `.optional()` (sigue
 * siendo `string`, no `undefined`), asi que ese valor invalido llegaba tal
 * cual al backend y volvia como un 400 generico. Exigir `.min(1)` aqui
 * evita esa peticion y le pide al cajero elegir una fecha, en vez de
 * mostrarle "Request failed with status code 400".
 */
export const createPurchaseSchema: z.ZodType<CreatePurchaseDto> = z.object({
  supplierId: z
    .string()
    .min(1, 'Debe seleccionar un proveedor.')
    .regex(UUID_REGEX, 'El proveedor debe ser un identificador valido.'),
  documentNumber: z.string().nullish(),
  status: purchaseStatusSchema.optional(),
  purchaseDate: z.string().min(1, 'Debe seleccionar una fecha de compra.'),
  notes: z.string().nullish(),
  items: z
    .array(createPurchaseItemSchema)
    .min(1, 'Debe agregar al menos un producto.'),
})

/**
 * Replica exacta de `UpdatePurchaseSchema` (backend): mismos campos que
 * `createPurchaseSchema` salvo `items` (los detalles no se editan por
 * esta via, igual que en el backend), todos opcionales.
 */
export const updatePurchaseSchema: z.ZodType<UpdatePurchaseDto> = z.object({
  sucursalId: z
    .string()
    .regex(UUID_REGEX, 'La sucursal debe ser un identificador valido.')
    .optional(),
  supplierId: z
    .string()
    .regex(UUID_REGEX, 'El proveedor debe ser un identificador valido.')
    .optional(),
  userId: z
    .string()
    .regex(UUID_REGEX, 'El usuario debe ser un identificador valido.')
    .optional(),
  documentNumber: z.string().nullish(),
  status: purchaseStatusSchema.optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().nullish(),
})