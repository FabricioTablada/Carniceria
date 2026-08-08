/**
 * features/settings/types/configuration.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Settings, seccion Configuration. Contrato identico al
 * backend, sin adaptaciones: mismos nombres de propiedad, misma
 * opcionalidad y misma nulabilidad que `modules/configuration/types.ts`
 * y `modules/configuration/validation.ts` (Zod) del backend.
 *
 * NOTA (igual que en el backend): este modulo representa la
 * configuracion FUNCIONAL del sistema (datos de la empresa, moneda,
 * parametros operativos por sucursal), almacenada como filas
 * clave-valor. El backend la nombra `configuration`, no `settings` — el
 * modulo `settings` del backend esta vacio (solo un `.gitkeep`); este
 * frontend usa la carpeta `features/settings/` porque es el nombre que
 * ya tiene la pagina/ruta/navegacion existente (`SettingsPage.tsx`,
 * `/settings`), pero el contrato real que consume viene de
 * `modules/configuration/` del backend.
 *
 * NOTA: el modelo `Configuration` no tiene ningun campo `Decimal` (todos
 * sus valores se guardan como `String`), por lo que no aplica el manejo
 * de `Prisma.Decimal` / `Number()` usado en Products, Inventory,
 * Purchases, Sales y Cash.
 *
 * NOTA: el modelo no tiene campo `active`, por lo que este modulo no
 * expone cambio de estado (a diferencia de Categories, Products, Taxes y
 * Suppliers) — no hay `ChangeConfigurationStatusDto` ni equivalente.
 *
 * Unica diferencia deliberada respecto al backend: los campos `Date`
 * (`createdAt`, `updatedAt`) se tipan aqui como `string`, porque asi es
 * como viajan realmente por HTTP. Mismo criterio ya usado en
 * `purchase.types.ts`, `inventory.types.ts` y `cashSession.types.ts`.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Tipo de dato del valor almacenado (enum documentado como comentario
 * sobre el campo `type` en `schema.prisma`, no un enum real de Prisma). */
export type ConfigurationValueType = 'string' | 'number' | 'boolean' | 'json'

/** Resumen de la sucursal asociada a una configuracion. */
export interface ConfigurationSucursalSummary {
  id: string
  code: string
  name: string
}

/** Configuracion tal como la expone el backend (`ConfigurationResponse`). */
export interface Configuration {
  id: string
  sucursalId: string
  key: string
  value: string
  type: ConfigurationValueType
  description: string | null
  sucursal: ConfigurationSucursalSummary
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear una configuracion.
 * Coincide exactamente con `CreateConfigurationSchema` (Zod) del
 * backend. `sucursalId` NO se envia — el backend lo resuelve desde
 * `req.user.sucursalId` en `configuration.controller.ts` (corregido:
 * mismo patron ya aplicado en Purchases), por lo que tampoco se declara
 * aqui.
 */
export interface CreateConfigurationDto {
  key: string
  value: string
  type?: ConfigurationValueType
  description?: string | null
}

/**
 * Datos permitidos para actualizar una configuracion existente. Todos
 * opcionales, coincide exactamente con `UpdateConfigurationSchema` (Zod)
 * del backend.
 */
export interface UpdateConfigurationDto {
  sucursalId?: string
  key?: string
  value?: string
  type?: ConfigurationValueType
  description?: string | null
}

/**
 * Filtros de listado de configuraciones.
 * Coincide exactamente con `ListConfigurationsFilters` del backend.
 *
 * `page`/`limit` (Bloque Configuración, rediseño aprobado): el backend ya
 * soporta paginacion — `PaginatedConfigurationsResponse.meta` abajo ya trae
 * `page`/`limit`/`totalPages`/etc. via el mismo `shared/utils/pagination.ts`
 * que usan todos los demas listados — este tipo simplemente nunca los
 * declaraba. Mismo criterio ya aplicado a `ProductFilters`/`RoleFilters`
 * en "Arquitectura de listados, Bloque 4"; no es logica nueva del backend.
 */
export interface ConfigurationFilters {
  sucursalId?: string
  type?: ConfigurationValueType
  search?: string
  /** Pagina solicitada (1-indexada). */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /configuration.
 * El controlador (`configuration/controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta`
 * de `shared/utils/pagination.ts`). Mismo patron ya usado en
 * `PaginatedPurchasesResponse`/`PaginatedCashSessionsResponse`.
 */
export interface PaginatedConfigurationsResponse {
  success: true
  data: Configuration[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}