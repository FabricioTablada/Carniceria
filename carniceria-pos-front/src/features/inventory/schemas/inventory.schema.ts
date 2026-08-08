import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  CreateInventoryDto,
  CreateInventoryWasteDto,
  UpdateInventoryDto,
} from '../types/inventory.types'

/**
 * Replica exacta de `CreateInventorySchema`
 * (modules/inventory/validation.ts, backend). Mismos campos, mismas
 * reglas, mismos mensajes. El backend usa `required_error` (Zod v3); este
 * proyecto usa Zod v4 (ver package.json), donde ese estilo de opciones ya
 * no existe, asi que el caracter "obligatorio" de cada campo se expresa
 * con `.min(1, mensaje)` en vez de `required_error` — la regla de
 * validacion es identica, solo cambia la sintaxis de la API de Zod entre
 * versiones. Mismo criterio ya usado en `user.schema.ts`, `role.schema.ts`,
 * `product.schema.ts`, `category.schema.ts` y `sale.schema.ts`.
 */
export const createInventorySchema: z.ZodType<CreateInventoryDto> = z.object({
  sucursalId: z
    .string()
    .min(1, 'La sucursal es obligatoria.')
    .regex(UUID_REGEX, 'La sucursal debe ser un identificador valido.'),
  productId: z
    .string()
    .min(1, 'El producto es obligatorio.')
    .regex(UUID_REGEX, 'El producto debe ser un identificador valido.'),
  quantity: z
    .number()
    .min(0, 'La cantidad debe ser mayor o igual a 0.')
    .optional(),
  reorderPoint: z
    .number()
    .min(0, 'El punto de reorden debe ser mayor o igual a 0.')
    .nullish(),
})

/**
 * Replica exacta de `UpdateInventorySchema` (backend): mismos campos que
 * `createInventorySchema`, todos opcionales.
 */
export const updateInventorySchema: z.ZodType<UpdateInventoryDto> = z.object({
  sucursalId: z
    .string()
    .regex(UUID_REGEX, 'La sucursal debe ser un identificador valido.')
    .optional(),
  productId: z
    .string()
    .regex(UUID_REGEX, 'El producto debe ser un identificador valido.')
    .optional(),
  quantity: z
    .number()
    .min(0, 'La cantidad debe ser mayor o igual a 0.')
    .optional(),
  reorderPoint: z
    .number()
    .min(0, 'El punto de reorden debe ser mayor o igual a 0.')
    .nullish(),
})

const WASTE_REASON_VALUES = [
  'RETURNED_NOT_RESTOCKED',
  'EXPIRED',
  'DAMAGED',
  'PRODUCTION_ERROR',
  'CUTTING_ERROR',
  'PACKAGING_ERROR',
  'COLD_CHAIN_FAILURE',
  'OTHER',
] as const

/**
 * Bloque 5.4. Replica de `CreateInventoryWasteSchema`
 * (modules/inventoryWaste/validation.ts, backend), mismo criterio de
 * archivo (Zod v4, `.min(1, mensaje)` en vez de `required_error`).
 *
 * `maxQuantity` (unico agregado respecto al backend, puramente de UX): la
 * cantidad nunca puede superar el stock disponible — el backend ya lo
 * valida de forma autoritativa dentro de su transaccion (Bloque 5.3,
 * releido en el momento); esto solo evita el viaje de red para el caso
 * invalido, mismo criterio ya usado en `hasInvalidDiscount`/
 * `hasMissingPaymentReference` de `SalesPOSPage.tsx`. Se arma como fabrica
 * (no un schema estatico) porque el maximo cambia por fila de inventario.
 *
 * `batchContext` (Corrección de sincronización Mermas/Lotes, aprobada):
 * mismo criterio que `maxQuantity` — validación de UX que anticipa, sin
 * duplicarlas, las mismas reglas que el backend ya aplica dentro de su
 * transacción (`inventoryWaste/service.ts::createWasteTransaction`):
 * lote obligatorio para productos `requiresBatch: true`, y la cantidad no
 * puede superar el saldo disponible DEL LOTE elegido (más estricto que
 * `maxQuantity`, que solo mira el agregado).
 */
export function createInventoryWasteSchema(
  maxQuantity: number,
  batchContext?: {
    required: boolean
    availableQuantityById: Map<string, number>
  },
): z.ZodType<CreateInventoryWasteDto> {
  return z
    .object({
      sucursalId: z
        .string()
        .min(1, 'La sucursal es obligatoria.')
        .regex(UUID_REGEX, 'La sucursal debe ser un identificador valido.'),
      productId: z
        .string()
        .min(1, 'El producto es obligatorio.')
        .regex(UUID_REGEX, 'El producto debe ser un identificador valido.'),
      reason: z.enum(WASTE_REASON_VALUES, {
        message: 'El origen de la merma es obligatorio.',
      }),
      notes: z.string().trim().nullish(),
      quantity: z
        .number()
        .positive('La cantidad debe ser un número positivo.')
        .max(maxQuantity, `La cantidad no puede superar el stock disponible (${maxQuantity}).`),
      sourceReturnItemId: z.string().regex(UUID_REGEX).nullish(),
      // Corrección de sincronización Mermas/Lotes (aprobada): el backend
      // ya validaba este campo (`modules/inventoryWaste/validation.ts`);
      // faltaba únicamente acá, así que `zodResolver` lo descartaba antes
      // de que llegara a la petición. `InventoryWasteForm.tsx` decide si
      // es obligatorio (producto con `requiresBatch: true`).
      batchId: z.string().regex(UUID_REGEX).nullish(),
    })
    .refine((data) => data.reason !== 'OTHER' || Boolean(data.notes && data.notes.trim().length > 0), {
      message: 'Debe indicar una observación cuando el origen es "Otro".',
      path: ['notes'],
    })
    .refine((data) => !batchContext?.required || Boolean(data.batchId), {
      message: 'Seleccioná el lote del que se descuenta esta merma.',
      path: ['batchId'],
    })
    .refine(
      (data) => {
        if (!data.batchId) return true
        const batchAvailable = batchContext?.availableQuantityById.get(data.batchId)
        return batchAvailable === undefined || data.quantity <= batchAvailable
      },
      { message: 'La cantidad no puede superar el saldo disponible del lote seleccionado.', path: ['quantity'] },
    )
}