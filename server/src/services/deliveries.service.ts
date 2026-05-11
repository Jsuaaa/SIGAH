import {
  DeliveryModel,
  type CreateExceptionInput,
  type CreateDeliveryInput,
  type BatchResult,
  type ListDeliveryFilters,
} from '../models/delivery.model';
import type {
  Delivery,
  DeliveryEligibility,
  DeliveryEnriched,
  DeliveryStatus,
} from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateExceptionInput, CreateDeliveryInput, BatchResult };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  family_id?: number;
  warehouse_id?: number;
  status?: DeliveryStatus;
  date_from?: string;
  date_to?: string;
}

export async function list(
  filters: ListFilters,
): Promise<{ data: DeliveryEnriched[]; total: number }> {
  const m: ListDeliveryFilters = {
    limit: filters.limit,
    offset: filters.skip,
    ...(filters.family_id !== undefined ? { family_id: filters.family_id } : {}),
    ...(filters.warehouse_id !== undefined ? { warehouse_id: filters.warehouse_id } : {}),
    ...(filters.status !== undefined ? { status: filters.status } : {}),
    ...(filters.date_from !== undefined ? { date_from: filters.date_from } : {}),
    ...(filters.date_to !== undefined ? { date_to: filters.date_to } : {}),
  };
  return DeliveryModel.list(m);
}

export async function getById(id: number): Promise<DeliveryEnriched> {
  const row = await DeliveryModel.findById(id);
  if (!row) throw new AppError('Delivery not found', 404);
  return row;
}

export async function listByFamily(family_id: number): Promise<DeliveryEnriched[]> {
  return DeliveryModel.listByFamily(family_id);
}

export async function checkEligibility(family_id: number): Promise<DeliveryEligibility> {
  const row = await DeliveryModel.checkEligibility(family_id);
  if (!row) throw new AppError('Family not found', 404);
  return row;
}

export async function createException(
  input: CreateExceptionInput,
  user_id: number,
  ip: string | null,
  user_agent: string | null,
): Promise<Delivery> {
  return DeliveryModel.createException(input, user_id, ip, user_agent);
}

export async function create(
  input: CreateDeliveryInput,
  user_id: number,
  ip: string | null,
  user_agent: string | null,
): Promise<Delivery> {
  return DeliveryModel.create(input, user_id, ip, user_agent);
}

export async function updateStatus(
  id: number,
  status: DeliveryStatus,
  user_id: number,
): Promise<Delivery> {
  const row = await DeliveryModel.updateStatus(id, status, user_id);
  if (!row) throw new AppError('Delivery not found', 404);
  return row;
}

export async function createBatch(
  count: number,
  user_id: number,
  ip: string | null,
  user_agent: string | null,
): Promise<BatchResult> {
  return DeliveryModel.createBatch(count, user_id, ip, user_agent);
}
