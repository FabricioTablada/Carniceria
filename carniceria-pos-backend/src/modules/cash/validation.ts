/**
 * modules/cash/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de caja.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `cash.service.ts`).
 *
 * Los esquemas se separan por agregado (`CashSession` / `CashMovement`) para
 * mantener clara la responsabilidad de cada operacion.
 *
 * NOTA: ninguno de los dos modelos tiene campo `active`, por lo que no
 * existe un esquema de cambio de estado en este modulo.
 *
 * REGLA CRITICA: `expectedAmount` y `difference` no forman parte de estos
 * esquemas. Siguiendo el mismo patron aprobado en Purchases/Sales, el
 * servicio los calcula siempre a partir de `openingAmount` y los
 * movimientos de caja registrados.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// CashSession: sesiones de caja
// ---------------------------------------------------------------------------

/** Estados soportados (enum `CashSessionStatus` de `schema.prisma`). */
const CashSessionStatusSchema = z.enum(['OPEN', 'CLOSED']);

/** Validacion del cuerpo de la peticion de apertura de sesion de caja.
 * `sucursalId` y `openedByUserId` no se validan aqui: los resuelve
 * `cash.controller.ts` desde `req.user` (adjuntado por
 * `authenticate.middleware.ts`), no desde el body — mismo criterio ya
 * aplicado en `sales.validation.ts` / `sales.controller.ts`. Ver
 * `OpenCashSessionDto` en `types.ts` para la forma completa que
 * efectivamente recibe el servicio. */
export const OpenCashSessionSchema = z.object({
  cashRegisterId: z
    .string({ required_error: 'La caja registradora es obligatoria.' })
    .uuid('La caja registradora debe ser un identificador valido.'),
  openingAmount: z
    .number({ required_error: 'El fondo inicial es obligatorio.' })
    .min(0, 'El fondo inicial debe ser mayor o igual a 0.'),
  notes: z.string().nullish(),
});

export type OpenCashSessionDto = z.infer<typeof OpenCashSessionSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de sesion de caja.
 * Los campos de apertura no se editan a traves de esta operacion. */
export const UpdateCashSessionSchema = z.object({
  notes: z.string().nullish(),
});

export type UpdateCashSessionDto = z.infer<typeof UpdateCashSessionSchema>;

/** Validacion del cuerpo de la peticion de cierre de sesion de caja.
 * `closedByUserId` no se valida aqui: lo resuelve `cash.controller.ts`
 * desde `req.user` (adjuntado por `authenticate.middleware.ts`), no
 * desde el body — mismo criterio ya aplicado en `OpenCashSessionSchema`
 * (hallazgo 3.2 de la auditoria). `expectedAmount` y `difference`
 * tampoco se validan aqui porque no se reciben del cliente: los calcula
 * `cash.service.ts`. */
export const CloseCashSessionSchema = z.object({
  closingAmount: z
    .number({ required_error: 'El monto contado es obligatorio.' })
    .min(0, 'El monto contado debe ser mayor o igual a 0.'),
  notes: z.string().nullish(),
});

export type CloseCashSessionDto = z.infer<typeof CloseCashSessionSchema>;

/** Validacion de los query params para el listado de sesiones de caja. */
export const ListCashSessionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  cashRegisterId: z
    .string()
    .uuid('La caja registradora debe ser un identificador valido.')
    .optional(),
  status: CashSessionStatusSchema.optional(),
});

export type ListCashSessionsQueryDto = z.infer<typeof ListCashSessionsQuerySchema>;

// ---------------------------------------------------------------------------
// CashMovement: movimientos de caja
// ---------------------------------------------------------------------------

/** Tipos soportados (enum `CashMovementType` de `schema.prisma`). */
const CashMovementTypeSchema = z.enum(['CASH_IN', 'CASH_OUT']);

/** Validacion del cuerpo de la peticion de registro de movimiento de caja.
 * `sucursalId` y `userId` NO se aceptan del cliente: se resuelven desde
 * `req.user` en `cash/controller.ts`, adjuntado por
 * `authenticate.middleware.ts` a partir del JWT. Mismo criterio ya
 * aplicado en `purchases/validation.ts`, `users.validation.ts` y
 * `cashRegister.validation.ts`. */
export const CreateCashMovementSchema = z.object({
  cashSessionId: z
    .string({ required_error: 'La sesion de caja es obligatoria.' })
    .uuid('La sesion de caja debe ser un identificador valido.'),
  type: CashMovementTypeSchema,
  amount: z
    .number({ required_error: 'El monto es obligatorio.' })
    .positive('El monto debe ser un numero positivo.'),
  reason: z
    .string({ required_error: 'El motivo es obligatorio.' })
    .min(3, 'El motivo debe tener al menos 3 caracteres.'),
});

export type CreateCashMovementDto = z.infer<typeof CreateCashMovementSchema>;

/** Validacion de los query params para el listado de movimientos de caja. */
export const ListCashMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  cashSessionId: z.string().uuid('La sesion de caja debe ser un identificador valido.').optional(),
  userId: z.string().uuid('El usuario debe ser un identificador valido.').optional(),
  type: CashMovementTypeSchema.optional(),
});

export type ListCashMovementsQueryDto = z.infer<typeof ListCashMovementsQuerySchema>;