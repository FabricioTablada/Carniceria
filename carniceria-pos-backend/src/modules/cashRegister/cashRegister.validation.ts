/**
 * modules/cashRegister/cashRegister.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de cajas registradoras.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `cashRegister.service.ts`).
 */
import { z } from 'zod';

/** Validacion del cuerpo de la peticion de creacion de caja registradora.
 * `sucursalId` NO se acepta del cliente: se resuelve desde `req.user` en
 * `cashRegister.controller.ts`, adjuntado por `authenticate.middleware.ts`
 * a partir del JWT. Mismo criterio ya aplicado en
 * `purchases/validation.ts` (`CreatePurchaseSchema`) y
 * `users.validation.ts` (`CreateUserSchema`). */
export const CreateCashRegisterSchema = z.object({
  name: z
    .string({ required_error: 'El nombre de la caja registradora es obligatorio.' })
    .min(3, 'El nombre de la caja registradora debe tener al menos 3 caracteres.'),
  active: z.boolean().optional(),
});

export type CreateCashRegisterDto = z.infer<typeof CreateCashRegisterSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de caja
 * registradora. */
export const UpdateCashRegisterSchema = z.object({
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  name: z
    .string()
    .min(3, 'El nombre de la caja registradora debe tener al menos 3 caracteres.')
    .optional(),
});

export type UpdateCashRegisterDto = z.infer<typeof UpdateCashRegisterSchema>;

/** Validacion de los query params para el listado de cajas registradoras. */
export const ListCashRegistersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
  search: z.string().optional(),
});

export type ListCashRegistersQueryDto = z.infer<typeof ListCashRegistersQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de caja
 * registradora. */
export const ChangeCashRegisterStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangeCashRegisterStatusDto = z.infer<typeof ChangeCashRegisterStatusSchema>;