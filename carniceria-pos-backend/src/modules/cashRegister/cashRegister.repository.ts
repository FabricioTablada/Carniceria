/**
 * modules/cashRegister/cashRegister.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el modulo de cajas registradoras.
 * Es infraestructura pura: no valida datos de entrada, no valida duplicados
 * y no contiene reglas de negocio (eso vive en `cashRegister.service.ts`).
 * Usa unicamente la instancia singleton de Prisma expuesta en `@/database`.
 *
 * Incluye `findSucursalById`: lectura necesaria para que
 * `cashRegister.service.ts` valide la existencia de la sucursal referida
 * por la caja registradora en lugar de dejar que Prisma lance un error
 * crudo de restriccion de clave foranea. Se mantiene aqui, y no en el
 * repositorio de Sucursal (no existe como modulo propio en este proyecto),
 * para que toda consulta Prisma de este modulo siga viviendo unicamente en
 * este archivo, mismo patron ya usado en Sales/Cash/Purchases para sus
 * propias relaciones.
 *
 * NOTA: se usa `findFirst` en lugar de `findUnique` porque la extension de
 * borrado logico (`softDelete.ext.ts`) solo intercepta `findFirst` / `findMany`
 * / `count` / `aggregate`. Esto mantiene el repositorio compatible con el
 * filtrado global de `deletedAt` una vez que `CashRegister` se registre en
 * `SOFT_DELETE_MODELS`.
 *
 * NOTA: `CashRegister` no tiene ninguna restriccion `@@unique` en
 * `schema.prisma`, por lo que este repositorio no expone un finder de
 * duplicados (a diferencia de Categories, Products, Taxes, Suppliers,
 * Inventory y Sales).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { ListCashRegistersFilters } from './cashRegister.types';

/** Incluye el resumen de la sucursal asociada a la caja registradora. */
const cashRegisterWithSucursalInclude = {
  sucursal: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} as const;

/** Verifica la existencia de la sucursal referenciada. */
export function findSucursalById(id: string) {
  return prisma.sucursal.findFirst({
    where: { id },
    select: { id: true },
  });
}

export function create(data: Prisma.CashRegisterUncheckedCreateInput) {
  return prisma.cashRegister.create({
    data,
    include: cashRegisterWithSucursalInclude,
  });
}

export function findById(id: string) {
  return prisma.cashRegister.findFirst({
    where: { id },
    include: cashRegisterWithSucursalInclude,
  });
}

/** Construye la clausula `where` a partir de los filtros de listado. */
function buildWhere(filters?: ListCashRegistersFilters): Prisma.CashRegisterWhereInput {
  if (!filters) return {};

  return {
    sucursalId: filters.sucursalId,
    active: filters.active,
    ...(filters.search && {
      name: { contains: filters.search, mode: 'insensitive' },
    }),
  };
}

export function findMany(params: {
  skip: number;
  take: number;
  filters?: ListCashRegistersFilters;
}) {
  const where = buildWhere(params.filters);

  return prisma.$transaction([
    prisma.cashRegister.findMany({
      where,
      include: cashRegisterWithSucursalInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cashRegister.count({ where }),
  ]);
}

export function update(id: string, data: Prisma.CashRegisterUncheckedUpdateInput) {
  return prisma.cashRegister.update({
    where: { id },
    data,
    include: cashRegisterWithSucursalInclude,
  });
}

export function changeStatus(id: string, active: boolean) {
  return prisma.cashRegister.update({
    where: { id },
    data: { active },
    include: cashRegisterWithSucursalInclude,
  });
}
