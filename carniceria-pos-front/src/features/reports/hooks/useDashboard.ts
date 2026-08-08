import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { reportsApi } from '../api/reports.api'
import type { DashboardFilters, DashboardResponse } from '../types/report.types'

export function useDashboard(filters?: DashboardFilters) {
  return useQuery<DashboardResponse, AxiosError>({
    queryKey: ['reports', 'dashboard', filters],
    queryFn: () => reportsApi.getDashboard(filters),
  })
}