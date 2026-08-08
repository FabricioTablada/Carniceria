/**
 * modules/configuration/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de configuracion funcional del
 * sistema. Define la forma y las reglas de los datos de entrada; no
 * contiene logica de negocio (esa vive en `configuration.service.ts`).
 *
 * NOTA: el modelo `Configuration` no tiene campo `active`, por lo que no
 * existe un esquema de cambio de estado en este modulo.
 */
import { z } from 'zod';

/** Tipos de valor soportados, documentados como comentario sobre el campo
 * `type` en `schema.prisma` (`"string" | "number" | "boolean" | "json"`). */
const ConfigurationValueTypeSchema = z.enum(['string', 'number', 'boolean', 'json']);

/** Validacion del cuerpo de la peticion de creacion de configuracion.
 * `sucursalId` NO se acepta del cliente: se resuelve desde `req.user` en
 * el controller (`configuration.controller.ts`), adjuntado por
 * `authenticate.middleware.ts` a partir del JWT. Mismo criterio ya
 * aplicado en `purchases/validation.ts` (`CreatePurchaseSchema`). */
export const CreateConfigurationSchema = z.object({
  key: z
    .string({ required_error: 'La clave es obligatoria.' })
    .min(1, 'La clave no puede estar vacia.'),
  value: z.string({ required_error: 'El valor es obligatorio.' }),
  type: ConfigurationValueTypeSchema.optional(),
  description: z.string().nullish(),
});

export type CreateConfigurationDto = z.infer<typeof CreateConfigurationSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de configuracion. */
export const UpdateConfigurationSchema = z.object({
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  key: z.string().min(1, 'La clave no puede estar vacia.').optional(),
  value: z.string().optional(),
  type: ConfigurationValueTypeSchema.optional(),
  description: z.string().nullish(),
});

export type UpdateConfigurationDto = z.infer<typeof UpdateConfigurationSchema>;

/** Validacion de los query params para el listado de configuraciones. */
export const ListConfigurationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  type: ConfigurationValueTypeSchema.optional(),
  search: z.string().optional(),
});

export type ListConfigurationsQueryDto = z.infer<typeof ListConfigurationsQuerySchema>;