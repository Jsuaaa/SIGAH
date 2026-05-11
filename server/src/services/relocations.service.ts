import {
  RelocationModel,
  type ApplyRelocationInput,
  type ListRelocationFilters,
} from '../models/relocation.model';
import type { Relocation, RelocationEnriched, RelocationType } from '../types/entities';
import { AppError } from '../utils/AppError';

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  family_id?: number;
  shelter_id?: number;
  type?: RelocationType;
  date_from?: string;
  date_to?: string;
}

export async function apply(
  input: ApplyRelocationInput,
  user_id: number,
  ip: string | null,
  user_agent: string | null,
): Promise<Relocation> {
  return RelocationModel.apply(input, user_id, ip, user_agent);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: RelocationEnriched[]; total: number }> {
  const m: ListRelocationFilters = {
    limit: filters.limit,
    offset: filters.skip,
    ...(filters.family_id !== undefined ? { family_id: filters.family_id } : {}),
    ...(filters.shelter_id !== undefined ? { shelter_id: filters.shelter_id } : {}),
    ...(filters.type !== undefined ? { type: filters.type } : {}),
    ...(filters.date_from !== undefined ? { date_from: filters.date_from } : {}),
    ...(filters.date_to !== undefined ? { date_to: filters.date_to } : {}),
  };
  return RelocationModel.list(m);
}

export async function getById(id: number): Promise<RelocationEnriched> {
  const row = await RelocationModel.findById(id);
  if (!row) throw new AppError('Relocation not found', 404);
  return row;
}
