/**
 * modules/customers/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de clientes.
 *
 * Responsabilidades:
 *  - Validar existencia del cliente antes de leer/actualizar/cambiar su
 *    estado.
 *  - Validar que (identificationType, identificationNumber) no este
 *    duplicado al crear o actualizar (ajuste aprobado del Bloque 8.2).
 *  - Traducir los registros de Prisma a la forma publica `CustomerResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `customers.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { ConflictError, NotFoundError } from '@/shared/errors';
import type { LookupItem } from '@/shared/utils/lookup';
import * as customersRepository from './repository';
import type {
  ChangeCustomerStatusDto,
  CreateCustomerDto,
  CustomerIdentificationType,
  CustomerResponse,
  ListCustomersQuery,
  ListCustomersResult,
  LookupCustomersQuery,
  UpdateCustomerDto,
} from './types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type CustomerRecord = {
  id: string;
  name: string;
  identificationType: string;
  identificationNumber: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica del cliente. */
function toCustomerResponse(customer: CustomerRecord): CustomerResponse {
  return {
    id: customer.id,
    name: customer.name,
    identificationType: customer.identificationType as CustomerIdentificationType,
    identificationNumber: customer.identificationNumber,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    active: customer.active,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export async function create(dto: CreateCustomerDto): Promise<CustomerResponse> {
  const existing = await customersRepository.findByIdentification(
    dto.identificationType,
    dto.identificationNumber,
  );

  if (existing) {
    throw new ConflictError('Ya existe un cliente con ese tipo y número de identificación.');
  }

  const created = await customersRepository.create({
    name: dto.name,
    identificationType: dto.identificationType,
    identificationNumber: dto.identificationNumber,
    email: dto.email ?? null,
    phone: dto.phone ?? null,
    address: dto.address ?? null,
    active: dto.active ?? true,
  });

  return toCustomerResponse(created);
}

export async function findById(id: string): Promise<CustomerResponse> {
  const customer = await customersRepository.findById(id);

  if (!customer) {
    throw new NotFoundError('Cliente');
  }

  return toCustomerResponse(customer);
}

export async function findMany(query: ListCustomersQuery): Promise<ListCustomersResult> {
  const [items, total] = await customersRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map(toCustomerResponse),
    total,
  };
}

/** Arquitectura de selectores, Bloque 1: patron de lookup — devuelve la
 * forma liviana `LookupItem[]`, nunca `CustomerResponse[]`. */
export async function lookup(query: LookupCustomersQuery): Promise<LookupItem[]> {
  const items = await customersRepository.lookup({
    take: query.take,
    filters: query.filters,
  });

  return items.map((item) => ({ id: item.id, label: item.name }));
}

export async function update(id: string, dto: UpdateCustomerDto): Promise<CustomerResponse> {
  const existing = await customersRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Cliente');
  }

  const nextType = dto.identificationType ?? (existing.identificationType as CustomerIdentificationType);
  const nextNumber = dto.identificationNumber ?? existing.identificationNumber;
  const identificationChanged =
    nextType !== existing.identificationType || nextNumber !== existing.identificationNumber;

  if (identificationChanged) {
    const existingByIdentification = await customersRepository.findByIdentification(
      nextType,
      nextNumber,
    );

    if (existingByIdentification) {
      throw new ConflictError('Ya existe un cliente con ese tipo y número de identificación.');
    }
  }

  const updated = await customersRepository.update(id, {
    name: dto.name,
    identificationType: dto.identificationType,
    identificationNumber: dto.identificationNumber,
    email: dto.email,
    phone: dto.phone,
    address: dto.address,
  });

  return toCustomerResponse(updated);
}

export async function changeStatus(
  id: string,
  dto: ChangeCustomerStatusDto,
): Promise<CustomerResponse> {
  const existing = await customersRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Cliente');
  }

  const updated = await customersRepository.changeStatus(id, dto.active);

  return toCustomerResponse(updated);
}

/**
 * Borrado logico de un cliente. Idempotente por diseño: no distingue
 * "nunca existio" de "ya fue borrado" -- ambos casos devuelven
 * `NotFoundError`, porque `findById` ya pasa por el filtro global de
 * `deletedAt` (via la extension `softDelete.ext.ts`, con `Customer` ya
 * registrado en `SOFT_DELETE_MODELS`). Sin verificacion de dependencias
 * (`Sale`/etc.): este bloque no crea ninguna relacion hacia `Customer`
 * todavia (Bloque 8.3, fuera de alcance aca).
 */
export async function remove(id: string): Promise<void> {
  const existing = await customersRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Cliente');
  }

  await customersRepository.softDelete(id);
}
