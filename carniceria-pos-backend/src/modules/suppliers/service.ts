/**
 * modules/suppliers/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de proveedores.
 *
 * Responsabilidades:
 *  - Validar existencia del proveedor antes de leer/actualizar/cambiar su
 *    estado.
 *  - Traducir los registros de Prisma a la forma publica `SupplierResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `suppliers.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '@/shared/errors';
import type { LookupItem } from '@/shared/utils/lookup';
import * as suppliersRepository from './repository';
import type {
  ChangeSupplierStatusDto,
  CreateSupplierDto,
  ListSuppliersQuery,
  ListSuppliersResult,
  LookupSuppliersQuery,
  SupplierResponse,
  UpdateSupplierDto,
} from './types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type SupplierRecord = {
  id: string;
  name: string;
  legalId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * QA.7 (Proveedores): `legalId` es `@unique` a nivel de base de datos
 * (`schema.prisma`), pero ese indice NO excluye filas con `deletedAt`
 * distinto de `null` -- a diferencia de la validacion de arriba
 * (`findByLegalId`), que si las excluye (via la extension de borrado
 * logico). Antes de esta correccion, reutilizar el `legalId` de un
 * proveedor ya eliminado pasaba la validacion de la aplicacion (el
 * proveedor borrado es invisible para `findFirst`) pero fallaba en la
 * base de datos con `P2002` sin traducir, cayendo en el 500 generico del
 * error handler. Mismo patron de traduccion ya usado en
 * `products/products.service.ts` (QA.1, mismo hallazgo exacto sobre
 * `sku`/`barcode`) y en `categories/categories.service.ts` (QA.6, mismo
 * hallazgo exacto sobre `name`).
 */
function translateUniqueConstraintError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes('legal_id')
  ) {
    throw new ConflictError(
      'Ya existe un proveedor con ese identificador legal (puede pertenecer a un proveedor eliminado).',
    );
  }

  throw error;
}

/** Traduce un registro de Prisma a la forma publica del proveedor. */
function toSupplierResponse(supplier: SupplierRecord): SupplierResponse {
  return {
    id: supplier.id,
    name: supplier.name,
    legalId: supplier.legalId,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    active: supplier.active,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

export async function create(dto: CreateSupplierDto): Promise<SupplierResponse> {
  if (dto.legalId) {
    const existingByLegalId = await suppliersRepository.findByLegalId(dto.legalId);

    if (existingByLegalId) {
      throw new ConflictError('Ya existe un proveedor con ese identificador legal.');
    }
  }

  try {
    const created = await suppliersRepository.create({
      name: dto.name,
      legalId: dto.legalId ?? null,
      contactName: dto.contactName ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      active: dto.active ?? true,
    });

    return toSupplierResponse(created);
  } catch (error) {
    return translateUniqueConstraintError(error);
  }
}

export async function findById(id: string): Promise<SupplierResponse> {
  const supplier = await suppliersRepository.findById(id);

  if (!supplier) {
    throw new NotFoundError('Proveedor');
  }

  return toSupplierResponse(supplier);
}

export async function findMany(query: ListSuppliersQuery): Promise<ListSuppliersResult> {
  const [items, total] = await suppliersRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map(toSupplierResponse),
    total,
  };
}

/** Arquitectura de selectores, Bloque 1: patron de lookup — devuelve la
 * forma liviana `LookupItem[]`, nunca `SupplierResponse[]`. */
export async function lookup(query: LookupSuppliersQuery): Promise<LookupItem[]> {
  const items = await suppliersRepository.lookup({
    take: query.take,
    filters: query.filters,
  });

  return items.map((item) => ({ id: item.id, label: item.name }));
}

export async function update(id: string, dto: UpdateSupplierDto): Promise<SupplierResponse> {
  const existing = await suppliersRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Proveedor');
  }

  if (dto.legalId && dto.legalId !== existing.legalId) {
    const existingByLegalId = await suppliersRepository.findByLegalId(dto.legalId);

    if (existingByLegalId) {
      throw new ConflictError('Ya existe un proveedor con ese identificador legal.');
    }
  }

  try {
    const updated = await suppliersRepository.update(id, {
      name: dto.name,
      legalId: dto.legalId,
      contactName: dto.contactName,
      phone: dto.phone,
      email: dto.email,
      address: dto.address,
    });

    return toSupplierResponse(updated);
  } catch (error) {
    return translateUniqueConstraintError(error);
  }
}

export async function changeStatus(
  id: string,
  dto: ChangeSupplierStatusDto,
): Promise<SupplierResponse> {
  const existing = await suppliersRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Proveedor');
  }

  const updated = await suppliersRepository.changeStatus(id, dto.active);

  return toSupplierResponse(updated);
}

/**
 * Borrado logico de un proveedor. Idempotente por diseño: no distingue
 * "nunca existio" de "ya fue borrado" -- ambos casos devuelven
 * `NotFoundError`, porque `findById` ya pasa por el filtro global de
 * `deletedAt` (via la extension `softDelete.ext.ts`, con `Supplier` ya
 * registrado en `SOFT_DELETE_MODELS`). No se agrega ninguna consulta
 * especial que ignore ese filtro para poder distinguir ambos casos.
 */
export async function remove(id: string): Promise<void> {
  const existing = await suppliersRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Proveedor');
  }

  await suppliersRepository.softDelete(id);
}
