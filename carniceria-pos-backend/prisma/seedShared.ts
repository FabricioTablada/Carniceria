/**
 * prisma/seedShared.ts
 * -----------------------------------------------------------------------------
 * Fix (07/08/2026, separación bootstrap/demo): `seedCategories`/`seedTaxes`
 * (y sus datos) eran parte de `seed.ts`, junto al dataset de demostración
 * (Proveedores/Productos/Inventario/Promociones). Se extraen a este módulo
 * compartido, SIN cambiar su contenido ni su lógica, porque tanto
 * `seed.ts` (instalación nueva — las conserva) como `seed-demo.ts`
 * (dataset de prueba manual — las necesita para poder construir productos/
 * promociones) las usan. Este archivo NUNCA se ejecuta solo — no tiene
 * `main()` propio, solo exporta funciones puras.
 */
import { prisma } from '../src/database/prisma.client';
import { logger } from '../src/config';

// Categorías — nombres EXACTOS ya mapeados en `data/categoryImages.ts`
// (evita tocar ese archivo y garantiza que todo producto tenga imagen
// representativa real desde el primer momento).
export const CATEGORIES = [
  { name: 'Carnes de Res', description: 'Cortes de res frescos.' },
  { name: 'Carnes de Cerdo', description: 'Cortes de cerdo frescos.' },
  { name: 'Carnes de Pollo', description: 'Pollo fresco y sus cortes.' },
  { name: 'Embutidos', description: 'Chorizos, jamones y embutidos en general.' },
  { name: 'Mariscos', description: 'Pescados y mariscos frescos.' },
  { name: 'Vísceras y Menudencias', description: 'Vísceras y menudencias frescas.' },
  { name: 'Condimentos y Salsas', description: 'Sazonadores, marinadas y salsas para carnes.' },
  { name: 'Empaques y Desechables', description: 'Insumos para empacar productos.' },
] as const;

export type CategoryName = (typeof CATEGORIES)[number]['name'];

export async function seedCategories() {
  const categories = [];

  for (const category of CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { name: category.name },
      update: { description: category.description },
      create: category,
    });
    categories.push(created);
  }

  logger.info({ total: categories.length }, 'Categorías listas.');
  return categories;
}

/**
 * Dos impuestos únicamente (decisión explícita del negocio, no del motor de
 * cálculo): carne fresca sin procesar está EXENTA de IVA en Costa Rica;
 * productos procesados/empacados llevan la tasa estándar del 13%.
 */
export const TAX_EXEMPT = { code: 'EXENTO', name: 'Exento', rate: 0, isDefault: true } as const;
export const TAX_IVA13 = { code: 'IVA13', name: 'IVA 13%', rate: 13, isDefault: false } as const;

export type TaxCode = typeof TAX_EXEMPT.code | typeof TAX_IVA13.code;

export async function seedTaxes() {
  const exempt = await prisma.tax.upsert({
    where: { code: TAX_EXEMPT.code },
    update: { name: TAX_EXEMPT.name, rate: TAX_EXEMPT.rate, isDefault: TAX_EXEMPT.isDefault },
    create: TAX_EXEMPT,
  });

  const iva13 = await prisma.tax.upsert({
    where: { code: TAX_IVA13.code },
    update: { name: TAX_IVA13.name, rate: TAX_IVA13.rate, isDefault: TAX_IVA13.isDefault },
    create: TAX_IVA13,
  });

  logger.info({ total: 2 }, 'Impuestos listos.');
  return { exempt, iva13 };
}
