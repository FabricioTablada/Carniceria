import { z } from 'zod'
import type { AlegraTestConnectionDto, SaveAlegraConfigDto } from '../types/alegra.types'

/**
 * features/settings/schemas/alegra.schema.ts
 * -----------------------------------------------------------------------------
 * Replica del contrato de `POST /integrations/alegra/config` (backend,
 * `alegra.validation.ts`, Bloque 7.4). `token` queda opcional a propósito:
 * vacío significa "conservar el token ya guardado" (el backend resuelve
 * esa regla, no este schema — ver `AlegraConfigForm.tsx`).
 *
 * Dos `z.object` independientes (no `.extend()` uno sobre el otro): mismo
 * criterio que `configuration.schema.ts` (`createConfigurationSchema`/
 * `updateConfigurationSchema` separados), necesario porque cada uno se
 * tipa contra un DTO distinto (`SaveAlegraConfigDto` con `token` opcional
 * vs. `AlegraTestConnectionDto` con `token` obligatorio).
 */
export const saveAlegraConfigSchema: z.ZodType<SaveAlegraConfigDto> = z.object({
  email: z.string().min(1, 'El correo de Alegra es obligatorio.').email('El correo de Alegra no es válido.'),
  token: z.string().optional(),
  baseUrl: z.string().min(1, 'La URL base es obligatoria.').url('La URL base debe ser una URL válida.'),
})

/** "Probar conexión" (Bloque 7.3, reutilizado tal cual) SÍ exige el token
 * en el formulario: a diferencia de "Guardar", no existe un valor previo
 * que conservar cuando se está probando con lo que el usuario acaba de
 * escribir. */
export const testAlegraConnectionSchema: z.ZodType<AlegraTestConnectionDto> = z.object({
  email: z.string().min(1, 'El correo de Alegra es obligatorio.').email('El correo de Alegra no es válido.'),
  token: z.string().min(1, 'El token de Alegra es obligatorio para probar la conexión.'),
  baseUrl: z.string().min(1, 'La URL base es obligatoria.').url('La URL base debe ser una URL válida.'),
})
