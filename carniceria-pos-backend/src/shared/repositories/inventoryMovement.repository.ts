/**
 * shared/repositories/inventoryMovement.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos para el registro de movimientos de inventario
 * (`InventoryMovement`). Es infraestructura pura: no valida datos de
 * entrada y no contiene reglas de negocio (eso vive en
 * `shared/services/inventoryMovement.service.ts`). Usa unicamente Prisma.
 *
 * Vive en `shared/`, no en `modules/`, porque es infraestructura
 * transversal consumida por un servicio transversal
 * (`inventoryMovement.service.ts`), sin un modulo HTTP propio que lo
 * posea. Esto mantiene el grafo de dependencias limpio: ningun archivo de
 * `shared/` depende de `modules/` para esta pieza.
 *
 * Este archivo SOLO accede a `InventoryMovement`. El acceso a `Inventory`
 * (lectura del saldo actual y actualizacion tras el movimiento) es
 * responsabilidad exclusiva de `modules/inventory/repository.ts`, el unico
 * dueno de esa tabla en el proyecto; este archivo no la duplica.
 *
 * Cada funcion exportada acepta como ultimo parametro un cliente `DbClient`
 * opcional (por defecto el singleton `prisma`), para poder ejecutarse
 * dentro de una transaccion abierta por quien invoca al servicio.
 */
import { Prisma } from '@prisma/client';
import { prisma, type DbClient } from '@/database';

/** Cliente de base de datos: el singleton `prisma` o un cliente
 * transaccional con la misma forma. */
export type { DbClient };

/**
 * Crea un registro de movimiento de inventario. `InventoryMovement` es un
 * registro inmutable y de solo agregado (ver DATABASE.md): esta es la unica
 * escritura que este archivo realiza.
 */
export function createMovement(
  data: Prisma.InventoryMovementUncheckedCreateInput,
  db: DbClient = prisma,
) {
  return db.inventoryMovement.create({
    data,
    select: { id: true },
  });
}

/**
 * Version batched de `createMovement()`: inserta varios movimientos en una
 * sola sentencia (`INSERT ... VALUES (...), (...), ... RETURNING id`), para
 * los llamadores que registran varios movimientos dentro de la misma
 * transaccion (ver `inventoryMovement.service.ts` -> `recordMovements()`).
 */
export function createManyMovements(
  data: Prisma.InventoryMovementCreateManyInput[],
  db: DbClient = prisma,
) {
  return db.inventoryMovement.createManyAndReturn({
    data,
    select: { id: true },
  });
}
