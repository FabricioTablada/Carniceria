import { z } from 'zod'
import type {
  ChangeSupplierStatusDto,
  CreateSupplierDto,
  UpdateSupplierDto,
} from '../types/supplier.types'

/**
 * Replica exacta de `CreateSupplierSchema`
 * (modules/suppliers/validation.ts, backend). Mismos campos, mismas
 * reglas, mismos mensajes. El backend usa `required_error` (Zod v3); este
 * proyecto usa Zod v4 (ver package.json), donde ese estilo de opciones ya
 * no existe, asi que el caracter "obligatorio" del campo se expresa con
 * `.min(1, mensaje)` en vez de `required_error` — la regla de validacion
 * es identica, solo cambia la sintaxis de la API de Zod entre versiones.
 * Mismo criterio ya usado en `tax.schema.ts`, `category.schema.ts`,
 * `product.schema.ts`, `user.schema.ts` y `role.schema.ts`.
 */
export const createSupplierSchema: z.ZodType<CreateSupplierDto> = z.object({
  name: z
    .string()
    .min(1, 'El nombre del proveedor es obligatorio.')
    .min(3, 'El nombre del proveedor debe tener al menos 3 caracteres.'),
  legalId: z.string().nullish(),
  contactName: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email('El correo electronico no es valido.').nullish(),
  address: z.string().nullish(),
  active: z.boolean().optional(),
})

/**
 * Replica exacta de `UpdateSupplierSchema` (backend): mismos campos que
 * `createSupplierSchema`, todos opcionales, sin `active` (el backend
 * maneja el cambio de estado por separado, en
 * `changeSupplierStatusSchema`).
 */
export const updateSupplierSchema: z.ZodType<UpdateSupplierDto> = z.object({
  name: z
    .string()
    .min(3, 'El nombre del proveedor debe tener al menos 3 caracteres.')
    .optional(),
  legalId: z.string().nullish(),
  contactName: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email('El correo electronico no es valido.').nullish(),
  address: z.string().nullish(),
})

/** Replica exacta de `ChangeSupplierStatusSchema` (backend). */
export const changeSupplierStatusSchema: z.ZodType<ChangeSupplierStatusDto> =
  z.object({
    active: z.boolean('El estado activo es obligatorio.'),
  })