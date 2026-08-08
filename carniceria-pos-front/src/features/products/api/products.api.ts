import { httpClient } from '@/lib/htpp/client'
import type {
  ChangeProductStatusDto,
  CreateProductDto,
  LookupProductsResponse,
  PaginatedProductsResponse,
  Product,
  ProductFilters,
  ProductLookupFilters,
  UpdateProductDto,
} from '../types/product.types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export const productsApi = {
  getProducts: async (
    filters?: ProductFilters,
  ): Promise<PaginatedProductsResponse> => {
    const { data } = await httpClient.get<PaginatedProductsResponse>(
      '/products',
      { params: filters },
    )

    return data
  },

  // Arquitectura de selectores, Bloque 2: consume el patron de lookup del
  // backend (`GET /products/lookup`), no `GET /products` — respuesta
  // liviana especifica para selectores, ver `ProductLookupItem`.
  lookup: async (filters?: ProductLookupFilters): Promise<LookupProductsResponse> => {
    const { data } = await httpClient.get<LookupProductsResponse>('/products/lookup', {
      params: filters,
    })

    return data
  },

  getProductById: async (id: string): Promise<Product> => {
    const { data } = await httpClient.get<ApiEnvelope<Product>>(
      `/products/${id}`,
    )

    return data.data
  },

  createProduct: async (data: CreateProductDto): Promise<Product> => {
    const { data: response } = await httpClient.post<ApiEnvelope<Product>>(
      '/products',
      data,
    )

    return response.data
  },

  updateProduct: async (
    id: string,
    data: UpdateProductDto,
  ): Promise<Product> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Product>>(
      `/products/${id}`,
      data,
    )

    return response.data
  },

  updateProductStatus: async (
    id: string,
    data: ChangeProductStatusDto,
  ): Promise<Product> => {
    const { data: response } = await httpClient.patch<ApiEnvelope<Product>>(
      `/products/${id}/status`,
      data,
    )

    return response.data
  },

  // Bloque 10 (gestion de imagenes): crea o reemplaza la imagen del
  // producto — mismo endpoint para ambos casos (ver `products.routes.ts`
  // del backend, nombrado deterministico por producto).
  uploadProductImage: async (id: string, file: File): Promise<Product> => {
    const formData = new FormData()
    formData.append('image', file)

    const { data: response } = await httpClient.post<ApiEnvelope<Product>>(
      `/products/${id}/image`,
      formData,
      {
        // La instancia fuerza `Content-Type: application/json` por defecto
        // (`lib/htpp/client.ts`) — hay que anularlo explicitamente aca.
        // Si se deja ese header, Axios lo respeta tal cual (sin
        // `boundary`) en vez de dejar que el navegador genere el
        // `multipart/form-data; boundary=...` real, y el backend
        // (`multer`) no puede parsear el body.
        headers: { 'Content-Type': undefined },
      },
    )

    return response.data
  },

  deleteProductImage: async (id: string): Promise<Product> => {
    const { data: response } = await httpClient.delete<ApiEnvelope<Product>>(
      `/products/${id}/image`,
    )

    return response.data
  },

  deleteProduct: async (id: string): Promise<void> => {
    await httpClient.delete(`/products/${id}`)
  },
}