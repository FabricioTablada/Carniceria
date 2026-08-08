// src/features/customers/schemas/customer.schema.ts
import { z } from 'zod'
import type {
  ChangeCustomerStatusDto,
  CreateCustomerDto,
  UpdateCustomerDto,
} from '../types/customer.types'

/** Catalogo de tipos de identificacion soportados (mismo catalogo real de
 * Alegra Costa Rica, confirmado en el Bloque 7.13). */
const customerIdentificationTypeSchema = z.enum(['CF', 'CJ', 'DIMEX', 'NITE', 'PE'])

/**
 * Bloque 8.1 (analisis aprobado, punto 3): formato por tipo de
 * identificacion — replica exacta de `IDENTIFICATION_FORMATS`
 * (modules/customers/validation.ts, backend). Solo `CF` fue confirmado
 * empiricamente contra la cuenta real de Alegra (Bloque 7.13/7.14); los
 * otros 4 formatos son el formato oficial conocido de cada documento
 * costarricense, sin confirmar todavia contra la API real (deuda tecnica
 * documentada, a validar en el Bloque 8.4).
 */
const IDENTIFICATION_FORMATS: Record<string, { regex: RegExp; message: string }> = {
  CF: {
    regex: /^[1-9]\d{8}$/,
    message: 'La cédula física debe tener 9 dígitos, sin cero inicial ni guiones.',
  },
  CJ: {
    regex: /^\d{10}$/,
    message: 'La cédula jurídica debe tener 10 dígitos, sin guiones.',
  },
  DIMEX: {
    regex: /^\d{11,12}$/,
    message: 'El DIMEX debe tener 11 o 12 dígitos, sin guiones.',
  },
  NITE: {
    regex: /^\d{10}$/,
    message: 'El NITE debe tener 10 dígitos, sin guiones.',
  },
  PE: {
    regex: /^[A-Za-z0-9]{5,20}$/,
    message: 'El pasaporte debe tener entre 5 y 20 caracteres alfanuméricos.',
  },
}

/** Valida `identificationNumber` segun el `identificationType` recibido —
 * misma logica que `validateIdentificationFormat` (backend). */
function validateIdentificationFormat(
  data: { identificationType?: string; identificationNumber?: string },
  ctx: z.RefinementCtx,
) {
  if (!data.identificationType || !data.identificationNumber) {
    return
  }

  const format = IDENTIFICATION_FORMATS[data.identificationType]

  if (format && !format.regex.test(data.identificationNumber)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: format.message,
      path: ['identificationNumber'],
    })
  }
}

/**
 * Replica exacta de `CreateCustomerSchema`
 * (modules/customers/validation.ts, backend). Mismos campos, mismas
 * reglas, mismos mensajes. Mismo criterio ya usado en
 * `supplier.schema.ts`/`product.schema.ts`.
 */
export const createCustomerSchema: z.ZodType<CreateCustomerDto> = z
  .object({
    name: z
      .string()
      .min(1, 'El nombre del cliente es obligatorio.')
      .min(3, 'El nombre del cliente debe tener al menos 3 caracteres.'),
    identificationType: customerIdentificationTypeSchema,
    identificationNumber: z.string().min(1, 'El número de identificación es obligatorio.'),
    email: z.string().email('El correo electronico no es valido.').nullish(),
    phone: z.string().nullish(),
    address: z.string().nullish(),
    active: z.boolean().optional(),
  })
  .superRefine(validateIdentificationFormat)

/**
 * Replica exacta de `UpdateCustomerSchema` (backend): mismos campos que
 * `createCustomerSchema`, todos opcionales, sin `active` (el backend
 * maneja el cambio de estado por separado, en
 * `changeCustomerStatusSchema`).
 */
export const updateCustomerSchema: z.ZodType<UpdateCustomerDto> = z
  .object({
    name: z.string().min(3, 'El nombre del cliente debe tener al menos 3 caracteres.').optional(),
    identificationType: customerIdentificationTypeSchema.optional(),
    identificationNumber: z.string().min(1, 'El número de identificación es obligatorio.').optional(),
    email: z.string().email('El correo electronico no es valido.').nullish(),
    phone: z.string().nullish(),
    address: z.string().nullish(),
  })
  .superRefine(validateIdentificationFormat)

/** Replica exacta de `ChangeCustomerStatusSchema` (backend). */
export const changeCustomerStatusSchema: z.ZodType<ChangeCustomerStatusDto> = z.object({
  active: z.boolean('El estado activo es obligatorio.'),
})
