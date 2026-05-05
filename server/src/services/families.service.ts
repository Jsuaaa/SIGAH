import {
  FamilyModel,
  type CreateFamilyInput,
  type UpdateFamilyInput,
  type FamilyOrderBy,
  type FamilyEligibility,
} from '../models/family.model';
import type { Family, FamilyStatus } from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateFamilyInput, UpdateFamilyInput, FamilyOrderBy, FamilyEligibility };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  zone_id?: number;
  shelter_id?: number;
  status?: FamilyStatus;
  order_by?: FamilyOrderBy;
}

export interface SearchFilters {
  page: number;
  limit: number;
  skip: number;
  query: string;
}

export async function create(
  input: CreateFamilyInput,
  user_id: number,
  ip: string | null,
  user_agent: string | null,
): Promise<Family> {
  return FamilyModel.createWithConsent(input, user_id, ip, user_agent);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: Family[]; total: number }> {
  return FamilyModel.list({
    zone_id: filters.zone_id,
    shelter_id: filters.shelter_id,
    status: filters.status,
    order_by: filters.order_by,
    limit: filters.limit,
    offset: filters.skip,
  });
}

export async function search(
  filters: SearchFilters,
): Promise<{ data: Family[]; total: number }> {
  return FamilyModel.search({
    query: filters.query,
    limit: filters.limit,
    offset: filters.skip,
  });
}

export async function getById(id: number): Promise<Family> {
  const family = await FamilyModel.findById(id);
  if (!family) {
    throw new AppError('Family not found', 404);
  }
  return family;
}

export async function update(id: number, input: UpdateFamilyInput): Promise<Family> {
  return FamilyModel.update(id, input);
}

export async function remove(id: number): Promise<void> {
  await FamilyModel.remove(id);
}

export async function getEligibility(id: number): Promise<FamilyEligibility> {
  const eligibility = await FamilyModel.getEligibility(id);
  if (!eligibility) {
    throw new AppError('Family not found', 404);
  }
  return eligibility;
}

export async function listByZone(zone_id: number): Promise<Family[]> {
  return FamilyModel.listByZone(zone_id);
}
