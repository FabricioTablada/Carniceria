/**
 * modules/customers/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de clientes.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `customers.service.ts`).
 */
import { z } from 'zod';

/** Catalogo de tipos de identificacion soportados (mismo catalogo real de
 * Alegra Costa Rica, confirmado en el Bloque 7.13). */
const CustomerIdentificationTypeSchema = z.enum(['CF', 'CJ', 'DIMEX', 'NITE', 'PE']);

/**
 * Bloque 8.1 (analisis aprobado, punto 3): formato por tipo de
 * identificacion. Solo `CF` fue confirmado empiricamente contra la cuenta
 * real de Alegra (Bloque 7.13/7.14: 9 digitos, sin cero inicial, sin
 * guiones — rechazo real `400` codigo `2117` con un valor invalido). Los
 * otros 4 formatos NO fueron probados contra la API real todavia (deuda
 * tecnica documentada, a validar empiricamente en el Bloque 8.4 cuando se
 * integre con Alegra) — los regex de aca son el formato oficial conocido
 * de cada documento costarricense, usados como validacion razonable
 * mientras tanto, no como garantia de aceptacion por Alegra.
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
};

/** Valida `identificationNumber` segun el `identificationType` recibido —
 * reutilizada por creacion y actualizacion, misma regla en ambos casos. */
function validateIdentificationFormat(
  data: { identificationType?: string; identificationNumber?: string },
  ctx: z.RefinementCtx,
) {
  if (!data.identificationType || !data.identificationNumber) {
    return;
  }

  const format = IDENTIFICATION_FORMATS[data.identificationType];

  if (format && !format.regex.test(data.identificationNumber)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: format.message,
      path: ['identificationNumber'],
    });
  }
}

/** Validacion del cuerpo de la peticion de creacion de cliente. */
export const CreateCustomerSchema = z
  .object({
    name: z
      .string({ required_error: 'El nombre del cliente es obligatorio.' })
      .min(3, 'El nombre del cliente debe tener al menos 3 caracteres.'),
    identificationType: CustomerIdentificationTypeSchema,
    identificationNumber: z
      .string({ required_error: 'El número de identificación es obligatorio.' })
      .min(1, 'El número de identificación es obligatorio.'),
    email: z.string().email('El correo electronico no es valido.').nullish(),
    phone: z.string().nullish(),
    address: z.string().nullish(),
    active: z.boolean().optional(),
  })
  .superRefine(validateIdentificationFormat);

export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de cliente. */
export const UpdateCustomerSchema = z
  .object({
    name: z.string().min(3, 'El nombre del cliente debe tener al menos 3 caracteres.').optional(),
    identificationType: CustomerIdentificationTypeSchema.optional(),
    identificationNumber: z.string().min(1, 'El número de identificación es obligatorio.').optional(),
    email: z.string().email('El correo electronico no es valido.').nullish(),
    phone: z.string().nullish(),
    address: z.string().nullish(),
  })
  .superRefine(validateIdentificationFormat);

export type UpdateCustomerDto = z.infer<typeof UpdateCustomerSchema>;

/** Validacion de los query params para el listado de clientes. */
export const ListCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  search: z.string().optional(),
});

export type ListCustomersQueryDto = z.infer<typeof ListCustomersQuerySchema>;

/** Validacion de los query params para el lookup (selector) de clientes.
 * Arquitectura de selectores, Bloque 1: sin `page` (el lookup no es una
 * tabla paginable, ver `shared/utils/lookup.ts`). */
export const LookupCustomersQuerySchema = z.object({
  search: z.string().optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type LookupCustomersQueryDto = z.infer<typeof LookupCustomersQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de cliente. */
export const ChangeCustomerStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangeCustomerStatusDto = z.infer<typeof ChangeCustomerStatusSchema>;
