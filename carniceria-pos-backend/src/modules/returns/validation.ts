/**
 * modules/returns/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) del modulo de devoluciones. Base creada en
 * el Bloque 4.1, usada en el Bloque 4.2 por `returns.controller.ts`. NO
 * contiene logica de negocio (validar que la cantidad devuelta no supere
 * lo disponible requiere leer la base de datos — eso vive en
 * `returns.service.ts`, dentro de la transaccion).
 *
 * Mismo criterio que `sales.validation.ts`: `saleId`/`performedByUserId` no
 * se validan aqui — viajan por la ruta y por `req.user` respectivamente,
 * nunca por el body.
 */
import { z } from 'zod';

/** Metodos de pago / reembolso soportados (enum `PaymentMethod` de
 * `schema.prisma`). Misma lista que `sales.validation.ts`. */
const PaymentMethodSchema = z.enum(['CASH', 'CARD', 'SINPE_MOVIL', 'TRANSFER', 'MIXED']);

/** Validacion de una linea de devolucion dentro del cuerpo de creacion.
 * `unitPrice`/`lineTotal` no se validan aqui: los calcula el servicio a
 * partir de la `SaleItem` original, nunca se reciben del cliente.
 * `restock` opcional (Bloque 4.2, ver `CreateSaleReturnItemDto` en
 * `types.ts`): decision de negocio todavia no cerrada, sin forzar un
 * valor. */
const CreateSaleReturnItemSchema = z.object({
  saleItemId: z
    .string({ required_error: 'La línea de venta es obligatoria.' })
    .uuid('La línea de venta debe ser un identificador válido.'),
  quantity: z
    .number({ required_error: 'La cantidad es obligatoria.' })
    .positive('La cantidad debe ser un número positivo.'),
  restock: z.boolean().optional(),
});

/** Validacion del cuerpo de la peticion de creacion de devolucion. `saleId`
 * SI se valida aqui (a diferencia de `VoidSaleSchema`/`CorrectSaleSchema`,
 * donde la venta viaja en la ruta): este modulo se monta bajo su propio
 * prefijo `/returns`, no anidado bajo `/sales` — ver `CreateSaleReturnDto`
 * en `types.ts`. `reason` es obligatorio, mismo criterio que
 * `VoidSaleSchema`/`CorrectSaleSchema` en `sales.validation.ts`: una
 * devolucion es una accion administrativa que exige justificacion.
 * `cashSessionId`: la sesion que emite el reembolso, mismo criterio que
 * `CreateSaleSchema.cashSessionId`. */
export const CreateSaleReturnSchema = z.object({
  saleId: z
    .string({ required_error: 'La venta es obligatoria.' })
    .uuid('La venta debe ser un identificador válido.'),
  cashSessionId: z
    .string({ required_error: 'La sesión de caja es obligatoria.' })
    .uuid('La sesión de caja debe ser un identificador válido.'),
  reason: z
    .string({ required_error: 'El motivo de la devolución es obligatorio.' })
    .trim()
    .min(1, 'El motivo de la devolución es obligatorio.'),
  refundMethod: PaymentMethodSchema,
  items: z
    .array(CreateSaleReturnItemSchema)
    .min(1, 'La devolución debe incluir al menos un producto.'),
});

export type CreateSaleReturnBodyDto = z.infer<typeof CreateSaleReturnSchema>;

/** Validacion de los query params para un futuro listado de devoluciones
 * (`GET /returns`, todavia sin implementar). */
export const ListSaleReturnsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  saleId: z.string().uuid('La venta debe ser un identificador válido.').optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador válido.').optional(),
  cashSessionId: z.string().uuid('La sesión de caja debe ser un identificador válido.').optional(),
  userId: z.string().uuid('El usuario debe ser un identificador válido.').optional(),
});

export type ListSaleReturnsQueryDto = z.infer<typeof ListSaleReturnsQuerySchema>;
