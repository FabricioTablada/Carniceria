// src/features/products/schemas/product.schema.ts
import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  ChangeProductStatusDto,
  CreateProductDto,
  UpdateProductDto,
} from '../types/product.types'

/** Unidades de medida soportadas (enum `UnitOfMeasure` del backend). */
const unitOfMeasureSchema = z.enum(['KILOGRAM', 'UNIT'])

/**
 * Bloque 7.12: replica exacta de `CabysCodeSchema`
 * (modules/products/products.validation.ts, backend) — codigo CABYS
 * (Costa Rica), 13 digitos numericos exactos.
 */
const cabysCodeSchema = z
  .string()
  .min(1, 'El código CABYS es obligatorio.')
  .regex(/^\d{13}$/, 'El código CABYS debe tener exactamente 13 dígitos numéricos.')

/**
 * Replica exacta de `CreateProductSchema`
 * (modules/products/products.validation.ts, backend). Mismos campos,
 * mismas reglas, mismos mensajes. El backend usa `required_error` (Zod
 * v3); este proyecto usa Zod v4 (ver package.json), donde ese estilo de
 * opciones ya no existe, asi que el caracter "obligatorio" de cada campo
 * se expresa con `.min(1, mensaje)` (strings) o el mensaje corto de
 * `z.number(mensaje)` en vez de `required_error` — la regla de validacion
 * es identica, solo cambia la sintaxis de la API de Zod entre versiones.
 * Mismo criterio ya usado en `user.schema.ts` y `role.schema.ts`.
 */
export const createProductSchema: z.ZodType<CreateProductDto> = z.object({
  categoryId: z
    .string()
    .min(1, 'La categoria es obligatoria.')
    .regex(UUID_REGEX, 'La categoria debe ser un identificador valido.'),
  taxId: z
    .string()
    .min(1, 'El impuesto es obligatorio.')
    .regex(UUID_REGEX, 'El impuesto debe ser un identificador valido.'),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  name: z
    .string()
    .min(1, 'El nombre del producto es obligatorio.')
    .min(3, 'El nombre del producto debe tener al menos 3 caracteres.'),
  description: z.string().nullish(),
  unitOfMeasure: unitOfMeasureSchema.optional(),
  salePrice: z
    .number('El precio de venta es obligatorio.')
    .positive('El precio de venta debe ser un numero positivo.'),
  cost: z
    .number()
    .min(0, 'El costo debe ser mayor o igual a 0.'),
  // Bloque 7.12: obligatorio en creacion, mismo criterio que el backend.
  cabysCode: cabysCodeSchema,
  // Bloque COST-05: rango 0 <= valor < 100 (limite superior EXCLUSIVO,
  // distinto del `.max(100)` inclusive del backend) -- el CostEngine
  // (`shared/services/costEngine/`, backend) divide por
  // `(1 - wastePercent/100)`; a partir de 100 esa division es por cero o
  // negativa. El formulario nunca debe dejar cargar un valor que el motor
  // rechazaria al confirmar una venta.
  expectedWastePercent: z
    .number()
    .min(0, 'El porcentaje de merma esperada debe ser mayor o igual a 0.')
    .lt(100, 'El porcentaje de merma esperada debe ser menor a 100.')
    .optional(),
  applyExpectedWasteToCost: z.boolean().optional(),
  isVariableWeight: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  // Bloque LOTES-08: si este producto participa del Modulo de Lotes.
  requiresBatch: z.boolean().optional(),
  active: z.boolean().optional(),
})

/**
 * Replica exacta de `UpdateProductSchema` (backend): mismos campos que
 * `createProductSchema`, todos opcionales, sin `active` (el backend
 * maneja el cambio de estado por separado, en
 * `changeProductStatusSchema`).
 */
export const updateProductSchema: z.ZodType<UpdateProductDto> = z.object({
  categoryId: z
    .string()
    .regex(UUID_REGEX, 'La categoria debe ser un identificador valido.')
    .optional(),
  taxId: z
    .string()
    .regex(UUID_REGEX, 'El impuesto debe ser un identificador valido.')
    .optional(),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  name: z
    .string()
    .min(3, 'El nombre del producto debe tener al menos 3 caracteres.')
    .optional(),
  description: z.string().nullish(),
  unitOfMeasure: unitOfMeasureSchema.optional(),
  salePrice: z
    .number()
    .positive('El precio de venta debe ser un numero positivo.')
    .optional(),
  cost: z
    .number()
    .min(0, 'El costo debe ser mayor o igual a 0.'),
  // Bloque 7.12: opcional en edicion, valida formato si se envia.
  cabysCode: cabysCodeSchema.optional(),
  // Bloque COST-05: mismo criterio que `createProductSchema.expectedWastePercent`.
  expectedWastePercent: z
    .number()
    .min(0, 'El porcentaje de merma esperada debe ser mayor o igual a 0.')
    .lt(100, 'El porcentaje de merma esperada debe ser menor a 100.')
    .optional(),
  applyExpectedWasteToCost: z.boolean().optional(),
  isVariableWeight: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  // Bloque LOTES-08: mismo criterio que `createProductSchema.requiresBatch`.
  requiresBatch: z.boolean().optional(),
})

/** Replica exacta de `ChangeProductStatusSchema` (backend). */
export const changeProductStatusSchema: z.ZodType<ChangeProductStatusDto> =
  z.object({
    active: z.boolean('El estado activo es obligatorio.'),
  })