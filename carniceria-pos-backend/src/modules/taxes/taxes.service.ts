/**
 * modules/taxes/taxes.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de impuestos.
 *
 * Responsabilidades:
 *  - Validar existencia del impuesto antes de leer/actualizar/cambiar su
 *    estado.
 *  - Validar que `code` no este duplicado al crear o actualizar.
 *  - Validar que `name` no este duplicado al crear o actualizar.
 *  - Traducir los registros de Prisma a la forma publica `TaxResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `taxes.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import { ConflictError, NotFoundError } from '@/shared/errors';
import type { LookupItem } from '@/shared/utils/lookup';
import * as taxesRepository from './taxes.repository';
import type {
  ChangeTaxStatusDto,
  CreateTaxDto,
  ListTaxesQuery,
  ListTaxesResult,
  LookupTaxesQuery,
  TaxResponse,
  UpdateTaxDto,
} from './taxes.types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type TaxRecord = {
  id: string;
  code: string;
  name: string;
  rate: Prisma.Decimal;
  isDefault: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * QA.8 (Impuestos): `code` es `@unique` a nivel de base de datos
 * (`schema.prisma`), pero ese indice NO excluye filas con `deletedAt`
 * distinto de `null` -- a diferencia de la validacion de arriba
 * (`findByCode`), que si las excluye (via la extension de borrado
 * logico). Antes de esta correccion, reutilizar el `code` de un impuesto
 * ya eliminado pasaba la validacion de la aplicacion (el impuesto
 * borrado es invisible para `findFirst`) pero fallaba en la base de
 * datos con `P2002` sin traducir, cayendo en el 500 generico del error
 * handler. Mismo patron de traduccion ya usado en
 * `products/products.service.ts` (QA.1), `categories/categories.service.ts`
 * (QA.6) y `suppliers/service.ts` (QA.7). `name` NO es `@unique` a nivel
 * de base de datos (solo `code` lo es, ver `schema.prisma`), asi que ese
 * campo no necesita esta traduccion.
 */
function translateUniqueConstraintError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes('code')
  ) {
    throw new ConflictError(
      'El codigo del impuesto ya se encuentra registrado (puede pertenecer a un impuesto eliminado).',
    );
  }

  throw error;
}

/** Traduce un registro de Prisma a la forma publica del impuesto. */
function toTaxResponse(tax: TaxRecord): TaxResponse {
  return {
    id: tax.id,
    code: tax.code,
    name: tax.name,
    rate: Number(tax.rate),
    isDefault: tax.isDefault,
    active: tax.active,
    createdAt: tax.createdAt,
    updatedAt: tax.updatedAt,
  };
}

export async function create(dto: CreateTaxDto): Promise<TaxResponse> {
  const existingByCode = await taxesRepository.findByCode(dto.code);

  if (existingByCode) {
    throw new ConflictError('El codigo del impuesto ya se encuentra registrado.');
  }

  const existingByName = await taxesRepository.findByName(dto.name);

  if (existingByName) {
    throw new ConflictError('El nombre del impuesto ya se encuentra registrado.');
  }

  try {
    const created = dto.isDefault
      ? await prisma.$transaction(async (tx) => {
          await taxesRepository.unsetDefault(tx);

          return taxesRepository.create(
            {
              code: dto.code,
              name: dto.name,
              rate: dto.rate,
              isDefault: true,
              active: dto.active ?? true,
            },
            tx,
          );
        })
      : await taxesRepository.create({
          code: dto.code,
          name: dto.name,
          rate: dto.rate,
          isDefault: false,
          active: dto.active ?? true,
        });

    return toTaxResponse(created);
  } catch (error) {
    return translateUniqueConstraintError(error);
  }
}

export async function findById(id: string): Promise<TaxResponse> {
  const tax = await taxesRepository.findById(id);

  if (!tax) {
    throw new NotFoundError('Impuesto');
  }

  return toTaxResponse(tax);
}

export async function findMany(query: ListTaxesQuery): Promise<ListTaxesResult> {
  const [items, total] = await taxesRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map(toTaxResponse),
    total,
  };
}

/** Arquitectura de selectores, Bloque 1: patron de lookup — devuelve la
 * forma liviana `LookupItem[]`, nunca `TaxResponse[]`. */
export async function lookup(query: LookupTaxesQuery): Promise<LookupItem[]> {
  const items = await taxesRepository.lookup({
    take: query.take,
    filters: query.filters,
  });

  return items.map((item) => ({ id: item.id, label: item.name }));
}

export async function update(id: string, dto: UpdateTaxDto): Promise<TaxResponse> {
  const existing = await taxesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Impuesto');
  }

  if (dto.code && dto.code !== existing.code) {
    const existingByCode = await taxesRepository.findByCode(dto.code);

    if (existingByCode) {
      throw new ConflictError('El codigo del impuesto ya se encuentra registrado.');
    }
  }

  if (dto.name && dto.name !== existing.name) {
    const existingByName = await taxesRepository.findByName(dto.name);

    if (existingByName) {
      throw new ConflictError('El nombre del impuesto ya se encuentra registrado.');
    }
  }

  try {
    const updated = dto.isDefault
      ? await prisma.$transaction(async (tx) => {
          await taxesRepository.unsetDefault(tx);

          return taxesRepository.update(
            id,
            {
              code: dto.code,
              name: dto.name,
              rate: dto.rate,
              isDefault: true,
            },
            tx,
          );
        })
      : await taxesRepository.update(id, {
          code: dto.code,
          name: dto.name,
          rate: dto.rate,
          isDefault: dto.isDefault,
        });

    return toTaxResponse(updated);
  } catch (error) {
    return translateUniqueConstraintError(error);
  }
}

export async function changeStatus(id: string, dto: ChangeTaxStatusDto): Promise<TaxResponse> {
  const existing = await taxesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Impuesto');
  }

  const updated = await taxesRepository.changeStatus(id, dto.active);

  return toTaxResponse(updated);
}

/**
 * Borrado logico de un impuesto. Idempotente por diseño: no distingue
 * "nunca existio" de "ya fue borrado" -- ambos casos devuelven
 * `NotFoundError`, porque `findById` ya pasa por el filtro global de
 * `deletedAt` (via la extension `softDelete.ext.ts`, con `Tax` ya
 * registrado en `SOFT_DELETE_MODELS`). Mismo criterio que
 * `categories/categories.service.ts::remove`.
 *
 * Antes de borrar, se bloquea si el impuesto tiene productos asociados:
 * el borrado logico no falla por restriccion de llave foranea (sigue
 * siendo un `update`, no un `delete` fisico), pero dejaria esos productos
 * apuntando a un impuesto "eliminado" — una inconsistencia de negocio, no
 * de base de datos, que se previene aca explicitamente con
 * `ConflictError` (409). Mismo motivo que el bloqueo de
 * `categories.service.ts::remove` (Product.categoryId), aca sobre
 * `Product.taxId`.
 */
export async function remove(id: string): Promise<void> {
  const existing = await taxesRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Impuesto');
  }

  const productCount = await taxesRepository.countProducts(id);

  if (productCount > 0) {
    throw new ConflictError('No se puede eliminar el impuesto porque tiene productos asociados.');
  }

  await taxesRepository.softDelete(id);
}
