/**
 * prisma/reset-transactions.ts
 * -----------------------------------------------------------------------------
 * Limpia UNICAMENTE datos transaccionales/operativos (ventas, compras, cajas,
 * movimientos de inventario, devoluciones, mermas, facturas, auditoria) para
 * empezar pruebas funcionales del POS desde cero — deja el CATALOGO intacto
 * (Category, Product, Supplier, Tax, Promotion) tal como lo deja
 * `npm run prisma:seed` (el seed principal y unico del proyecto).
 *
 * Que NUNCA toca: User, Role, Permission, RolePermission, RefreshToken,
 * Configuration, Sucursal, CashRegister, Category, Product, Supplier, Tax,
 * Promotion, PromotionProduct, PromotionCategory.
 *
 * Que borra (orden que respeta las FK, ver `resetCatalogData` de
 * `seed.ts` para el mismo razonamiento de dependencias):
 *   InventoryWaste -> SaleReturnItem -> SaleReturn -> Invoice -> SaleItem
 *   (cascada: SaleAppliedPromotion) -> CashMovement -> Sale -> CashSession ->
 *   PurchaseItem -> Purchase -> InventoryMovement -> AuditLog ->
 *   DocumentSequence
 *
 * `Inventory` NO se borra (se preserva la fila por producto, para no perder
 * `reorderPoint`) — su `quantity` se pone en 0 para TODOS los productos
 * (decision explicita: sin historial de movimientos, no hay stock que
 * respalde ningun numero distinto de 0).
 *
 * Uso: `npm run prisma:reset:transactions`. Rechaza ejecutarse si
 * `NODE_ENV=production` (fail-fast, mismo criterio que el resto de scripts
 * de este proyecto que borran datos reales).
 */
import { prisma } from '../src/database/prisma.client';
import { isProduction, logger } from '../src/config';

if (isProduction) {
  logger.error('reset-transactions.ts no puede ejecutarse con NODE_ENV=production.');
  process.exit(1);
}

async function main(): Promise<void> {
  logger.warn('Borrando datos transaccionales (ventas, compras, cajas, movimientos, reportes)...');

  await prisma.$transaction([
    prisma.inventoryWaste.deleteMany(),
    prisma.saleReturnItem.deleteMany(),
    prisma.saleReturn.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.saleItem.deleteMany(),
    prisma.cashMovement.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.cashSession.deleteMany(),
    prisma.purchaseItem.deleteMany(),
    prisma.purchase.deleteMany(),
    prisma.inventoryMovement.deleteMany(),
    prisma.inventory.updateMany({ data: { quantity: 0 } }),
    prisma.auditLog.deleteMany(),
    prisma.documentSequence.deleteMany(),
  ]);

  logger.info('Datos transaccionales eliminados. Catálogo (categorías/productos/proveedores/impuesto/promociones) intacto.');
}

main()
  .catch((error) => {
    logger.error({ err: error }, 'Error al limpiar datos transaccionales.');
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
