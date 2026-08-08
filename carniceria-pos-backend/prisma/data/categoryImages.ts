/**
 * prisma/data/categoryImages.ts
 * -----------------------------------------------------------------------------
 * Bloque "Imágenes 2" — mapa único de categoría -> nombre de archivo de
 * imagen representativa. Los archivos físicos viven en
 * `storage/product-images/<archivo>` (backend, ver Bloque "Imágenes 1"),
 * servidos bajo `PRODUCT_IMAGES_URL_PREFIX`. Toda construcción de la URL
 * final pasa por `buildProductImageUrl()` (`config/productImages.ts`) —
 * este archivo solo mapea nombre de categoría -> nombre de archivo, nunca
 * construye la URL él mismo (evita hardcodear rutas/hosts en los seeds).
 *
 * Una imagen POR CATEGORÍA, no una por producto: los 108 productos
 * comparten 34 fotografías reales según su categoría — decisión de
 * mantenimiento, consistencia visual y escalabilidad ya aprobada en la
 * revisión arquitectónica del bloque de imágenes (reutilizar imágenes
 * dentro de una misma categoría es intencional, no una limitación).
 *
 * Las 8 categorías sembradas hoy por `prisma/seed.ts` (el seed principal
 * del proyecto) ya están cubiertas por este mapa; las claves restantes
 * quedan disponibles para categorías creadas manualmente desde el
 * catálogo administrativo. Si se agrega una categoría nueva, este mapa
 * debe crecer junto con ella — `imageUrlForCategory()` falla rápido
 * (lanza) si falta una entrada, en vez de dejar un producto sin imagen en
 * silencio.
 */
import { buildProductImageUrl } from '../../src/config';

export const CATEGORY_IMAGE_FILENAMES: Record<string, string> = {
  'Carnes de Res': 'carnes-de-res.jpg',
  'Carnes de Cerdo': 'carnes-de-cerdo.jpg',
  'Carnes de Pollo': 'carnes-de-pollo.jpg',
  Embutidos: 'embutidos.jpg',
  Mariscos: 'mariscos.jpg',
  Lácteos: 'lacteos.jpg',
  Bebidas: 'bebidas.jpg',
  Abarrotes: 'abarrotes.jpg',
  'Condimentos y Salsas': 'condimentos-y-salsas.jpg',
  'Empaques y Desechables': 'empaques-y-desechables.jpg',
  Panadería: 'panaderia.jpg',
  'Frutas Frescas': 'frutas-frescas.jpg',
  'Verduras y Hortalizas': 'verduras-y-hortalizas.jpg',
  Huevos: 'huevos.jpg',
  Congelados: 'congelados.jpg',
  'Quesos Finos': 'quesos-finos.jpg',
  'Yogures y Postres Lácteos': 'yogures-y-postres-lacteos.jpg',
  'Pescados Frescos': 'pescados-frescos.jpg',
  'Carnes Ahumadas y Curados': 'carnes-ahumadas-y-curados.jpg',
  'Vísceras y Menudencias': 'visceras-y-menudencias.jpg',
  'Cereales y Granola': 'cereales-y-granola.jpg',
  'Pastas y Harinas': 'pastas-y-harinas.jpg',
  'Aceites y Vinagres': 'aceites-y-vinagres.jpg',
  'Enlatados y Conservas': 'enlatados-y-conservas.jpg',
  'Snacks y Golosinas': 'snacks-y-golosinas.jpg',
  Galletas: 'galletas.jpg',
  'Café y Té': 'cafe-y-te.jpg',
  'Repostería y Endulzantes': 'reposteria-y-endulzantes.jpg',
  'Salsas y Aderezos': 'salsas-y-aderezos.jpg',
  'Productos de Limpieza': 'productos-de-limpieza.jpg',
  'Cuidado Personal': 'cuidado-personal.jpg',
  'Papel e Higiene del Hogar': 'papel-e-higiene-del-hogar.jpg',
  'Comidas Preparadas': 'comidas-preparadas.jpg',
  'Especias Naturales': 'especias-naturales.jpg',
};

export function imageUrlForCategory(categoryName: string): string {
  const filename = CATEGORY_IMAGE_FILENAMES[categoryName];

  if (!filename) {
    throw new Error(`No hay imagen representativa mapeada para la categoría "${categoryName}".`);
  }

  return buildProductImageUrl(filename);
}
