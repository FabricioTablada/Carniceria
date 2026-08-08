import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { TopProductItem, TopProductsQueryParams } from '../types/report.types'

export function useTopProducts(params: TopProductsQueryParams) {
  return useQuery<TopProductItem[], AxiosError>({
    queryKey: ['reports', 'top-products', params],
    queryFn: () => reportsApi.getTopProducts(params),
  })
}