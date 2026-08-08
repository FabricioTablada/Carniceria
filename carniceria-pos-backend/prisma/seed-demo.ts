/**
 * prisma/seed-demo.ts
 * -----------------------------------------------------------------------------
 * Seed DE DEMOSTRACIÓN — dataset de prueba para desarrollo/QA, de uso
 * EXCLUSIVAMENTE MANUAL (`npm run prisma:seed:demo`). Nunca se ejecuta
 * automáticamente — ni en instalaciones nuevas de `carniceria-pos-desktop`
 * ni en ningún otro flujo. Requiere que el bootstrap ya exista (correr
 * `npm run prisma:seed` primero, o tener una instalación ya inicializada).
 *
 * Fix (07/08/2026, separación bootstrap/demo): este archivo es exactamente
 * el "Paso 2" que antes vivía dentro de `prisma/seed.ts` — mismo
 * contenido, misma lógica, sin ningún cambio de comportamiento. Se movió
 * acá para que una instalación nueva real (`seed.ts`) ya no reciba este
 * dataset automáticamente. `seedCategories`/`seedTaxes` se reutilizan tal
 * cual desde `seedShared.ts` (no se duplican) porque este script necesita
 * los objetos `Category`/`Tax` para poder construir Productos/Promociones.
 *
 * Siembra (DESTRUCTIVO — `resetCatalogData` borra el dataset de negocio
 * existente antes de regenerarlo): 8 categorías, 2 impuestos, 6
 * proveedores, 80 productos reales de carnicería (cada uno con su código
 * de barras REAL, tomado exactamente del PDF `Codigos_Barras_80_A4.pdf`
 * provisto por el negocio — nunca un código inventado) con inventario
 * inicial ALTO para pruebas, y 6 promociones reales. CERO Purchases, CERO
 * Sales, CERO clientes (no existe ese modelo en este sistema).
 *
 * Lo que este script SIEMPRE preserva intacto (nunca lo toca ni lo borra):
 * User, Role, Permission, RolePermission, RefreshToken, Configuration,
 * Sucursal, CashRegister — el bootstrap sembrado por `seed.ts` debe existir
 * de antemano (`sucursal`/`adminUser` se leen de la base, no se crean acá).
 *
 * Por ser destructivo, este script — igual que `seed.ts` — rechaza
 * ejecutarse si `NODE_ENV=production` (fail-fast).
 *
 * Orden de borrado (respeta las claves foráneas):
 *   InventoryWaste -> SaleReturnItem -> SaleReturn -> Invoice -> SaleItem ->
 *   CashMovement -> Sale (cascada: SaleAppliedPromotion) -> CashSession ->
 *   PurchaseItem -> Purchase -> Promotion (cascada: PromotionProduct/
 *   PromotionCategory) -> InventoryMovement -> Inventory -> Product ->
 *   Category (parentId a null primero, es autorreferencial) -> Tax ->
 *   Supplier -> AuditLog -> DocumentSequence
 *
 * `deleteMany()` en este proyecto es SIEMPRE un borrado físico real: la
 * extensión de soft-delete (`softDelete.ext.ts`) solo filtra LECTURAS
 * (findMany/findFirst/count/aggregate) para los modelos registrados en
 * `SOFT_DELETE_MODELS`; no intercepta `delete`/`deleteMany` para ningún
 * modelo.
 */
import { InventoryMovementType, UnitOfMeasure } from '@prisma/client';
import { prisma } from '../src/database/prisma.client';
import { isProduction, logger } from '../src/config';
import { imageUrlForCategory } from './data/categoryImages';
import { type CategoryName, type TaxCode, seedCategories, seedTaxes } from './seedShared';

if (isProduction) {
  logger.error('seed-demo.ts no puede ejecutarse con NODE_ENV=production (es destructivo).');
  process.exit(1);
}

const DEFAULT_SUCURSAL_CODE = 'PRINCIPAL';

/** `daysAgo(0)` = ahora mismo; `daysAgo(-N)` = N días en el futuro. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Códigos de barras — EXACTAMENTE los 80 del PDF `Codigos_Barras_80_A4.pdf`
// provisto por el negocio, en el mismo orden en que aparecen (página 1:
// 001-028, página 2: 029-056, página 3: 057-080). Nunca se inventan
// códigos: cada producto de `PRODUCTS` (abajo) toma uno de esta lista por
// posición (índice 0-based).
const BARCODES: string[] = Array.from({ length: 80 }, (_, i) =>
  `750000000${String(i + 1).padStart(3, '0')}`,
);

const SUPPLIERS = [
  {
    name: 'Cárnicos San Rafael S.A.',
    legalId: '3-101-600001',
    contactName: 'Rodrigo Vargas',
    phone: '2233-6001',
    email: 'ventas@carnicossanrafael.cr',
  },
  {
    name: 'Distribuidora Porcina del Norte S.A.',
    legalId: '3-101-600002',
    contactName: 'Marcela Solís',
    phone: '2233-6002',
    email: 'ventas@porcinadelnorte.cr',
  },
  {
    name: 'Avícola Santa Cruz S.A.',
    legalId: '3-101-600003',
    contactName: 'Esteban Rojas',
    phone: '2233-6003',
    email: 'ventas@avicolasantacruz.cr',
  },
  {
    name: 'Mariscos del Golfo S.A.',
    legalId: '3-101-600004',
    contactName: 'Diana Campos',
    phone: '2233-6004',
    email: 'ventas@mariscosdelgolfo.cr',
  },
  {
    name: 'Embutidos La Finca S.A.',
    legalId: '3-101-600005',
    contactName: 'Carlos Jiménez',
    phone: '2233-6005',
    email: 'ventas@lafinca.cr',
  },
  {
    name: 'Insumos y Empaques CR S.A.',
    legalId: '3-101-600006',
    contactName: 'Karla Méndez',
    phone: '2233-6006',
    email: 'ventas@insumosempaquescr.cr',
  },
] as const;

type SupplierLegalId = (typeof SUPPLIERS)[number]['legalId'];

interface ProductSeed {
  sku: string;
  name: string;
  category: CategoryName;
  unit: UnitOfMeasure;
  taxCode: TaxCode;
  /** Costo de compra de referencia, en CRC. */
  cost: number;
  /** Precio de venta, en CRC. */
  salePrice: number;
  /** Existencia inicial — ALTA a propósito, para pruebas de rendimiento y
   * del lector de código de barras. */
  quantity: number;
  /** Punto de reorden — siempre configurado. */
  reorderPoint: number;
  /** Proveedor principal — determina qué proveedor abastece el producto,
   * aunque este seed no genera ninguna `Purchase`. */
  supplierLegalId: SupplierLegalId;
}

/**
 * 80 productos reales de carnicería, distribuidos en las 8 categorías.
 * Cada `sku` recibe su código de barras real por POSICIÓN dentro de este
 * array (índice 0-based sobre `BARCODES`) — ver `seedProductsAndInventory`.
 */
const PRODUCTS: ProductSeed[] = [
  // -------------------------------------------------------------------
  // Carnes de Res (16) — barcodes[0..15]
  // -------------------------------------------------------------------
  { sku: 'RES-001', name: 'Lomito de Res', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 6800, salePrice: 9800, quantity: 220, reorderPoint: 30, supplierLegalId: '3-101-600001' },
  { sku: 'RES-002', name: 'Lomo Ancho (Ribeye)', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 7200, salePrice: 10500, quantity: 180, reorderPoint: 25, supplierLegalId: '3-101-600001' },
  { sku: 'RES-003', name: 'Filete de Res', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 6500, salePrice: 9200, quantity: 200, reorderPoint: 30, supplierLegalId: '3-101-600001' },
  { sku: 'RES-004', name: 'Punta de Lomo', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 5800, salePrice: 8200, quantity: 160, reorderPoint: 25, supplierLegalId: '3-101-600001' },
  { sku: 'RES-005', name: 'Bistec de Res', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 4200, salePrice: 6100, quantity: 260, reorderPoint: 35, supplierLegalId: '3-101-600001' },
  { sku: 'RES-006', name: 'Carne Molida de Res Especial', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3800, salePrice: 5500, quantity: 240, reorderPoint: 35, supplierLegalId: '3-101-600001' },
  { sku: 'RES-007', name: 'Carne Molida de Res Regular', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3200, salePrice: 4700, quantity: 280, reorderPoint: 40, supplierLegalId: '3-101-600001' },
  { sku: 'RES-008', name: 'Costilla de Res', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3400, salePrice: 5000, quantity: 190, reorderPoint: 30, supplierLegalId: '3-101-600001' },
  { sku: 'RES-009', name: 'Falda de Res', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2800, salePrice: 4100, quantity: 150, reorderPoint: 25, supplierLegalId: '3-101-600001' },
  { sku: 'RES-010', name: 'Posta de Pierna', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3600, salePrice: 5300, quantity: 170, reorderPoint: 25, supplierLegalId: '3-101-600001' },
  { sku: 'RES-011', name: 'Posta de Cuadril', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3900, salePrice: 5700, quantity: 160, reorderPoint: 25, supplierLegalId: '3-101-600001' },
  { sku: 'RES-012', name: 'Hueso de Res para Sopa', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1500, salePrice: 2300, quantity: 120, reorderPoint: 20, supplierLegalId: '3-101-600001' },
  { sku: 'RES-013', name: 'Cola de Res', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2600, salePrice: 3900, quantity: 90, reorderPoint: 15, supplierLegalId: '3-101-600001' },
  { sku: 'RES-014', name: 'Res para Asar en Cubos', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 4000, salePrice: 5900, quantity: 200, reorderPoint: 30, supplierLegalId: '3-101-600001' },
  { sku: 'RES-015', name: 'Res para Guisar', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3300, salePrice: 4900, quantity: 210, reorderPoint: 30, supplierLegalId: '3-101-600001' },
  { sku: 'RES-016', name: 'Vuelta de Lomo', category: 'Carnes de Res', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 4600, salePrice: 6800, quantity: 140, reorderPoint: 20, supplierLegalId: '3-101-600001' },

  // -------------------------------------------------------------------
  // Carnes de Cerdo (12) — barcodes[16..27]
  // -------------------------------------------------------------------
  { sku: 'CER-001', name: 'Chuleta de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2600, salePrice: 3900, quantity: 230, reorderPoint: 35, supplierLegalId: '3-101-600002' },
  { sku: 'CER-002', name: 'Costilla de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2800, salePrice: 4200, quantity: 210, reorderPoint: 30, supplierLegalId: '3-101-600002' },
  { sku: 'CER-003', name: 'Lomo de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3100, salePrice: 4600, quantity: 180, reorderPoint: 25, supplierLegalId: '3-101-600002' },
  { sku: 'CER-004', name: 'Carne Molida de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2400, salePrice: 3600, quantity: 240, reorderPoint: 35, supplierLegalId: '3-101-600002' },
  { sku: 'CER-005', name: 'Pierna de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2500, salePrice: 3700, quantity: 160, reorderPoint: 25, supplierLegalId: '3-101-600002' },
  { sku: 'CER-006', name: 'Cerdo para Asar en Cubos', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2700, salePrice: 4000, quantity: 190, reorderPoint: 30, supplierLegalId: '3-101-600002' },
  { sku: 'CER-007', name: 'Tocineta (Panceta de Cerdo)', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3300, salePrice: 4900, quantity: 150, reorderPoint: 25, supplierLegalId: '3-101-600002' },
  { sku: 'CER-008', name: 'Chicharrón de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2900, salePrice: 4400, quantity: 140, reorderPoint: 20, supplierLegalId: '3-101-600002' },
  { sku: 'CER-009', name: 'Codo de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1800, salePrice: 2700, quantity: 100, reorderPoint: 20, supplierLegalId: '3-101-600002' },
  { sku: 'CER-010', name: 'Cabeza de Lomo de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2600, salePrice: 3900, quantity: 120, reorderPoint: 20, supplierLegalId: '3-101-600002' },
  { sku: 'CER-011', name: 'Cerdo para Guisar', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2500, salePrice: 3700, quantity: 200, reorderPoint: 30, supplierLegalId: '3-101-600002' },
  { sku: 'CER-012', name: 'Manteca de Cerdo', category: 'Carnes de Cerdo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1500, salePrice: 2300, quantity: 90, reorderPoint: 15, supplierLegalId: '3-101-600002' },

  // -------------------------------------------------------------------
  // Carnes de Pollo (12) — barcodes[28..39]
  // -------------------------------------------------------------------
  { sku: 'POL-001', name: 'Pechuga de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2200, salePrice: 3300, quantity: 260, reorderPoint: 40, supplierLegalId: '3-101-600003' },
  { sku: 'POL-002', name: 'Muslo de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1700, salePrice: 2600, quantity: 280, reorderPoint: 40, supplierLegalId: '3-101-600003' },
  { sku: 'POL-003', name: 'Contramuslo de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1750, salePrice: 2650, quantity: 250, reorderPoint: 35, supplierLegalId: '3-101-600003' },
  { sku: 'POL-004', name: 'Alitas de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1900, salePrice: 2900, quantity: 300, reorderPoint: 40, supplierLegalId: '3-101-600003' },
  { sku: 'POL-005', name: 'Pollo Entero', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2100, salePrice: 3150, quantity: 180, reorderPoint: 30, supplierLegalId: '3-101-600003' },
  { sku: 'POL-006', name: 'Menudencia de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 900, salePrice: 1400, quantity: 100, reorderPoint: 20, supplierLegalId: '3-101-600003' },
  { sku: 'POL-007', name: 'Pierna de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1800, salePrice: 2750, quantity: 240, reorderPoint: 35, supplierLegalId: '3-101-600003' },
  { sku: 'POL-008', name: 'Filete de Pechuga de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2400, salePrice: 3600, quantity: 220, reorderPoint: 35, supplierLegalId: '3-101-600003' },
  { sku: 'POL-009', name: 'Pollo para Sopa', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1500, salePrice: 2300, quantity: 130, reorderPoint: 20, supplierLegalId: '3-101-600003' },
  { sku: 'POL-010', name: 'Molleja de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1200, salePrice: 1900, quantity: 80, reorderPoint: 15, supplierLegalId: '3-101-600003' },
  { sku: 'POL-011', name: 'Carne Molida de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2000, salePrice: 3000, quantity: 170, reorderPoint: 25, supplierLegalId: '3-101-600003' },
  { sku: 'POL-012', name: 'Trutro de Pollo', category: 'Carnes de Pollo', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1850, salePrice: 2800, quantity: 210, reorderPoint: 30, supplierLegalId: '3-101-600003' },

  // -------------------------------------------------------------------
  // Embutidos (14) — barcodes[40..53]
  // -------------------------------------------------------------------
  { sku: 'EMB-001', name: 'Chorizo Criollo', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1200, salePrice: 1900, quantity: 240, reorderPoint: 40, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-002', name: 'Chorizo Parrillero', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1300, salePrice: 2000, quantity: 210, reorderPoint: 35, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-003', name: 'Salchicha Tipo Viena', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 900, salePrice: 1450, quantity: 260, reorderPoint: 40, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-004', name: 'Mortadela', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 950, salePrice: 1550, quantity: 200, reorderPoint: 30, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-005', name: 'Jamón de Pierna', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1600, salePrice: 2400, quantity: 170, reorderPoint: 25, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-006', name: 'Jamón Ahumado', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1700, salePrice: 2550, quantity: 150, reorderPoint: 25, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-007', name: 'Salchichón', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1100, salePrice: 1700, quantity: 190, reorderPoint: 30, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-008', name: 'Longaniza', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1250, salePrice: 1950, quantity: 180, reorderPoint: 30, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-009', name: 'Tocineta Ahumada Empacada', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1500, salePrice: 2300, quantity: 160, reorderPoint: 25, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-010', name: 'Salami', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1800, salePrice: 2700, quantity: 130, reorderPoint: 20, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-011', name: 'Chuleta Ahumada', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1900, salePrice: 2850, quantity: 120, reorderPoint: 20, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-012', name: 'Butifarra', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1300, salePrice: 2000, quantity: 140, reorderPoint: 20, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-013', name: 'Morcilla Rellena', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1100, salePrice: 1750, quantity: 100, reorderPoint: 20, supplierLegalId: '3-101-600005' },
  { sku: 'EMB-014', name: 'Pepperoni', category: 'Embutidos', unit: 'UNIT', taxCode: 'IVA13', cost: 1650, salePrice: 2500, quantity: 110, reorderPoint: 20, supplierLegalId: '3-101-600005' },

  // -------------------------------------------------------------------
  // Mariscos (10) — barcodes[54..63]
  // -------------------------------------------------------------------
  { sku: 'MAR-001', name: 'Camarón Mediano', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 6500, salePrice: 9800, quantity: 120, reorderPoint: 20, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-002', name: 'Camarón Jumbo', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 8200, salePrice: 12300, quantity: 90, reorderPoint: 15, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-003', name: 'Filete de Corvina', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 4200, salePrice: 6300, quantity: 140, reorderPoint: 20, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-004', name: 'Filete de Tilapia', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3400, salePrice: 5100, quantity: 160, reorderPoint: 25, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-005', name: 'Pescado Entero (Pargo)', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3800, salePrice: 5700, quantity: 100, reorderPoint: 15, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-006', name: 'Pulpo', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 7500, salePrice: 11200, quantity: 60, reorderPoint: 10, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-007', name: 'Calamar', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 4600, salePrice: 6900, quantity: 100, reorderPoint: 15, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-008', name: 'Almeja', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 5200, salePrice: 7800, quantity: 80, reorderPoint: 15, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-009', name: 'Filete de Dorado', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 4800, salePrice: 7200, quantity: 90, reorderPoint: 15, supplierLegalId: '3-101-600004' },
  { sku: 'MAR-010', name: 'Mejillones', category: 'Mariscos', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 3600, salePrice: 5400, quantity: 90, reorderPoint: 15, supplierLegalId: '3-101-600004' },

  // -------------------------------------------------------------------
  // Vísceras y Menudencias (6) — barcodes[64..69]
  // -------------------------------------------------------------------
  { sku: 'VIS-001', name: 'Hígado de Res', category: 'Vísceras y Menudencias', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1400, salePrice: 2100, quantity: 80, reorderPoint: 15, supplierLegalId: '3-101-600001' },
  { sku: 'VIS-002', name: 'Hígado de Pollo', category: 'Vísceras y Menudencias', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 900, salePrice: 1400, quantity: 90, reorderPoint: 15, supplierLegalId: '3-101-600003' },
  { sku: 'VIS-003', name: 'Riñón de Res', category: 'Vísceras y Menudencias', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1300, salePrice: 2000, quantity: 60, reorderPoint: 10, supplierLegalId: '3-101-600001' },
  { sku: 'VIS-004', name: 'Lengua de Res', category: 'Vísceras y Menudencias', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 2600, salePrice: 3900, quantity: 50, reorderPoint: 10, supplierLegalId: '3-101-600001' },
  { sku: 'VIS-005', name: 'Mondongo (Callo de Res)', category: 'Vísceras y Menudencias', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1800, salePrice: 2700, quantity: 70, reorderPoint: 15, supplierLegalId: '3-101-600001' },
  { sku: 'VIS-006', name: 'Corazón de Res', category: 'Vísceras y Menudencias', unit: 'KILOGRAM', taxCode: 'EXENTO', cost: 1200, salePrice: 1900, quantity: 60, reorderPoint: 10, supplierLegalId: '3-101-600001' },

  // -------------------------------------------------------------------
  // Condimentos y Salsas (6) — barcodes[70..75]
  // -------------------------------------------------------------------
  { sku: 'CON-001', name: 'Sal Gruesa para Carnes', category: 'Condimentos y Salsas', unit: 'UNIT', taxCode: 'IVA13', cost: 500, salePrice: 850, quantity: 200, reorderPoint: 30, supplierLegalId: '3-101-600006' },
  { sku: 'CON-002', name: 'Adobo para Carnes', category: 'Condimentos y Salsas', unit: 'UNIT', taxCode: 'IVA13', cost: 900, salePrice: 1450, quantity: 180, reorderPoint: 30, supplierLegalId: '3-101-600006' },
  { sku: 'CON-003', name: 'Sazonador para Pollo', category: 'Condimentos y Salsas', unit: 'UNIT', taxCode: 'IVA13', cost: 850, salePrice: 1350, quantity: 170, reorderPoint: 25, supplierLegalId: '3-101-600006' },
  { sku: 'CON-004', name: 'Marinada para Res (BBQ)', category: 'Condimentos y Salsas', unit: 'UNIT', taxCode: 'IVA13', cost: 1100, salePrice: 1700, quantity: 140, reorderPoint: 20, supplierLegalId: '3-101-600006' },
  { sku: 'CON-005', name: 'Chimichurri Preparado', category: 'Condimentos y Salsas', unit: 'UNIT', taxCode: 'IVA13', cost: 950, salePrice: 1500, quantity: 130, reorderPoint: 20, supplierLegalId: '3-101-600006' },
  { sku: 'CON-006', name: 'Pimienta Negra Molida', category: 'Condimentos y Salsas', unit: 'UNIT', taxCode: 'IVA13', cost: 1300, salePrice: 2000, quantity: 150, reorderPoint: 25, supplierLegalId: '3-101-600006' },

  // -------------------------------------------------------------------
  // Empaques y Desechables (4) — barcodes[76..79]
  // -------------------------------------------------------------------
  { sku: 'EMP-001', name: 'Bolsas Plásticas para Carne', category: 'Empaques y Desechables', unit: 'UNIT', taxCode: 'IVA13', cost: 2200, salePrice: 3300, quantity: 200, reorderPoint: 30, supplierLegalId: '3-101-600006' },
  { sku: 'EMP-002', name: 'Bandejas de Poliestireno', category: 'Empaques y Desechables', unit: 'UNIT', taxCode: 'IVA13', cost: 3100, salePrice: 4600, quantity: 180, reorderPoint: 30, supplierLegalId: '3-101-600006' },
  { sku: 'EMP-003', name: 'Papel Film para Empacar', category: 'Empaques y Desechables', unit: 'UNIT', taxCode: 'IVA13', cost: 2800, salePrice: 4200, quantity: 100, reorderPoint: 15, supplierLegalId: '3-101-600006' },
  { sku: 'EMP-004', name: 'Guantes Desechables', category: 'Empaques y Desechables', unit: 'UNIT', taxCode: 'IVA13', cost: 1800, salePrice: 2700, quantity: 150, reorderPoint: 25, supplierLegalId: '3-101-600006' },
];

if (PRODUCTS.length !== BARCODES.length) {
  throw new Error(
    `PRODUCTS (${PRODUCTS.length}) y BARCODES (${BARCODES.length}) deben tener exactamente el mismo largo — cada producto toma un código de barras real por posición.`,
  );
}

interface PromotionProductRef {
  sku: string;
}

interface PromotionSeed {
  name: string;
  description?: string;
  scopeType: 'PRODUCT' | 'CATEGORY' | 'CART';
  effectType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_PAY_Y';
  effectValue?: number;
  buyQuantity?: number;
  payQuantity?: number;
  startDate?: Date;
  endDate?: Date;
  daysOfWeek?: ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY')[];
  productSkus?: PromotionProductRef[];
  categoryNames?: CategoryName[];
}

/**
 * 6 promociones reales: 2x1, "Compra 2 Paga 1", "Martes de Pollo",
 * descuento en Mariscos, descuento porcentual en Embutidos, y una
 * promoción temporal (con `startDate`/`endDate`).
 */
const PROMOTIONS: PromotionSeed[] = [
  {
    name: '2x1 en Chorizo Criollo',
    description: 'Lleve 2 unidades de Chorizo Criollo y pague solo 1.',
    scopeType: 'PRODUCT',
    effectType: 'BUY_X_PAY_Y',
    buyQuantity: 2,
    payQuantity: 1,
    productSkus: [{ sku: 'EMB-001' }],
  },
  {
    name: 'Compra 2 Paga 1 en Alitas de Pollo',
    description: 'Lleve 2 kg de Alitas de Pollo y pague solo 1 kg.',
    scopeType: 'PRODUCT',
    effectType: 'BUY_X_PAY_Y',
    buyQuantity: 2,
    payQuantity: 1,
    productSkus: [{ sku: 'POL-004' }],
  },
  {
    name: 'Martes de Pollo',
    description: '15% de descuento en toda la categoría Carnes de Pollo, solo los martes.',
    scopeType: 'CATEGORY',
    effectType: 'PERCENTAGE',
    effectValue: 15,
    daysOfWeek: ['TUESDAY'],
    categoryNames: ['Carnes de Pollo'],
  },
  {
    name: 'Descuento en Mariscos',
    description: '10% de descuento en toda la categoría Mariscos.',
    scopeType: 'CATEGORY',
    effectType: 'PERCENTAGE',
    effectValue: 10,
    categoryNames: ['Mariscos'],
  },
  {
    name: 'Descuento Porcentual en Embutidos',
    description: '12% de descuento en toda la categoría Embutidos.',
    scopeType: 'CATEGORY',
    effectType: 'PERCENTAGE',
    effectValue: 12,
    categoryNames: ['Embutidos'],
  },
  {
    name: 'Promoción Temporal de Fin de Año',
    description: '8% de descuento en toda la compra, vigente por tiempo limitado.',
    scopeType: 'CART',
    effectType: 'PERCENTAGE',
    effectValue: 8,
    startDate: daysAgo(-1),
    endDate: daysAgo(-15),
  },
];

/**
 * Borra el dataset de negocio existente, en el orden que respeta las
 * claves foráneas. Todo dentro de una única transacción: si algún paso
 * falla, no queda la base a medio limpiar. NUNCA toca User/Role/
 * Permission/RolePermission/RefreshToken/Configuration/Sucursal/
 * CashRegister (sembrados por `seed.ts`).
 */
async function resetCatalogData(): Promise<void> {
  logger.warn('Reiniciando dataset de negocio existente...');

  await prisma.$transaction([
    prisma.inventoryWaste.deleteMany(),
    prisma.saleReturnItem.deleteMany(),
    prisma.saleReturn.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.saleItem.deleteMany(),
    prisma.cashMovement.deleteMany(),
    // Cascada: borrar Sale se lleva sus SaleAppliedPromotion.
    prisma.sale.deleteMany(),
    prisma.cashSession.deleteMany(),
    prisma.purchaseItem.deleteMany(),
    prisma.purchase.deleteMany(),
    // Cascada: borrar Promotion se lleva PromotionProduct/PromotionCategory.
    // Debe ir ANTES de Product/Category (esas dos tablas SI se referencian
    // sin cascada desde PromotionProduct/PromotionCategory).
    prisma.promotion.deleteMany(),
    prisma.inventoryMovement.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.product.deleteMany(),
    // Category es autorreferencial (parentId -> Category, sin onDelete:
    // Cascade): hay que cortar la referencia antes de poder borrar todas
    // las filas sin violar la FK.
    prisma.category.updateMany({ data: { parentId: null } }),
    prisma.category.deleteMany(),
    prisma.tax.deleteMany(),
    prisma.supplier.deleteMany(),
    // Sin relación FK real (entityId es un string suelto, sin @relation),
    // pero se limpia para no dejar logs huérfanos apuntando a entidades
    // que ya no existen.
    prisma.auditLog.deleteMany(),
    prisma.documentSequence.deleteMany(),
  ]);

  logger.info('Dataset de negocio anterior eliminado.');
}

async function seedSuppliers() {
  const suppliers = [];

  for (const supplier of SUPPLIERS) {
    const created = await prisma.supplier.upsert({
      where: { legalId: supplier.legalId },
      update: {
        name: supplier.name,
        contactName: supplier.contactName,
        phone: supplier.phone,
        email: supplier.email,
      },
      create: supplier,
    });
    suppliers.push(created);
  }

  logger.info({ total: suppliers.length }, 'Proveedores listos.');
  return suppliers;
}

/**
 * Siembra los 80 productos + su inventario inicial (ALTO, sin ninguna
 * `Purchase`). Cada producto recibe su código de barras real por posición
 * (índice sobre `BARCODES`, ver validación de largo arriba) y un
 * `InventoryMovement` tipo `INITIAL` que documenta el saldo cargado.
 */
async function seedProductsAndInventory(
  sucursalId: string,
  userId: string,
  categories: { id: string; name: string }[],
  taxes: { exempt: { id: string }; iva13: { id: string } },
): Promise<{ id: string; sku: string }[]> {
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  const taxIdByCode: Record<TaxCode, string> = {
    EXENTO: taxes.exempt.id,
    IVA13: taxes.iva13.id,
  };
  const createdProducts: { id: string; sku: string }[] = [];

  for (const [index, item] of PRODUCTS.entries()) {
    const categoryId = categoryIdByName.get(item.category);

    if (!categoryId) {
      throw new Error(`No se pudo resolver la categoría "${item.category}" para el producto "${item.name}".`);
    }

    const barcode = BARCODES[index];
    const imageUrl = imageUrlForCategory(item.category);
    const taxId = taxIdByCode[item.taxCode];

    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        categoryId,
        taxId,
        barcode,
        unitOfMeasure: item.unit,
        cost: item.cost,
        salePrice: item.salePrice,
        imageUrl,
        active: true,
      },
      create: {
        sku: item.sku,
        barcode,
        name: item.name,
        categoryId,
        taxId,
        unitOfMeasure: item.unit,
        cost: item.cost,
        salePrice: item.salePrice,
        imageUrl,
        active: true,
      },
    });

    createdProducts.push({ id: product.id, sku: product.sku! });

    await prisma.inventory.upsert({
      where: { productId_sucursalId: { productId: product.id, sucursalId } },
      update: { quantity: item.quantity, reorderPoint: item.reorderPoint },
      create: {
        productId: product.id,
        sucursalId,
        quantity: item.quantity,
        reorderPoint: item.reorderPoint,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        sucursalId,
        productId: product.id,
        userId,
        type: InventoryMovementType.INITIAL,
        quantity: item.quantity,
        balanceAfter: item.quantity,
        referenceType: null,
        referenceId: null,
        reason: 'Carga inicial de inventario (dataset de carnicería).',
      },
    });
  }

  logger.info({ total: createdProducts.length }, 'Productos e inventario inicial listos.');
  return createdProducts;
}

async function seedPromotions(
  categories: { id: string; name: string }[],
  products: { id: string; sku: string }[],
): Promise<number> {
  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  const productIdBySku = new Map(products.map((product) => [product.sku, product.id]));

  let total = 0;

  for (const promotion of PROMOTIONS) {
    const productRefs = (promotion.productSkus ?? []).map((ref) => {
      const productId = productIdBySku.get(ref.sku);

      if (!productId) {
        throw new Error(`No se pudo resolver el producto "${ref.sku}" para la promoción "${promotion.name}".`);
      }

      return { productId, requiredQuantity: null };
    });

    const categoryRefs = (promotion.categoryNames ?? []).map((name) => {
      const categoryId = categoryIdByName.get(name);

      if (!categoryId) {
        throw new Error(`No se pudo resolver la categoría "${name}" para la promoción "${promotion.name}".`);
      }

      return { categoryId };
    });

    await prisma.promotion.create({
      data: {
        name: promotion.name,
        description: promotion.description ?? null,
        scopeType: promotion.scopeType,
        effectType: promotion.effectType,
        effectValue: promotion.effectValue ?? null,
        buyQuantity: promotion.buyQuantity ?? null,
        payQuantity: promotion.payQuantity ?? null,
        minQuantity: null,
        startDate: promotion.startDate ?? null,
        endDate: promotion.endDate ?? null,
        startTime: null,
        endTime: null,
        daysOfWeek: promotion.daysOfWeek ?? [],
        priority: 0,
        stackable: false,
        exclusiveGroup: null,
        active: true,
        products: { create: productRefs },
        categories: { create: categoryRefs },
      },
    });

    total += 1;
  }

  logger.info({ total }, 'Promociones listas.');
  return total;
}

async function main(): Promise<void> {
  logger.info('Ejecutando seed DEMO (dataset de prueba para desarrollo/QA)...');

  const sucursal = await prisma.sucursal.findFirstOrThrow({ where: { code: DEFAULT_SUCURSAL_CODE } });
  const adminUser = await prisma.user.findFirstOrThrow({ where: { username: 'admin' } });

  await resetCatalogData();

  const categories = await seedCategories();
  const taxes = await seedTaxes();
  await seedSuppliers();
  const products = await seedProductsAndInventory(sucursal.id, adminUser.id, categories, taxes);
  await seedPromotions(categories, products);

  logger.info('Seed DEMO completado.');
}

main()
  .catch((error) => {
    logger.error({ err: error }, 'Error en el seed demo.');
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
