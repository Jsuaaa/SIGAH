import { ZoneModel, type CreateZoneInput, type UpdateZoneInput } from '../models/zone.model';
import type { Zone, RiskLevel } from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateZoneInput, UpdateZoneInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  risk_level?: RiskLevel;
  search?: string;
}

export async function create(input: CreateZoneInput): Promise<Zone> {
  return ZoneModel.create(input);
}

export async function list(filters: ListFilters): Promise<{ data: Zone[]; total: number }> {
  return ZoneModel.list({
    risk_level: filters.risk_level,
    search: filters.search,
    limit: filters.limit,
    offset: filters.skip,
  });
}

export async function getById(id: number): Promise<Zone> {
  const zone = await ZoneModel.findById(id);
  if (!zone) {
    throw new AppError('Zone not found', 404);
  }
  return zone;
}

export async function update(id: number, input: UpdateZoneInput): Promise<Zone> {
  // fn_zones_update raises SH404 if missing; pre-checking would be a wasted
  // round-trip. The mapper in db/client.ts converts SH404 to AppError(404).
  return ZoneModel.update(id, input);
}

export async function remove(id: number): Promise<void> {
  await ZoneModel.remove(id);
}

// Used by nested route stubs to verify the parent zone exists before returning [].
export async function assertExists(id: number): Promise<void> {
  const zone = await ZoneModel.findById(id);
  if (!zone) {
    throw new AppError('Zone not found', 404);
  }
}
