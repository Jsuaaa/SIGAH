import {
  DistributionPlanModel,
  type CreatePlanInput,
  type ListPlanFilters,
} from '../models/distributionPlan.model';
import type {
  DistributionPlan,
  DistributionPlanScope,
  DistributionPlanStatus,
  DistributionPlanWithItems,
} from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreatePlanInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  status?: DistributionPlanStatus;
  scope?: DistributionPlanScope;
  created_by?: number;
}

export async function create(
  input: CreatePlanInput,
  user_id: number,
  ip: string | null,
  user_agent: string | null,
): Promise<DistributionPlan> {
  return DistributionPlanModel.create(input, user_id, ip, user_agent);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: DistributionPlanWithItems[]; total: number }> {
  const f: ListPlanFilters = {
    limit: filters.limit,
    offset: filters.skip,
    ...(filters.status !== undefined ? { status: filters.status } : {}),
    ...(filters.scope !== undefined ? { scope: filters.scope } : {}),
    ...(filters.created_by !== undefined ? { created_by: filters.created_by } : {}),
  };
  return DistributionPlanModel.list(f);
}

export async function getById(id: number): Promise<DistributionPlanWithItems> {
  const row = await DistributionPlanModel.findById(id);
  if (!row) throw new AppError('Distribution plan not found', 404);
  return row;
}

export async function cancel(
  plan_id: number,
  user_id: number,
): Promise<DistributionPlan> {
  return DistributionPlanModel.cancel(plan_id, user_id);
}

export async function execute(
  plan_id: number,
  user_id: number,
  ip: string | null,
  user_agent: string | null,
): Promise<DistributionPlan> {
  return DistributionPlanModel.execute(plan_id, user_id, ip, user_agent);
}
