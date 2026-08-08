/**
 * prisma/seed.ts
 * -----------------------------------------------------------------------------
 * Seed de INSTALACIÓN NUEVA — el que corre `prisma db seed` /
 * `npm run prisma:seed` (ver `package.json` -> `"prisma": { "seed": "tsx
 * prisma/seed.ts" }`), y el que `carniceria-pos-desktop` ejecuta
 * automáticamente en cada instalación real nueva (`isFreshInstall`).
 *
 * Fix (07/08/2026, separación bootstrap/demo): antes este archivo también
 * sembraba un dataset completo de demostración (6 proveedores, 80
 * productos + inventario alto, 6 promociones) de forma DESTRUCTIVA
 * (`resetCatalogData`, borraba Ventas/Compras/Cajas/etc. existentes). Eso
 * significaba que toda instalación nueva real arrancaba con datos de
 * prueba, no con una base limpia. Ese dataset se movió, sin cambiar su
 * contenido ni su lógica, a `prisma/seed-demo.ts` — un script SEPARADO,
 * de uso exclusivamente manual (`npm run prisma:seed:demo`), pensado para
 * desarrollo/QA. Este archivo (`seed.ts`) ya NO es destructivo: solo crea
 * (o actualiza, `upsert`) lo mínimo para que el sistema pueda arrancar y
 * usarse — nunca borra nada.
 *
 * Este archivo siembra, en este orden:
 *
 * 1) BOOTSTRAP DE SISTEMA (idempotente, `upsert` en todo): Sucursal por
 *    defecto, caja registradora por defecto, catálogo de permisos, roles
 *    ADMIN/MANAGER/CASHIER con su matriz de permisos (RBAC, ver
 *    DATABASE.md sección 3.2), usuario administrador, configuración
 *    general.
 * 2) CATÁLOGO BASE (idempotente, `upsert`): 8 categorías y 2 impuestos
 *    (Exento / IVA 13%) — el mínimo que el sistema necesita para poder
 *    crear un producto real desde la UI, sin ser datos de prueba en sí
 *    mismos (son catálogos, no transacciones ni inventario).
 *
 * Lo que este archivo NUNCA crea (a diferencia de `seed-demo.ts`):
 * Proveedores, Productos, Inventario, Promociones, ni ningún dato
 * operativo (Compras, Ventas, Cajas, Devoluciones, Lotes, Documentos). El
 * catálogo CABYS oficial tampoco lo siembra este archivo — lo carga
 * `prisma/import-cabys-bootstrap.ts` (corre en cada arranque de
 * `carniceria-pos-desktop`, ya existente, sin cambios).
 */
import { prisma } from '../src/database/prisma.client';
import { env, isProduction, logger } from '../src/config';
import bcrypt from 'bcrypt';
import { seedPermissionsAndRoles } from './permissionsBootstrap';
import { seedCategories, seedTaxes } from './seedShared';

if (isProduction) {
  logger.error('seed.ts no puede ejecutarse con NODE_ENV=production.');
  process.exit(1);
}

const DEFAULT_SUCURSAL_CODE = 'PRINCIPAL';

// Sin campo unico de negocio disponible en `CashRegister` (a diferencia de
// `Sucursal.code`) para hacer un upsert seguro por ese campo; se usa un id
// fijo, mismo criterio que `env.SUCURSAL_ID` pero autocontenido en este
// archivo (ningun otro modulo necesita conocerlo fuera del seed).
const DEFAULT_CASH_REGISTER_ID = 'f69cd35c-539b-4dbf-9e0f-ff1d74ff6e14';

/** Configuracion inicial (clave-valor) de la sucursal por defecto. */
const INITIAL_CONFIGURATIONS = [
  { key: 'currency', value: 'CRC', type: 'string', description: 'Moneda de operacion.' },
  {
    key: 'company.name',
    value: 'Carniceria',
    type: 'string',
    description: 'Nombre de la empresa.',
  },
  { key: 'locale', value: 'es-CR', type: 'string', description: 'Configuracion regional.' },
] as const;

async function seedSucursal() {
  const sucursal = await prisma.sucursal.upsert({
    where: { code: DEFAULT_SUCURSAL_CODE },
    update: {},
    create: {
      id: env.SUCURSAL_ID,
      code: DEFAULT_SUCURSAL_CODE,
      name: 'Villarreal',
      isMain: true,
      active: true,
    },
  });

  logger.info({ sucursalId: sucursal.id }, 'Sucursal por defecto lista.');
  return sucursal;
}

/** Caja registradora por defecto de la sucursal principal. */
async function seedCashRegisters(sucursalId: string) {
  const cashRegister = await prisma.cashRegister.upsert({
    where: { id: DEFAULT_CASH_REGISTER_ID },
    update: {},
    create: {
      id: DEFAULT_CASH_REGISTER_ID,
      sucursalId,
      name: 'Caja Principal',
      active: true,
    },
  });

  logger.info(
    { cashRegisterId: cashRegister.id },
    'Caja registradora por defecto lista.',
  );
  return cashRegister;
}

async function seedAdminUser(sucursalId: string, roleId: string) {
  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      sucursalId,
      roleId,
      username: 'admin',
      email: 'admin@carniceria.local',
      fullName: 'Administrador del Sistema',
      passwordHash,
      active: true,
    },
  });

  logger.info({ userId: user.id }, 'Usuario administrador listo.');
  return user;
}

async function seedConfigurations(sucursalId: string) {
  for (const config of INITIAL_CONFIGURATIONS) {
    await prisma.configuration.upsert({
      where: { sucursalId_key: { sucursalId, key: config.key } },
      update: { value: config.value },
      create: { sucursalId, ...config },
    });
  }

  logger.info({ sucursalId, total: INITIAL_CONFIGURATIONS.length }, 'Configuracion inicial lista.');
}

async function main(): Promise<void> {
  logger.info('Ejecutando seed de instalación nueva (bootstrap + catálogo base)...');

  const sucursal = await seedSucursal();
  await seedCashRegisters(sucursal.id);
  const { adminRole } = await seedPermissionsAndRoles();

  await seedAdminUser(sucursal.id, adminRole.id);
  await seedConfigurations(sucursal.id);

  await seedCategories();
  await seedTaxes();

  logger.info('Seed de instalación nueva completado.');
}

main()
  .catch((error) => {
    logger.error({ err: error }, 'Error en el seed.');
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
