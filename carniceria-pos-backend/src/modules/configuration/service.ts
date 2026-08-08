/**
 * modules/configuration/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de configuracion funcional del sistema.
 *
 * Responsabilidades:
 *  - Validar existencia de la configuracion antes de leer/actualizar.
 *  - Validar que la combinacion `sucursalId` + `key` no este duplicada al
 *    crear o actualizar (restriccion `@@unique([sucursalId, key])` de
 *    `schema.prisma`: una configuracion por clave y sucursal), mismo patron
 *    ya aprobado en Inventory para `productId` + `sucursalId`.
 *  - Traducir los registros de Prisma a la forma publica
 *    `ConfigurationResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `configuration.repository.ts`; este servicio no ejecuta queries de
 * Prisma directamente.
 *
 * NOTA: el modelo `Configuration` no tiene ningun campo `Decimal`, por lo
 * que este servicio no realiza conversiones `Prisma.Decimal` / `Number()`.
 */
import { ConflictError, NotFoundError } from '@/shared/errors';
import * as configurationRepository from './repository';
import type {
  ConfigurationResponse,
  ConfigurationValueType,
  CreateConfigurationDto,
  ListConfigurationsQuery,
  ListConfigurationsResult,
  UpdateConfigurationDto,
} from './types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type ConfigurationRecord = {
  id: string;
  sucursalId: string;
  key: string;
  value: string;
  type: string;
  description: string | null;
  sucursal: { id: string; code: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

/** Traduce un registro de Prisma a la forma publica de la configuracion. */
function toConfigurationResponse(configuration: ConfigurationRecord): ConfigurationResponse {
  return {
    id: configuration.id,
    sucursalId: configuration.sucursalId,
    key: configuration.key,
    value: configuration.value,
    type: configuration.type as ConfigurationValueType,
    description: configuration.description,
    sucursal: configuration.sucursal,
    createdAt: configuration.createdAt,
    updatedAt: configuration.updatedAt,
  };
}

export async function create(dto: CreateConfigurationDto): Promise<ConfigurationResponse> {
  const existingBySucursalAndKey = await configurationRepository.findBySucursalAndKey(
    dto.sucursalId,
    dto.key,
  );

  if (existingBySucursalAndKey) {
    throw new ConflictError('Ya existe una configuracion con esta clave para esta sucursal.');
  }

  const created = await configurationRepository.create({
    sucursalId: dto.sucursalId,
    key: dto.key,
    value: dto.value,
    type: dto.type ?? 'string',
    description: dto.description ?? null,
  });

  return toConfigurationResponse(created);
}

export async function findById(id: string): Promise<ConfigurationResponse> {
  const configuration = await configurationRepository.findById(id);

  if (!configuration) {
    throw new NotFoundError('Configuracion');
  }

  return toConfigurationResponse(configuration);
}

export async function findMany(query: ListConfigurationsQuery): Promise<ListConfigurationsResult> {
  const [items, total] = await configurationRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toConfigurationResponse(item)),
    total,
  };
}

export async function update(
  id: string,
  dto: UpdateConfigurationDto,
): Promise<ConfigurationResponse> {
  const existing = await configurationRepository.findById(id);

  if (!existing) {
    throw new NotFoundError('Configuracion');
  }

  const nextSucursalId = dto.sucursalId ?? existing.sucursalId;
  const nextKey = dto.key ?? existing.key;

  if (nextSucursalId !== existing.sucursalId || nextKey !== existing.key) {
    const existingBySucursalAndKey = await configurationRepository.findBySucursalAndKey(
      nextSucursalId,
      nextKey,
    );

    if (existingBySucursalAndKey) {
      throw new ConflictError('Ya existe una configuracion con esta clave para esta sucursal.');
    }
  }

  const updated = await configurationRepository.update(id, {
    sucursalId: dto.sucursalId,
    key: dto.key,
    value: dto.value,
    type: dto.type,
    description: dto.description,
  });

  return toConfigurationResponse(updated);
}
