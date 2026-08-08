/**
 * prisma/seed-permissions.ts
 * -----------------------------------------------------------------------------
 * Fix (05/08/2026). Punto de entrada standalone, separado de `prisma/seed.ts`,
 * que corre EXCLUSIVAMENTE `seedPermissionsAndRoles()`
 * (`prisma/permissionsBootstrap.ts`) — el bootstrap idempotente de
 * `Permission`/`Role`/`RolePermission`, sin tocar `Sucursal`/`CashRegister`/
 * `User`/`Configuration` ni el catalogo de negocio (eso sigue siendo
 * responsabilidad exclusiva de `seed.ts`, solo en instalacion fresca).
 *
 * Pensado para invocarse en CADA arranque de una instalacion ya existente
 * (`carniceria-pos-desktop`, `electron/main.ts`) — a diferencia de
 * `seed.ts` (que sigue gateado a `isFreshInstall` por su paso 2
 * destructivo), este script es seguro de correr las veces que haga falta:
 * cierra el hueco real ya demostrado de un permiso agregado al catalogo
 * despues del primer arranque de una instalacion (ej. `customers.*`,
 * Bloque 8.2) que nunca llegaba a esa base en ninguna actualizacion
 * posterior.
 */
import { prisma } from '../src/database/prisma.client';
import { logger } from '../src/config';
import { seedPermissionsAndRoles } from './permissionsBootstrap';

async function main(): Promise<void> {
  logger.info('Sincronizando catalogo de permisos y roles (bootstrap idempotente)...');
  await seedPermissionsAndRoles();
  logger.info('Catalogo de permisos y roles sincronizado.');
}

main()
  .catch((error) => {
    logger.error({ err: error }, 'Error sincronizando el catalogo de permisos y roles.');
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
