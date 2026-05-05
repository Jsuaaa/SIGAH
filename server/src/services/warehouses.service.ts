import {
  WarehouseModel,
  type CreateWarehouseInput,
  type UpdateWarehouseInput,
} from '../models/warehouse.model';
import type {
  Warehouse,
  WarehouseStatus,
  WarehouseWithDistance,
  WarehouseWithOccupancy,
} from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateWarehouseInput, UpdateWarehouseInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  zone_id?: number;
  status?: WarehouseStatus;
  search?: string;
}

export async function create(input: CreateWarehouseInput): Promise<Warehouse> {
  return WarehouseModel.create(input);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: WarehouseWithOccupancy[]; total: number }> {
  return WarehouseModel.list({
    zone_id: filters.zone_id,
    status: filters.status,
    search: filters.search,
    limit: filters.limit,
    offset: filters.skip,
  });
}

export async function getById(id: number): Promise<WarehouseWithOccupancy> {
  const warehouse = await WarehouseModel.findById(id);
  if (!warehouse) {
    throw new AppError('Warehouse not found', 404);
  }
  return warehouse;
}

export async function update(id: number, input: UpdateWarehouseInput): Promise<Warehouse> {
  return WarehouseModel.update(id, input);
}

export async function remove(id: number): Promise<void> {
  await WarehouseModel.remove(id);
}

export async function nearest(
  latitude: number,
  longitude: number,
  limit: number,
): Promise<WarehouseWithDistance[]> {
  return WarehouseModel.nearest(latitude, longitude, limit);
}

export async function listByZone(zone_id: number): Promise<WarehouseWithOccupancy[]> {
  return WarehouseModel.listByZone(zone_id);
}
