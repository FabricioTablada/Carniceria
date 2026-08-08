/**
 * features/settings/types/cabysCatalog.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del flujo "Buscar actualizaciones" del catálogo CABYS — reflejan
 * exactamente `catalogSync.types.ts` del backend (`GET /cabys/catalog/*`).
 */
export interface RemoteCatalogVersion {
  etag: string | null
  lastModified: string | null
  contentLength: number | null
}

export interface CheckForCabysUpdatesResult {
  hasUpdate: boolean
  remote: RemoteCatalogVersion
}

export interface CabysCatalogDiffSummary {
  newCodesCount: number
  descriptionChangedCount: number
  taxIndicatorChangedCount: number
  retiredCodesCount: number
  unchangedCount: number
}

export interface PreviewCabysCatalogUpdateResult {
  previewToken: string
  summary: CabysCatalogDiffSummary
  expiresAt: string
  remote: RemoteCatalogVersion
}

export interface CabysProductToReview {
  productId: string
  productName: string
  cabysCode: string
  currentTaxName: string
  currentTaxRate: number
  officialTaxRate: number | null
}

export interface ApplyCabysCatalogUpdateResult {
  summary: CabysCatalogDiffSummary
  productsToReview: CabysProductToReview[]
}
