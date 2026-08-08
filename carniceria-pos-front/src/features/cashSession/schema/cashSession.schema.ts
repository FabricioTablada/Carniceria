import { z } from 'zod'
import { UUID_REGEX } from '@/lib/validation'
import type {
  CloseCashSessionDto,
  CreateCashMovementDto,
  OpenCashSessionDto,
} from '../types/cashSession.types'

/**
 * Replica exacta de `OpenCashSessionSchema`
 * (modules/cash/validation.ts, backend) tras el ajuste de contrato del
 * Sprint de Seguridad + Integracion: valida unicamente `cashRegisterId`,
 * `openingAmount` y `notes`. `sucursalId` y `openedByUserId` ya no
 * forman parte del contrato del cliente — el backend los resuelve desde
 * `req.user`, por lo que tampoco se validan aqui.
 *
 * El backend usa `required_error` (Zod v3); este proyecto usa Zod v4 (ver
 * package.json), donde ese estilo de opciones ya no existe, asi que el
 * caracter "obligatorio" de cada campo se expresa con `.min(1, mensaje)`
 * (strings) o el mensaje corto de `z.number(mensaje)` en vez de
 * `required_error` — la regla de validacion es identica, solo cambia la
 * sintaxis de la API de Zod entre versiones. Mismo criterio ya usado en
 * `user.schema.ts`, `role.schema.ts`, `product.schema.ts`,
 * `category.schema.ts`, `sale.schema.ts`, `purchase.schema.ts` e
 * `inventory.schema.ts`.
 */
export const openCashSessionSchema: z.ZodType<OpenCashSessionDto> = z.object({
  cashRegisterId: z
    .string()
    .min(1, 'La caja registradora es obligatoria.')
    .regex(UUID_REGEX, 'La caja registradora debe ser un identificador valido.'),
  openingAmount: z
    .number('El fondo inicial es obligatorio.')
    .min(0, 'El fondo inicial debe ser mayor o igual a 0.'),
  notes: z.string().nullish(),
})

/**
 * Replica exacta de `CloseCashSessionSchema` (modules/cash/validation.ts,
 * backend): valida unicamente `closingAmount` y `notes`. `closedByUserId`
 * NO se valida aqui — el backend lo resuelve desde `req.user`, mismo
 * criterio que `openCashSessionSchema`.
 */
export const closeCashSessionSchema: z.ZodType<CloseCashSessionDto> = z.object({
  closingAmount: z
    .number('El monto contado es obligatorio.')
    .min(0, 'El monto contado debe ser mayor o igual a 0.'),
  notes: z.string().nullish(),
})

/**
 * Replica exacta de `CreateCashMovementSchema` (modules/cash/validation.ts,
 * backend): valida `cashSessionId`, `type`, `amount` (positivo) y `reason`
 * (minimo 3 caracteres). `sucursalId` y `userId` NO se validan aqui — el
 * backend los resuelve desde `req.user`, mismo criterio que
 * `openCashSessionSchema`/`closeCashSessionSchema`.
 */
export const createCashMovementSchema: z.ZodType<CreateCashMovementDto> = z.object({
  cashSessionId: z
    .string()
    .min(1, 'La sesion de caja es obligatoria.')
    .regex(UUID_REGEX, 'La sesion de caja debe ser un identificador valido.'),
  type: z.enum(['CASH_IN', 'CASH_OUT'], 'El tipo de movimiento es obligatorio.'),
  amount: z
    .number('El monto es obligatorio.')
    .positive('El monto debe ser un numero positivo.'),
  reason: z
    .string()
    .min(3, 'El motivo debe tener al menos 3 caracteres.'),
})