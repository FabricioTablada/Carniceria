import { httpClient } from '@/lib/htpp/client'
import type {
  BatchesReportFilters,
  BatchesReportResponse,
  CashReportDetailResponse,
  CashReportFilters,
  CashReportSummary,
  DashboardFilters,
  DashboardResponse,
  InventoryReportFilters,
  InventoryReportSummary,
  LowStockFilters,
  LowStockItem,
  PaginatedCashReportResponse,
  PaginatedInventoryReportResponse,
  PaginatedProfitReportResponse,
  PaginatedPurchasesReportResponse,
  PaginatedSalesReportResponse,
  ProfitReportFilters,
  ProfitReportSummary,
  PurchasesReportFilters,
  PurchasesReportSummary,
  SalesByCashierFilters,
  SalesByCashierItem,
  SalesByCashierSummary,
  SalesByCategoryFilters,
  SalesByCategoryItem,
  SalesByDateFilters,
  SalesByDateItem,
  SalesReportFilters,
  SalesReportSummary,
  TopProductItem,
  TopProductsQueryParams,
  WasteReportFilters,
  WasteReportResponse,
} from '../types/report.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const reportsApi = {
  getDashboard: async (filters?: DashboardFilters): Promise<DashboardResponse> => {
    const { data } = await httpClient.get<ApiEnvelope<DashboardResponse>>(
      '/reports/dashboard',
      { params: filters },
    )

    return data.data
  },

  getSalesReport: async (
    filters?: SalesReportFilters,
  ): Promise<PaginatedSalesReportResponse> => {
    const { data } = await httpClient.get<PaginatedSalesReportResponse>(
      '/reports/sales',
      { params: filters },
    )

    return data
  },

  /** Bloque REPORTES-AGREGADOS: mismos filtros que `getSalesReport`, sin
   * paginacion — totales sobre el conjunto COMPLETO filtrado. */
  getSalesReportSummary: async (
    filters?: Omit<SalesReportFilters, 'page' | 'limit'>,
  ): Promise<SalesReportSummary> => {
    const { data } = await httpClient.get<ApiEnvelope<SalesReportSummary>>(
      '/reports/sales/summary',
      { params: filters },
    )

    return data.data
  },

  getPurchasesReport: async (
    filters?: PurchasesReportFilters,
  ): Promise<PaginatedPurchasesReportResponse> => {
    const { data } = await httpClient.get<PaginatedPurchasesReportResponse>(
      '/reports/purchases',
      { params: filters },
    )

    return data
  },

  /** Mismo criterio que `getSalesReportSummary`. */
  getPurchasesReportSummary: async (
    filters?: Omit<PurchasesReportFilters, 'page' | 'limit'>,
  ): Promise<PurchasesReportSummary> => {
    const { data } = await httpClient.get<ApiEnvelope<PurchasesReportSummary>>(
      '/reports/purchases/summary',
      { params: filters },
    )

    return data.data
  },

  getInventoryReport: async (
    filters?: InventoryReportFilters,
  ): Promise<PaginatedInventoryReportResponse> => {
    const { data } = await httpClient.get<PaginatedInventoryReportResponse>(
      '/reports/inventory',
      { params: filters },
    )

    return data
  },

  /** Bloque REPORTES-AGREGADOS: mismos filtros que `getInventoryReport`,
   * sin paginacion — conteos sobre el conjunto COMPLETO filtrado. */
  getInventoryReportSummary: async (
    filters?: Omit<InventoryReportFilters, 'page' | 'limit'>,
  ): Promise<InventoryReportSummary> => {
    const { data } = await httpClient.get<ApiEnvelope<InventoryReportSummary>>(
      '/reports/inventory/summary',
      { params: filters },
    )

    return data.data
  },

  getProfitReport: async (
    filters?: ProfitReportFilters,
  ): Promise<PaginatedProfitReportResponse> => {
    const { data } = await httpClient.get<PaginatedProfitReportResponse>(
      '/reports/profit',
      { params: filters },
    )

    return data
  },

  /** Bloque REPORTES-AGREGADOS: mismos filtros que `getProfitReport`, sin
   * paginacion — totales sobre el conjunto COMPLETO filtrado. */
  getProfitReportSummary: async (
    filters?: Omit<ProfitReportFilters, 'page' | 'limit'>,
  ): Promise<ProfitReportSummary> => {
    const { data } = await httpClient.get<ApiEnvelope<ProfitReportSummary>>(
      '/reports/profit/summary',
      { params: filters },
    )

    return data.data
  },

  getCashReport: async (
    filters?: CashReportFilters,
  ): Promise<PaginatedCashReportResponse> => {
    const { data } = await httpClient.get<PaginatedCashReportResponse>(
      '/reports/cash',
      { params: filters },
    )

    return data
  },

  /** Bloque REPORTES-AGREGADOS: mismos filtros que `getCashReport`, sin
   * paginacion — totales sobre el conjunto COMPLETO filtrado. */
  getCashReportSummary: async (
    filters?: Omit<CashReportFilters, 'page' | 'limit'>,
  ): Promise<CashReportSummary> => {
    const { data } = await httpClient.get<ApiEnvelope<CashReportSummary>>(
      '/reports/cash/summary',
      { params: filters },
    )

    return data.data
  },

  getCashReportDetail: async (id: string): Promise<CashReportDetailResponse> => {
    const { data } = await httpClient.get<CashReportDetailResponse>(
      `/reports/cash/${id}`,
    )

    return data
  },

  getTopProducts: async (
    params: TopProductsQueryParams,
  ): Promise<TopProductItem[]> => {
    const { data } = await httpClient.get<ApiEnvelope<TopProductItem[]>>(
      '/reports/top-products',
      { params },
    )

    return data.data
  },

  getLowStock: async (filters?: LowStockFilters): Promise<LowStockItem[]> => {
    const { data } = await httpClient.get<ApiEnvelope<LowStockItem[]>>(
      '/reports/low-stock',
      { params: filters },
    )

    return data.data
  },

  getSalesByCategory: async (
    filters?: SalesByCategoryFilters,
  ): Promise<SalesByCategoryItem[]> => {
    const { data } = await httpClient.get<ApiEnvelope<SalesByCategoryItem[]>>(
      '/reports/sales-by-category',
      { params: filters },
    )

    return data.data
  },

  getSalesByCashier: async (
    filters?: SalesByCashierFilters,
  ): Promise<SalesByCashierItem[]> => {
    const { data } = await httpClient.get<ApiEnvelope<SalesByCashierItem[]>>(
      '/reports/sales-by-cashier',
      { params: filters },
    )

    return data.data
  },

  /** Bloque REPORTES-AGREGADOS: mismos filtros que `getSalesByCashier`, sin
   * `limit` — ya no lo tenia (nunca fue paginado). Totales sobre el
   * conjunto COMPLETO filtrado. */
  getSalesByCashierSummary: async (
    filters?: SalesByCashierFilters,
  ): Promise<SalesByCashierSummary> => {
    const { data } = await httpClient.get<ApiEnvelope<SalesByCashierSummary>>(
      '/reports/sales-by-cashier/summary',
      { params: filters },
    )

    return data.data
  },

  getSalesByDate: async (
    filters?: SalesByDateFilters,
  ): Promise<SalesByDateItem[]> => {
    const { data } = await httpClient.get<ApiEnvelope<SalesByDateItem[]>>(
      '/reports/sales-by-date',
      { params: filters },
    )

    return data.data
  },

  /** Centro de Control de Inventario (aprobado): endpoint ya existente,
   * hasta ahora sin consumir desde ningun frontend. Resumen agregado del
   * periodo filtrado (merma real vs. esperada por producto). */
  getWasteReport: async (filters?: WasteReportFilters): Promise<WasteReportResponse> => {
    const { data } = await httpClient.get<ApiEnvelope<WasteReportResponse>>(
      '/reports/waste',
      { params: filters },
    )

    return data.data
  },

  /** Centro de Control de Inventario (aprobado): endpoint ya existente,
   * hasta ahora sin consumir desde ningun frontend. Foto agregada del
   * estado actual del catalogo de lotes filtrado (conteo por estado +
   * proximos a vencer), en vez de aproximar contando filas ya cargadas. */
  getBatchesReport: async (filters?: BatchesReportFilters): Promise<BatchesReportResponse> => {
    const { data } = await httpClient.get<ApiEnvelope<BatchesReportResponse>>(
      '/reports/batches',
      { params: filters },
    )

    return data.data
  },
}
