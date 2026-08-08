import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  ChangeUserStatusDto,
  CreateUserDto,
  UpdateUserDto,
} from '../types/user.types'

/**
 * Replica exacta de `CreateUserSchema` (modules/users/users.validation.ts,
 * backend). Mismos campos, mismas reglas, mismos mensajes. El backend usa
 * `required_error`/`invalid_type_error` (Zod v3); este proyecto usa Zod v4
 * (ver package.json), donde ese estilo de opciones ya no existe, asi que el
 * caracter "obligatorio" de cada campo se expresa con `.min(1, mensaje)` en
 * vez de `required_error` — la regla de validacion es identica, solo cambia
 * la sintaxis de la API de Zod entre versiones.
 *
 * `sucursalId` NO es un campo de este schema: el backend nunca lo acepta
 * del cliente en `POST /users` (lo resuelve del lado del servidor desde
 * `req.user.sucursalId`, ver `users.controller.ts`) — sistema de una sola
 * sucursal.
 */
export const createUserSchema: z.ZodType<CreateUserDto> = z.object({
  roleId: z
    .string()
    .min(1, 'El rol es obligatorio.')
    .regex(UUID_REGEX, 'El rol debe ser un identificador valido.'),
  username: z
    .string()
    .min(1, 'El nombre de usuario es obligatorio.')
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z
    .string()
    .email('El correo electronico no es valido.')
    .nullish(),
  fullName: z
    .string()
    .min(1, 'El nombre completo es obligatorio.')
    .min(3, 'El nombre completo debe tener al menos 3 caracteres.'),
  password: z
    .string()
    .min(1, 'La contrasena es obligatoria.')
    .min(8, 'La contrasena debe tener al menos 8 caracteres.')
    .regex(/[A-Z]/, 'La contrasena debe tener al menos una letra mayuscula.')
    .regex(/[a-z]/, 'La contrasena debe tener al menos una letra minuscula.')
    .regex(/[0-9]/, 'La contrasena debe tener al menos un numero.'),
  active: z.boolean().optional(),
})

/**
 * Replica exacta de `UpdateUserSchema` (backend): mismos campos que
 * `createUserSchema`, todos opcionales, sin `active` (el backend maneja el
 * cambio de estado por separado, en `changeUserStatusSchema`).
 */
export const updateUserSchema: z.ZodType<UpdateUserDto> = z.object({
  sucursalId: z
    .string()
    .regex(UUID_REGEX, 'La sucursal debe ser un identificador valido.')
    .optional(),
  roleId: z
    .string()
    .regex(UUID_REGEX, 'El rol debe ser un identificador valido.')
    .optional(),
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
    .optional(),
  email: z
    .string()
    .email('El correo electronico no es valido.')
    .nullish(),
  fullName: z
    .string()
    .min(3, 'El nombre completo debe tener al menos 3 caracteres.')
    .optional(),
  password: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres.')
    .regex(/[A-Z]/, 'La contrasena debe tener al menos una letra mayuscula.')
    .regex(/[a-z]/, 'La contrasena debe tener al menos una letra minuscula.')
    .regex(/[0-9]/, 'La contrasena debe tener al menos un numero.')
    .optional(),
})

/** Replica exacta de `ChangeUserStatusSchema` (backend). */
export const changeUserStatusSchema: z.ZodType<ChangeUserStatusDto> = z.object({
  active: z.boolean('El estado activo es obligatorio.'),
})