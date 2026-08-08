/**
 * modules/auth/auth.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de autenticacion.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `auth.service.ts`).
 */
import { z } from 'zod';

/** Validacion del cuerpo de la peticion de inicio de sesion. */
export const LoginSchema = z.object({
  username: z
    .string({ required_error: 'El nombre de usuario es obligatorio.' })
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  password: z
    .string({ required_error: 'La contrasena es obligatoria.' })
    .min(8, 'La contrasena debe tener al menos 8 caracteres.'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

/** Validacion del cuerpo de la peticion de refresco de token. */
export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'El token de refresco es obligatorio.' })
    .min(1, 'El token de refresco es obligatorio.'),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;

/**
 * Validacion del cuerpo de la peticion de verificacion de contrasena
 * (Bloque 7.24, pantalla de bloqueo por inactividad) — mismas reglas que
 * `LoginSchema.password`, sin `username` (el usuario ya esta autenticado
 * vía `authenticate`, ver `auth.routes.ts`).
 */
export const VerifyPasswordSchema = z.object({
  password: z
    .string({ required_error: 'La contrasena es obligatoria.' })
    .min(8, 'La contrasena debe tener al menos 8 caracteres.'),
});

export type VerifyPasswordDto = z.infer<typeof VerifyPasswordSchema>;
