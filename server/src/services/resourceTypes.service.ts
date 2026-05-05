import {
  ResourceTypeModel,
  type CreateResourceTypeInput,
  type UpdateResourceTypeInput,
} from '../models/resourceType.model';
import type { ResourceCategory, ResourceType } from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateResourceTypeInput, UpdateResourceTypeInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  category?: ResourceCategory;
  is_active?: boolean;
  search?: string;
}

export async function create(input: CreateResourceTypeInput): Promise<ResourceType> {
  return ResourceTypeModel.create(input);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: ResourceType[]; total: number }> {
  return ResourceTypeModel.list({
    category: filters.category,
    is_active: filters.is_active,
    search: filters.search,
    limit: filters.limit,
    offset: filters.skip,
  });
}

export async function getById(id: number): Promise<ResourceType> {
  const row = await ResourceTypeModel.findById(id);
  if (!row) throw new AppError('Resource type not found', 404);
  return row;
}

export async function update(
  id: number,
  input: UpdateResourceTypeInput,
): Promise<ResourceType> {
  return ResourceTypeModel.update(id, input);
}

export async function deactivate(id: number): Promise<ResourceType> {
  return ResourceTypeModel.deactivate(id);
}
