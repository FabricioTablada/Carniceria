/**
 * modules/configuration/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de configuracion funcional del sistema.
 * Define unicamente las formas de datos que consumen
 * `configuration.service.ts`, `configuration.repository.ts` y
 * `configuration.controller.ts`; no contiene logica de negocio, consultas
 * Prisma ni validaciones (eso vive en sus respectivos archivos:
 * `configuration.service.ts`, `configuration.repository.ts` y
 * `configuration.validation.ts`).
 *
 * NOTA: este modulo representa la configuracion FUNCIONAL del sistema
 * almacenada en la base de datos (modelo `Configuration` de
 * `schema.prisma`: datos de la empresa, moneda, parametros operativos por
 * sucursal). NO debe confundirse con `src/config/`, que es la
 * configuracion TECNICA del proyecto (variables de entorno, Prisma, JWT,
 * CORS, logger) y que este modulo no modifica ni reemplaza.
 *
 * NOTA: el modelo `Configuration` no tiene ningun campo `Decimal` (todos
 * sus valores se guardan como `String`), por lo que no aplica el manejo de
 * `Prisma.Decimal` / `Number()` usado en Products, Inventory, Purchases,
 * Sales y Cash.
 *
 * NOTA: el modelo no tiene campo `active`, por lo que este modulo no
 * expone cambio de estado (a diferencia de Categories, Products, Taxes y
 * Suppliers). Si tiene la restriccion `@@unique([sucursalId, key])`, por lo
 * que si valida duplicados (mismo patron que Inventory).
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Tipo de dato del valor almacenado. `schema.prisma` lo documenta como
 * comentario sobre el campo `type` (`String` libre con valor por defecto
 * `"string"`); este modulo valida contra esos mismos valores documentados. */
export type ConfigurationValueType = 'string' | 'number' | 'boolean' | 'json';

/** Resumen de la sucursal asociada a una configuracion. */
export interface ConfigurationSucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Forma de una configuracion tal como la expone el modulo. */
export interface ConfigurationResponse {
  id: string;
  sucursalId: string;
  key: string;
  value: string;
  type: ConfigurationValueType;
  description: string | null;
  sucursal: ConfigurationSucursalSummary;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear una configuracion. */
export interface CreateConfigurationDto {
  sucursalId: string;
  key: string;
  value: string;
  type?: ConfigurationValueType;
  description?: string | null;
}

/** Datos permitidos para actualizar una configuracion existente. Todos
 * opcionales. */
export interface UpdateConfigurationDto {
  sucursalId?: string;
  key?: string;
  value?: string;
  type?: ConfigurationValueType;
  description?: string | null;
}

/** Filtros de busqueda/listado disponibles para configuraciones. */
export interface ListConfigurationsFilters {
  sucursalId?: string;
  type?: ConfigurationValueType;
  search?: string;
}

/** Parametros combinados para listar configuraciones: filtros + paginacion. */
export interface ListConfigurationsQuery extends PaginationParams {
  filters?: ListConfigurationsFilters;
}

/** Resultado de una operacion de listado paginado de configuraciones. */
export interface ListConfigurationsResult {
  items: ConfigurationResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven una unica configuracion. */
export interface ConfigurationResult {
  configuration: ConfigurationResponse;
}
