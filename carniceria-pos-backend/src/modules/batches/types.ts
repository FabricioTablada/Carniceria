/**
 * modules/batches/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de Lotes (Batch Management, Bloque LOTES-01).
 * Define unicamente las formas de datos que consumen `service.ts`,
 * `repository.ts` y `controller.ts`; no contiene logica de negocio, consultas
 * Prisma ni validaciones (eso vive en `service.ts`/`repository.ts`/
 * `validation.ts`).
 *
 * `CreateBatchDto` hoy solo se invoca INTERNAMENTE (`batches/service.ts::create`,
 * sin endpoint HTTP todavia -- ver `routes.ts`, que en este bloque solo
 * expone `GET /`, `GET /:id` y `PATCH /:id`). Queda completo para cuando
 * exista `POST /batches` (creacion manual, fuera del flujo automatico de
 * Compras) sin necesitar cambiar esta forma.
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Estado de un lote (enum `BatchStatus` de `schema.prisma`). */
export type BatchStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'BLOCKED';

/** Unidad de medida del producto asociado (enum `UnitOfMeasure` de `schema.prisma`). */
export type BatchUnitOfMeasure = 'KILOGRAM' | 'UNIT';

/** Resumen del producto asociado a un lote. */
export interface BatchProductSummary {
  id: string;
  name: string;
  sku: string | null;
  unitOfMeasure: BatchUnitOfMeasure;
}

/** Resumen de la sucursal asociada a un lote. */
export interface BatchSucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Resumen del proveedor asociado a un lote (snapshot, ver `Batch.supplierId`
 * en `schema.prisma` -- puede ser `null` para un lote de reconciliacion). */
export interface BatchSupplierSummary {
  id: string;
  name: string;
}

/** Forma de un lote tal como la expone el modulo. */
export interface BatchResponse {
  id: string;
  code: string;
  supplierLotCode: string | null;
  productId: string;
  sucursalId: string;
  purchaseItemId: string | null;
  supplierId: string | null;
  receivedAt: Date;
  productionDate: Date | null;
  expiryDate: Date | null;
  initialQuantity: number;
  availableQuantity: number;
  unitCost: number;
  expectedWastePercent: number | null;
  status: BatchStatus;
  closedAt: Date | null;
  notes: string | null;
  product: BatchProductSummary;
  sucursal: BatchSucursalSummary;
  supplier: BatchSupplierSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un lote. Ver nota de archivo: sin endpoint
 * HTTP en este bloque, invocado internamente desde el modulo que lo cree
 * (Compras, LOTES-02). */
export interface CreateBatchDto {
  productId: string;
  sucursalId: string;
  purchaseItemId?: string | null;
  supplierId?: string | null;
  supplierLotCode?: string | null;
  receivedAt: Date;
  productionDate?: Date | null;
  expiryDate?: Date | null;
  initialQuantity: number;
  unitCost: number;
  expectedWastePercent?: number | null;
  notes?: string | null;
}

/** Datos permitidos para ajustar un lote (`PATCH /batches/:id`) -- cantidad
 * disponible y/o estado (bloqueo/cierre), nunca los campos de origen/
 * snapshot (esos se fijan una unica vez al crear el lote). */
export interface UpdateBatchDto {
  availableQuantity?: number;
  status?: BatchStatus;
  notes?: string | null;
}

/** Filtros de busqueda/listado disponibles para lotes. */
export interface ListBatchFilters {
  productId?: string;
  sucursalId?: string;
  supplierId?: string;
  status?: BatchStatus;
}

/** Parametros combinados para listar lotes: filtros + paginacion. */
export interface ListBatchQuery extends PaginationParams {
  filters?: ListBatchFilters;
}

/** Resultado de una operacion de listado paginado de lotes. */
export interface ListBatchResult {
  items: BatchResponse[];
  total: number;
}
