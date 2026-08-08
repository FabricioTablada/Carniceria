/**
 * constants/permissions.ts
 * -----------------------------------------------------------------------------
 * Catalogo de permisos del frontend. Debe reflejar EXACTAMENTE el catalogo
 * sembrado en el backend (`prisma/seed.ts` -> INITIAL_PERMISSIONS), ya que
 * estos codigos viajan tal cual en `user.permissions` desde POST /auth/login.
 * No agregar codigos que no existan en el backend.
 */
export const PERMISSIONS = {
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',

  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_DELETE: 'categories.delete',
  TAXES_VIEW: 'taxes.view',
  TAXES_CREATE: 'taxes.create',
  TAXES_UPDATE: 'taxes.update',
  TAXES_DELETE: 'taxes.delete',

  PROMOTIONS_VIEW: 'promotions.view',
  PROMOTIONS_CREATE: 'promotions.create',
  PROMOTIONS_UPDATE: 'promotions.update',
  PROMOTIONS_DELETE: 'promotions.delete',

  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_CREATE: 'suppliers.create',
  SUPPLIERS_UPDATE: 'suppliers.update',
  SUPPLIERS_DELETE: 'suppliers.delete',

  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',

  SALES_VIEW: 'sales.view',
  SALES_CREATE: 'sales.create',
  SALES_VOID: 'sales.void',
  SALES_CORRECT: 'sales.correct',

  RETURNS_VIEW: 'returns.view',
  RETURNS_CREATE: 'returns.create',

  PURCHASES_VIEW: 'purchases.view',
  PURCHASES_CREATE: 'purchases.create',

  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_WASTE: 'inventory.waste',

  BATCHES_VIEW: 'batches.view',
  BATCHES_ADJUST: 'batches.adjust',

  CASH_OPEN: 'cash.open',
  CASH_CLOSE: 'cash.close',
  CASH_MOVEMENTS_VIEW: 'cash-movements.view',

  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',

  SETTINGS_MANAGE: 'settings.manage',

  REPORTS_VIEW: 'reports.view',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]