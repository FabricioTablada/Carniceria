/**
 * modules/cashRegister/cashRegister.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de cajas registradoras.
 *
 * Responsabilidades:
 *  - Validar existencia de la caja registradora antes de leer/actualizar/
 *    cambiar su estado.
 *  - Validar existencia de la sucursal referenciada al crear o actualizar.
 *  - Traducir los registros de Prisma a la forma publica
 *    `CashRegisterResponse` (proyectando `sucursal` a
 *    `CashRegisterSucursalSummary`).
 *
 * Toda consulta a la base de datos se hace a traves de
 * `cashRegister.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 *
 * NOTA: el modelo `CashRegister` no tiene ninguna restriccion `@@unique` en
 * `schema.prisma`, por lo que este servicio no valida duplicados (a
 * diferencia de Categories, Products y Taxes).
 */
import { NotFoundError } from '@/shared/errors';
import * as cashRegisterRepository from './cashRegister.repository';
import type {
  CashRegisterResponse,
  ChangeCashRegisterStatusDto,
  CreateCashRegisterDto,
  ListCashRegistersQuery,
  ListCashRegistersResult,
  UpdateCashRegisterDto,
} from './cashRegister.types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type CashRegisterRecord = {
  id: string;
  sucursalId: string;
  name: string;
  sucursal: { id: string; code: string; name: string };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica de la caja
 * registradora. */
function toCashRegisterResponse(cashRegister: CashRegisterRecord): CashRegisterResponse {
  return {
    id: cashRegister.id,
    sucursalId: cashRegister.sucursalId,
    name: cashRegister.name,
    sucursal: cashRegister.sucursal,
    active: cashRegister.active,
    createdAt: cashRegister.createdAt,
    updatedAt: cashRegister.updatedAt,
  };
}

export async function create(dto: CreateCashRegisterDto): Promise<CashRegisterResponse> {
  const sucursal = await cashRegisterRepository.findSucursalById(dto.sucursalId);

  if (!sucursal) {
    throw new NotFoundError('Sucursal');
  }

  const created = await cashRegisterRepository.create({
    sucursalId: dto.sucursalId,
    name: dto.name,
    active: dto.active ?? true,
  });

  return toCashRegisterResponse(created);
}

export async function findById(id: string): Promise<CashRegisterResponse> {
  const cashRegister = await cashRegisterRepository.findById(id);

  if (!cashRegister) {
    throw new NotFoundError('Caja registradora');
  }

  return toCashRegisterResponse(cashRegister);
}

export async function findMany(query: ListCashRegistersQuery): Promise<ListCashRegistersResult> {
  const [items, total] = await cashRegisterRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map(toCashRegisterResponse),
    total,
  };
}

export async function update(
  id: string,
  dto: UpdateCashRegisterDto,
): Promise<CashRegisterResponse> {
  const existing = await cashRegisterRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Caja registradora');
  }

  if (dto.sucursalId && dto.sucursalId !== existing.sucursalId) {
    const sucursal = await cashRegisterRepository.findSucursalById(dto.sucursalId);

    if (!sucursal) {
      throw new NotFoundError('Sucursal');
    }
  }

  const updated = await cashRegisterRepository.update(id, {
    sucursalId: dto.sucursalId,
    name: dto.name,
  });

  return toCashRegisterResponse(updated);
}

export async function changeStatus(
  id: string,
  dto: ChangeCashRegisterStatusDto,
): Promise<CashRegisterResponse> {
  const existing = await cashRegisterRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Caja registradora');
  }

  const updated = await cashRegisterRepository.changeStatus(id, dto.active);

  return toCashRegisterResponse(updated);
}
