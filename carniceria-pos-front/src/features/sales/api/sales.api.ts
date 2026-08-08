import { httpClient } from '@/lib/htpp/client'
import type {
  CorrectSaleDto,
  CorrectSaleResult,
  CreateSaleDto,
  CreateSaleQuoteDto,
  PaginatedSalesResponse,
  Sale,
  SaleFilters,
  SaleQuoteResponse,
  UpdateSaleDto,
  VoidSaleDto,
} from '../types/sale.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const salesApi = {
  getSales: async (
    filters?: SaleFilters,
  ): Promise<PaginatedSalesResponse> => {
    const { data } = await httpClient.get<PaginatedSalesResponse>('/sales', {
      params: filters,
    })

    return data
  },

  getSaleById: async (id: string): Promise<Sale> => {
    const { data } = await httpClient.get<ApiEnvelope<Sale>>(`/sales/${id}`)

    return data.data
  },

  createSale: async (data: CreateSaleDto): Promise<Sale> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Sale>>(
      '/sales',
      data,
    )

    return response.data
  },

  /** Cotiza una venta sin crearla (Bloque P.8, `POST /sales/quote`) —
   * reutiliza exactamente el mismo endpoint/calculo que valida el Bloque
   * P.7 del backend. No persiste nada. */
  getSaleQuote: async (data: CreateSaleQuoteDto): Promise<SaleQuoteResponse> => {
    const { data: response } = await httpClient.post<ApiEnvelope<SaleQuoteResponse>>(
      '/sales/quote',
      data,
    )

    return response.data
  },

  updateSale: async (id: string, data: UpdateSaleDto): Promise<Sale> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Sale>>(
      `/sales/${id}`,
      data,
    )

    return response.data
  },

  voidSale: async (id: string, data: VoidSaleDto): Promise<Sale> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Sale>>(
      `/sales/${id}/void`,
      data,
    )

    return response.data
  },

  correctSale: async (id: string, data: CorrectSaleDto): Promise<CorrectSaleResult> => {
    const { data: response } = await httpClient.post<ApiEnvelope<CorrectSaleResult>>(
      `/sales/${id}/correct`,
      data,
    )

    return response.data
  },
}