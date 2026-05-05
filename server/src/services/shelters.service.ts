import {
  ShelterModel,
  type CreateShelterInput,
  type UpdateShelterInput,
} from '../models/shelter.model';
import type { Shelter, ShelterType, ShelterWithOccupancy } from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateShelterInput, UpdateShelterInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  zone_id?: number;
  type?: ShelterType;
  search?: string;
}

export async function create(input: CreateShelterInput): Promise<Shelter> {
  return ShelterModel.create(input);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: ShelterWithOccupancy[]; total: number }> {
  return ShelterModel.list({
    zone_id: filters.zone_id,
    type: filters.type,
    search: filters.search,
    limit: filters.limit,
    offset: filters.skip,
  });
}

export async function getById(id: number): Promise<ShelterWithOccupancy> {
  const shelter = await ShelterModel.findById(id);
  if (!shelter) {
    throw new AppError('Shelter not found', 404);
  }
  return shelter;
}

export async function update(id: number, input: UpdateShelterInput): Promise<Shelter> {
  return ShelterModel.update(id, input);
}

export async function setOccupancy(id: number, occupancy: number): Promise<Shelter> {
  return ShelterModel.setOccupancy(id, occupancy);
}

export async function remove(id: number): Promise<void> {
  await ShelterModel.remove(id);
}

export async function listByZone(zone_id: number): Promise<ShelterWithOccupancy[]> {
  return ShelterModel.listByZone(zone_id);
}
