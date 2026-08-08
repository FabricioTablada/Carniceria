/**
 * modules/products/products.validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de productos.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `products.service.ts`).
 */
import { z } from 'zod';

/** Unidades de medida soportadas (enum `UnitOfMeasure` de `schema.prisma`). */
const UnitOfMeasureSchema = z.enum(['KILOGRAM', 'UNIT']);

/** Bloque 7.12: codigo CABYS (Catalogo de Bienes y Servicios, Costa Rica) —
 * 13 digitos numericos exactos, exigido por Hacienda para facturacion
 * electronica (enviado como `productKey` a Alegra). */
const CabysCodeSchema = z
  .string({ required_error: 'El código CABYS es obligatorio.' })
  .regex(/^\d{13}$/, 'El código CABYS debe tener exactamente 13 dígitos numéricos.');

/** Validacion del cuerpo de la peticion de creacion de producto. */
export const CreateProductSchema = z.object({
  categoryId: z
    .string({ required_error: 'La categoria es obligatoria.' })
    .uuid('La categoria debe ser un identificador valido.'),
  taxId: z
    .string({ required_error: 'El impuesto es obligatorio.' })
    .uuid('El impuesto debe ser un identificador valido.'),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  name: z
    .string({ required_error: 'El nombre del producto es obligatorio.' })
    .min(3, 'El nombre del producto debe tener al menos 3 caracteres.'),
  description: z.string().nullish(),
  unitOfMeasure: UnitOfMeasureSchema.optional(),
  salePrice: z
    .number({ required_error: 'El precio de venta es obligatorio.' })
    .positive('El precio de venta debe ser un numero positivo.'),
  cost: z.number().min(0, 'El costo debe ser mayor o igual a 0.'),
  // Bloque 7.12: obligatorio en creacion — todo producto vendible pasa por
  // el flujo de facturacion electronica automatica (Bloque 7.11), asi que
  // necesita su clave CABYS desde que se crea.
  cabysCode: CabysCodeSchema,
  // Bloque 14.4 (Mermas esperadas): porcentaje esperado de merma del
  // producto, acotado a 0-100 igual que cualquier otro porcentaje del
  // sistema (mismo rango que `SaleDiscountType: 'PERCENTAGE'`).
  expectedWastePercent: z
    .number()
    .min(0, 'El porcentaje de merma esperada debe ser mayor o igual a 0.')
    .max(100, 'El porcentaje de merma esperada debe ser menor o igual a 100.')
    .optional(),
  // Bloque COST-01.1: si este producto participa de la regla de "costo
  // efectivo por merma esperada" (CostEngine). Sin uso real todavia — el
  // motor no esta integrado con ningun consumidor en este bloque.
  applyExpectedWasteToCost: z.boolean().optional(),
  isVariableWeight: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  // Bloque LOTES-08: si este producto participa del Modulo de Lotes.
  requiresBatch: z.boolean().optional(),
  active: z.boolean().optional(),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;

/** Validacion del cuerpo de la peticion de actualizacion de producto. */
export const UpdateProductSchema = z.object({
  categoryId: z.string().uuid('La categoria debe ser un identificador valido.').optional(),
  taxId: z.string().uuid('El impuesto debe ser un identificador valido.').optional(),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  name: z.string().min(3, 'El nombre del producto debe tener al menos 3 caracteres.').optional(),
  description: z.string().nullish(),
  unitOfMeasure: UnitOfMeasureSchema.optional(),
  salePrice: z.number().positive('El precio de venta debe ser un numero positivo.').optional(),
  cost: z.number().min(0, 'El costo debe ser mayor o igual a 0.'),
  // Bloque 7.12: opcional en edicion (patron identico a `name`/`salePrice`
  // arriba — un update parcial no tiene por que reenviar el campo), pero
  // valida el mismo formato de 13 digitos si se envia.
  cabysCode: CabysCodeSchema.optional(),
  // Bloque 14.4: mismo criterio que `CreateProductSchema.expectedWastePercent`.
  expectedWastePercent: z
    .number()
    .min(0, 'El porcentaje de merma esperada debe ser mayor o igual a 0.')
    .max(100, 'El porcentaje de merma esperada debe ser menor o igual a 100.')
    .optional(),
  // Bloque COST-01.1: mismo criterio que `CreateProductSchema.applyExpectedWasteToCost`.
  applyExpectedWasteToCost: z.boolean().optional(),
  isVariableWeight: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  // Bloque LOTES-08: mismo criterio que `CreateProductSchema.requiresBatch`.
  requiresBatch: z.boolean().optional(),
});

export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

/** Validacion de los query params para el listado de productos. */
export const ListProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  categoryId: z.string().uuid('La categoria debe ser un identificador valido.').optional(),
  taxId: z.string().uuid('El impuesto debe ser un identificador valido.').optional(),
  // `z.coerce.boolean()` hace `Boolean(valor)` internamente: como
  // `req.query.active` siempre llega como string desde Express,
  // `Boolean("false")` da `true` (cualquier string no vacio es truthy).
  // Mismo bug ya detectado y corregido en
  // `modules/categories/categories.validation.ts` — el filtro
  // "Inactivos" terminaba consultando `active: true`, igual que
  // "Activos". Se reemplaza por un enum explicito que mapea cada string
  // real al boolean correcto.
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  search: z.string().optional(),
  // Fase 18 (Bloque 18.1): estrictamente opcional — sin este parametro,
  // GET /products responde exactamente igual que antes (sin `stock`). Con
  // el, incluye el stock de ESA sucursal para cada producto en una sola
  // consulta, eliminando el patron N+1 de `ProductCatalogCard.tsx` (una
  // peticion a `GET /inventory` por tarjeta).
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
});

export type ListProductsQueryDto = z.infer<typeof ListProductsQuerySchema>;

/** Validacion de los query params para el lookup (selector) de productos.
 * Arquitectura de selectores, Bloque 1: deliberadamente mas chico que
 * `ListProductsQuerySchema` — sin `page` (el lookup no es una tabla
 * paginable, ver `shared/utils/lookup.ts`). */
export const LookupProductsQuerySchema = z.object({
  search: z.string().optional(),
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type LookupProductsQueryDto = z.infer<typeof LookupProductsQuerySchema>;

/** Validacion del cuerpo de la peticion de cambio de estado de producto. */
export const ChangeProductStatusSchema = z.object({
  active: z.boolean({ required_error: 'El estado activo es obligatorio.' }),
});

export type ChangeProductStatusDto = z.infer<typeof ChangeProductStatusSchema>;
