import {
  HealthVectorModel,
  type CreateHealthVectorInput,
  type ListHealthVectorFilters,
  type UpdateHealthVectorInput,
} from '../models/healthVector.model';
import type {
  HealthVector,
  HealthVectorEnriched,
  HealthVectorStatus,
  RiskLevel,
  VectorType,
} from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateHealthVectorInput, UpdateHealthVectorInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  zone_id?: number;
  shelter_id?: number;
  risk_level?: RiskLevel;
  vector_type?: VectorType;
  status?: HealthVectorStatus;
}

export async function create(
  input: CreateHealthVectorInput,
  userId: number,
  ip: string | null,
  userAgent: string | null,
): Promise<HealthVector> {
  return HealthVectorModel.create(input, userId, ip, userAgent);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: HealthVectorEnriched[]; total: number }> {
  const modelFilters: ListHealthVectorFilters = {
    zone_id: filters.zone_id,
    shelter_id: filters.shelter_id,
    risk_level: filters.risk_level,
    vector_type: filters.vector_type,
    status: filters.status,
    limit: filters.limit,
    offset: filters.skip,
  };
  return HealthVectorModel.list(modelFilters);
}

export async function getById(id: number): Promise<HealthVectorEnriched> {
  const row = await HealthVectorModel.findById(id);
  if (!row) throw new AppError('Health vector not found', 404);
  return row;
}

export async function update(
  id: number,
  input: UpdateHealthVectorInput,
  userId: number,
  ip: string | null,
  userAgent: string | null,
): Promise<HealthVector> {
  return HealthVectorModel.update(id, input, userId, ip, userAgent);
}

export async function setStatus(
  id: number,
  newStatus: HealthVectorStatus,
  actionsTaken: string | null,
  userId: number,
  ip: string | null,
  userAgent: string | null,
): Promise<HealthVector> {
  return HealthVectorModel.setStatus(id, newStatus, actionsTaken, userId, ip, userAgent);
}

export async function remove(id: number, userId: number): Promise<void> {
  return HealthVectorModel.delete(id, userId);
}
