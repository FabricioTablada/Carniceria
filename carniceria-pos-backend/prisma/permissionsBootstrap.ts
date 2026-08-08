/**
 * prisma/permissionsBootstrap.ts
 * -----------------------------------------------------------------------------
 * Fix (05/08/2026, causa raiz demostrada con evidencia real contra una
 * instalacion de `carniceria-pos-desktop` actualizada varias veces): el
 * catalogo de `Permission`/`Role`/`RolePermission` solo se sembraba en la
 * ejecucion UNICA de `prisma/seed.ts` (instalacion fresca). Cualquier
 * permiso agregado despues de ese primer arranque (ej. `customers.*`,
 * Bloque 8.2, agregado el 04/08/2026) nunca llegaba a una instalacion ya
 * inicializada, en ninguna actualizacion posterior — confirmado
 * empiricamente: `Role.createdAt` de una instalacion real quedo fechado
 * ANTES de que existieran siquiera las migraciones de esquema de Clientes.
 *
 * Este archivo separa, de `seed.ts`, EXCLUSIVAMENTE la porcion idempotente
 * de permisos/roles (upsert en todo, nunca borra nada) — a proposito, NO
 * incluye Sucursal/CashRegister/User/Configuration (tambien idempotentes en
 * `seed.ts`, pero fuera del alcance aprobado para este fix) ni, por
 * supuesto, el paso 2 de `seed.ts` (reset del catalogo de negocio,
 * destructivo). `seed.ts` sigue siendo el UNICO lugar que define el dataset
 * completo de bootstrap — este archivo solo extrae la porcion de
 * permisos/roles para que pueda invocarse por separado, en cada arranque,
 * sin duplicar el catalogo de permisos ni la matriz de roles en dos
 * lugares.
 *
 * Sin guard de `NODE_ENV=production` (a diferencia de `seed.ts`): a
 * diferencia de ese archivo, TODO lo que hace este modulo es upsert puro,
 * nunca un `deleteMany`/reset — seguro de correr en cualquier entorno,
 * incluida una instalacion real en produccion.
 */
import { prisma } from '../src/database/prisma.client';
import { logger } from '../src/config';
import { SystemRole } from '../src/shared/constants';
import type { SystemRoleName } from '../src/shared/constants';

/** Catalogo minimo de permisos iniciales (formato `entidad.accion`). Misma
 * lista que `seed.ts` usaba antes de este fix — movida aca, no duplicada:
 * `seed.ts` la importa de este archivo. */
export const INITIAL_PERMISSIONS = [
  { code: 'products.view', description: 'Ver productos.' },
  { code: 'products.create', description: 'Crear productos.' },
  { code: 'products.update', description: 'Editar productos.' },
  { code: 'products.delete', description: 'Eliminar productos.' },
  { code: 'categories.view', description: 'Ver categorias.' },
  { code: 'categories.create', description: 'Crear categorias.' },
  { code: 'categories.update', description: 'Editar categorias.' },
  { code: 'categories.delete', description: 'Eliminar categorias.' },
  { code: 'taxes.view', description: 'Ver impuestos.' },
  { code: 'taxes.create', description: 'Crear impuestos.' },
  { code: 'taxes.update', description: 'Editar impuestos.' },
  { code: 'taxes.delete', description: 'Eliminar impuestos.' },
  // Bloque P.3 (Motor de Promociones, catalogo administrativo): permisos
  // sembrados ahora, mismo criterio de CRUD del catalogo que Impuestos.
  { code: 'promotions.view', description: 'Ver promociones.' },
  { code: 'promotions.create', description: 'Crear promociones.' },
  { code: 'promotions.update', description: 'Editar promociones.' },
  { code: 'promotions.delete', description: 'Eliminar promociones.' },
  { code: 'suppliers.view', description: 'Ver proveedores.' },
  { code: 'suppliers.create', description: 'Crear proveedores.' },
  { code: 'suppliers.update', description: 'Editar proveedores.' },
  { code: 'suppliers.delete', description: 'Eliminar proveedores.' },
  // Bloque 8.2 (Módulo de Clientes, CRUD base): mismo criterio de permisos
  // CRUD completo que Proveedores — sin uso todavía en Ventas/Alegra
  // (Bloques 8.3/8.4, fuera de alcance de este bloque).
  { code: 'customers.view', description: 'Ver clientes.' },
  { code: 'customers.create', description: 'Crear clientes.' },
  { code: 'customers.update', description: 'Editar clientes.' },
  { code: 'customers.delete', description: 'Eliminar clientes.' },
  { code: 'cash-registers.create', description: 'Crear cajas registradoras.' },
  { code: 'cash-registers.update', description: 'Editar cajas registradoras.' },
  { code: 'sales.view', description: 'Ver ventas.' },
  { code: 'sales.create', description: 'Registrar ventas.' },
  { code: 'sales.void', description: 'Anular ventas.' },
  { code: 'sales.correct', description: 'Corregir ventas (anula y reemplaza con una venta corregida).' },
  // Bloque 4.1 (infraestructura base de Devoluciones): permisos sembrados
  // ahora para que la estructura este completa, sin endpoint todavia que
  // los verifique (sin logica de negocio en este bloque).
  { code: 'returns.view', description: 'Ver devoluciones.' },
  { code: 'returns.create', description: 'Registrar devoluciones.' },
  { code: 'purchases.view', description: 'Ver compras.' },
  { code: 'purchases.create', description: 'Registrar compras.' },
  { code: 'inventory.view', description: 'Ver inventario.' },
  { code: 'inventory.adjust', description: 'Ajustar inventario.' },
  // Bloque 5.2 (infraestructura base de Mermas): permiso sembrado ahora
  // para que la estructura este completa, sin endpoint todavia que lo
  // verifique (sin logica de negocio en este bloque). Distinto de
  // `inventory.adjust` a proposito — Ajuste y Merma son conceptos
  // distintos (ver analisis del Bloque 5, seccion 2).
  { code: 'inventory.waste', description: 'Registrar mermas de inventario.' },
  // Bloque LOTES-01 (infraestructura base del Modulo de Lotes): permisos
  // sembrados ahora, mismo criterio que `returns.*`/`inventory.waste`
  // (estructura completa desde ya, sin logica de negocio todavia en este
  // bloque). Forma angosta (view/create/adjust), no CRUD completo, mismo
  // criterio que Inventario: los lotes se crean automaticamente desde
  // Compras (LOTES-02), `batches.create` es solo para el caso manual/
  // excepcional (sin endpoint que lo use todavia, ver `batches/routes.ts`).
  { code: 'batches.view', description: 'Ver lotes.' },
  { code: 'batches.create', description: 'Crear lotes manualmente (fuera del flujo automático de Compras).' },
  { code: 'batches.adjust', description: 'Ajustar cantidad o bloquear/cerrar un lote.' },
  // Bloque 3 (Modulo de Despiece, plan v3): `processing.create` cubre todo
  // el ciclo de vida del borrador (alta, edicion de cabecera, cancelar) —
  // `processing.complete` es un permiso separado y mas elevado, mismo
  // criterio que `sales.void`/`sales.correct` siendo distintos de
  // `sales.create` (la accion que efectivamente descuenta/acredita
  // inventario real merece su propio permiso, no el mismo que crear un
  // borrador sin efecto en inventario).
  { code: 'processing.view', description: 'Ver operaciones de despiece.' },
  { code: 'processing.create', description: 'Crear y editar operaciones de despiece (borrador).' },
  { code: 'processing.complete', description: 'Completar operaciones de despiece.' },
  { code: 'cash.open', description: 'Abrir caja.' },
  { code: 'cash.close', description: 'Cerrar caja.' },
  { code: 'cash-movements.view', description: 'Ver movimientos de caja.' },
  { code: 'users.manage', description: 'Administrar usuarios.' },
  { code: 'roles.manage', description: 'Administrar roles y permisos.' },
  { code: 'settings.manage', description: 'Administrar configuracion del sistema.' },
  { code: 'reports.view', description: 'Ver reportes.' },
] as const;

/** Codigo de permiso valido, derivado de `INITIAL_PERMISSIONS` (unica
 * fuente de verdad de los codigos existentes). */
export type PermissionCode = (typeof INITIAL_PERMISSIONS)[number]['code'];

/** Asociacion rol -> permisos (matriz aprobada en la auditoria de
 * Seguridad). Unica fuente de verdad: ADMIN se deriva de todos los
 * codigos declarados en `INITIAL_PERMISSIONS` (no se repite la lista a
 * mano); MANAGER tiene alcance operativo de sucursal sin administracion
 * del sistema; CASHIER solo puede vender y abrir/cerrar su propia caja. */
export const ROLE_PERMISSION_CODES: Record<SystemRoleName, readonly PermissionCode[]> = {
  [SystemRole.ADMIN]: INITIAL_PERMISSIONS.map((permission) => permission.code),
  [SystemRole.MANAGER]: [
    'products.view',
    'products.create',
    'products.update',
    'categories.view',
    'taxes.view',
    'promotions.view',
    'suppliers.view',
    'customers.view',
    'customers.create',
    'customers.update',
    'sales.view',
    'sales.create',
    'sales.void',
    'sales.correct',
    'returns.view',
    'returns.create',
    'purchases.view',
    'purchases.create',
    'inventory.view',
    'inventory.adjust',
    'inventory.waste',
    'batches.view',
    'batches.create',
    'batches.adjust',
    'processing.view',
    'processing.create',
    'processing.complete',
    'cash.open',
    'cash.close',
    'cash-movements.view',
    'reports.view',
    // Estos tres se restauran para preservar el acceso de lectura que
    // MANAGER ya tenia antes de migrar estos endpoints de `authorize(ADMIN,
    // MANAGER)` a `authorizePermission(...)` (ver users/roles/permissions/
    // configuration routes.ts): reutilizan los mismos codigos de escritura
    // que ADMIN, unicamente para no perder el acceso previo de lectura.
    'users.manage',
    'roles.manage',
    'settings.manage',
  ],
  // Rediseño de Caja: CASHIER necesita leer el resumen de su propia sesión
  // (`GET /reports/cash/:id`, `reports.view`) y sus movimientos
  // (`GET /cash/movements`, `cash-movements.view`) para operar el nuevo
  // workspace — ambos de solo lectura, mínimo privilegio (sin agregar
  // ningún permiso de escritura/administrativo adicional).
  [SystemRole.CASHIER]: [
    'sales.create',
    'cash.open',
    'cash.close',
    'reports.view',
    'cash-movements.view',
  ],
};

async function seedPermissions() {
  const permissions = [];

  for (const permission of INITIAL_PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
    permissions.push(created);
  }

  logger.info({ total: permissions.length }, 'Permisos iniciales listos.');
  return permissions;
}

/** Indice codigo -> id de permiso, construido una sola vez a partir de los
 * permisos ya sembrados. Evita recorrer el arreglo completo de permisos
 * (`filter` + `map`) una vez por cada rol. */
function indexPermissionsByCode(permissions: { id: string; code: string }[]): Map<string, string> {
  return new Map(permissions.map((permission) => [permission.code, permission.id]));
}

/** Resuelve los ids de permiso para una lista de codigos usando el indice
 * ya construido (busqueda O(1) por codigo, en vez de recorrer el arreglo
 * completo de permisos por cada rol). */
function resolvePermissionIds(
  codes: readonly string[],
  permissionIndex: Map<string, string>,
): string[] {
  return codes.map((code) => {
    const id = permissionIndex.get(code);

    if (!id) {
      throw new Error(`Permiso "${code}" no fue sembrado (falta en INITIAL_PERMISSIONS).`);
    }

    return id;
  });
}

async function seedRolePermissions(roleId: string, permissionIds: string[]) {
  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  }

  logger.info({ roleId, total: permissionIds.length }, 'Relacion rol-permisos lista.');
}

async function seedAdminRole() {
  const role = await prisma.role.upsert({
    where: { name: SystemRole.ADMIN },
    update: {},
    create: {
      name: SystemRole.ADMIN,
      description: 'Administrador del sistema, con acceso total.',
      isSystem: true,
      active: true,
    },
  });

  logger.info({ roleId: role.id }, 'Rol ADMIN listo.');
  return role;
}

async function seedManagerRole() {
  const role = await prisma.role.upsert({
    where: { name: SystemRole.MANAGER },
    update: {},
    create: {
      name: SystemRole.MANAGER,
      description: 'Gerente de sucursal, con acceso operativo sin administracion del sistema.',
      isSystem: true,
      active: true,
    },
  });

  logger.info({ roleId: role.id }, 'Rol MANAGER listo.');
  return role;
}

async function seedCashierRole() {
  const role = await prisma.role.upsert({
    where: { name: SystemRole.CASHIER },
    update: {},
    create: {
      name: SystemRole.CASHIER,
      description: 'Cajero, opera el punto de venta y su propia caja.',
      isSystem: true,
      active: true,
    },
  });

  logger.info({ roleId: role.id }, 'Rol CASHIER listo.');
  return role;
}

/**
 * Unico punto de entrada de este archivo: sincroniza `Permission`/`Role`/
 * `RolePermission` contra `INITIAL_PERMISSIONS`/`ROLE_PERMISSION_CODES` de
 * arriba. 100% `upsert` — nunca borra una fila, nunca toca `Sucursal`/
 * `CashRegister`/`User`/`Configuration` ni el catalogo de negocio. Seguro
 * de invocar en cada arranque de la aplicacion, tantas veces como haga
 * falta.
 */
export async function seedPermissionsAndRoles() {
  const permissions = await seedPermissions();
  const permissionIndex = indexPermissionsByCode(permissions);

  const adminRole = await seedAdminRole();
  await seedRolePermissions(
    adminRole.id,
    resolvePermissionIds(ROLE_PERMISSION_CODES[SystemRole.ADMIN], permissionIndex),
  );

  const managerRole = await seedManagerRole();
  await seedRolePermissions(
    managerRole.id,
    resolvePermissionIds(ROLE_PERMISSION_CODES[SystemRole.MANAGER], permissionIndex),
  );

  const cashierRole = await seedCashierRole();
  await seedRolePermissions(
    cashierRole.id,
    resolvePermissionIds(ROLE_PERMISSION_CODES[SystemRole.CASHIER], permissionIndex),
  );

  return { adminRole, managerRole, cashierRole };
}
