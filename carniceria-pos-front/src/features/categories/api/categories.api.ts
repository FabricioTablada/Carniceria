import { httpClient } from '@/lib/htpp/client'
import type {
  Category,
  CategoryFilters,
  CategoryLookupFilters,
  ChangeCategoryStatusDto,
  CreateCategoryDto,
  LookupCategoriesResponse,
  PaginatedCategoriesResponse,
  UpdateCategoryDto,
} from '../types/category.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const categoriesApi = {
  getCategories: async (
    filters?: CategoryFilters,
  ): Promise<PaginatedCategoriesResponse> => {
    const { data } = await httpClient.get<PaginatedCategoriesResponse>(
      '/categories',
      { params: filters },
    )

    return data
  },

  // Arquitectura de selectores, Bloque 2: consume el patron de lookup del
  // backend (`GET /categories/lookup`), no `GET /categories` — respuesta
  // liviana especifica para selectores, ver `CategoryLookupItem`.
  lookup: async (filters?: CategoryLookupFilters): Promise<LookupCategoriesResponse> => {
    const { data } = await httpClient.get<LookupCategoriesResponse>('/categories/lookup', {
      params: filters,
    })

    return data
  },

  getCategoryById: async (id: string): Promise<Category> => {
    const { data } = await httpClient.get<ApiEnvelope<Category>>(
      `/categories/${id}`,
    )

    return data.data
  },

  createCategory: async (data: CreateCategoryDto): Promise<Category> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Category>>(
      '/categories',
      data,
    )

    return response.data
  },

  updateCategory: async (
    id: string,
    data: UpdateCategoryDto,
  ): Promise<Category> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Category>>(
      `/categories/${id}`,
      data,
    )

    return response.data
  },

  updateCategoryStatus: async (
    id: string,
    data: ChangeCategoryStatusDto,
  ): Promise<Category> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Category>>(
      `/categories/${id}/status`,
      data,
    )

    return response.data
  },

  deleteCategory: async (id: string): Promise<void> => {
    await httpClient.delete(`/categories/${id}`)
  },
}