/**
 * modules/cabys/catalogSync.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del flujo "Buscar actualizaciones" del catalogo CABYS.
 */
import type { RemoteCatalogVersion } from './catalogImport';

export type { RemoteCatalogVersion };

export interface CheckForUpdatesResult {
  hasUpdate: boolean;
  remote: RemoteCatalogVersion;
}

export interface CatalogDiffSummary {
  newCodesCount: number;
  descriptionChangedCount: number;
  taxIndicatorChangedCount: number;
  retiredCodesCount: number;
  unchangedCount: number;
}

export interface PreviewCatalogUpdateResult {
  previewToken: string;
  summary: CatalogDiffSummary;
  expiresAt: string;
  remote: RemoteCatalogVersion;
}

export interface ProductToReview {
  productId: string;
  productName: string;
  cabysCode: string;
  currentTaxName: string;
  currentTaxRate: number;
  officialTaxRate: number | null;
}

export interface ApplyCatalogUpdateResult {
  summary: CatalogDiffSummary;
  productsToReview: ProductToReview[];
}
