import {
  DonorModel,
  type CreateDonorInput,
  type UpdateDonorInput,
} from '../models/donor.model';
import type { Donor, DonorType } from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateDonorInput, UpdateDonorInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  type?: DonorType;
  is_active?: boolean;
  search?: string;
}

export async function create(input: CreateDonorInput): Promise<Donor> {
  return DonorModel.create(input);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: Donor[]; total: number }> {
  return DonorModel.list({
    type: filters.type,
    is_active: filters.is_active,
    search: filters.search,
    limit: filters.limit,
    offset: filters.skip,
  });
}

export async function getById(id: number): Promise<Donor> {
  const row = await DonorModel.findById(id);
  if (!row) throw new AppError('Donor not found', 404);
  return row;
}

export async function update(id: number, input: UpdateDonorInput): Promise<Donor> {
  return DonorModel.update(id, input);
}

export async function softDelete(id: number): Promise<Donor> {
  return DonorModel.softDelete(id);
}
