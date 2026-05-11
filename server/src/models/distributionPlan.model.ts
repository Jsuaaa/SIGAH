import { db } from '../db/client';
import type {
  DistributionPlan,
  DistributionPlanScope,
  DistributionPlanStatus,
  DistributionPlanWithItems,
} from '../types/entities';

// ---- Input types ----------------------------------------------------------

export interface CreatePlanInput {
  scope: DistributionPlanScope;
  scope_id?: number | null;
  target_coverage_days: number;
  notes?: string | null;
  family_ids?: number[] | null;  // solo para scope=LOTE
}

export interface ListPlanFilters {
  status?: DistributionPlanStatus;
  scope?: DistributionPlanScope;
  created_by?: number;
  limit: number;
  offset: number;
}

// ---- Internal row shapes returned by SPs/FNs ------------------------------

interface PlanListRow {
  data: DistributionPlanWithItems[];
  total: string;  // BIGINT comes as string from pg
}

interface PlanDataRow {
  data: DistributionPlanWithItems;
}

// ---- Model ----------------------------------------------------------------

export const DistributionPlanModel = {
  async create(
    input: CreatePlanInput,
    user_id: number,
    ip: string | null,
    user_agent: string | null,
  ): Promise<DistributionPlan> {
    const request = {
      scope: input.scope,
      scope_id: input.scope_id ?? null,
      target_coverage_days: input.target_coverage_days,
      notes: input.notes ?? null,
      family_ids: input.family_ids?.length ? input.family_ids : null,
    };

    const row = await db.queryOne<DistributionPlan>(
      'SELECT * FROM sp_distribution_plans_create($1::jsonb, $2, $3::inet, $4)',
      [JSON.stringify(request), user_id, ip, user_agent],
    );
    if (!row) throw new Error('sp_distribution_plans_create returned no row');
    return row;
  },

  async list(
    filters: ListPlanFilters,
  ): Promise<{ data: DistributionPlanWithItems[]; total: number }> {
    const row = await db.queryOne<PlanListRow>(
      `SELECT data, total
         FROM fn_distribution_plans_list(
           $1::distribution_plan_status,
           $2::distribution_plan_scope,
           $3,
           $4,
           $5
         )`,
      [
        filters.status ?? null,
        filters.scope ?? null,
        filters.created_by ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async findById(id: number): Promise<DistributionPlanWithItems | null> {
    const row = await db.queryOne<PlanDataRow>(
      'SELECT data FROM fn_distribution_plans_find_by_id($1)',
      [id],
    );
    return row?.data ?? null;
  },

  async cancel(
    plan_id: number,
    user_id: number,
  ): Promise<DistributionPlan> {
    const row = await db.queryOne<DistributionPlan>(
      'SELECT * FROM sp_distribution_plans_cancel($1, $2)',
      [plan_id, user_id],
    );
    if (!row) throw new Error('sp_distribution_plans_cancel returned no row');
    return row;
  },

  async execute(
    plan_id: number,
    user_id: number,
    ip: string | null,
    user_agent: string | null,
  ): Promise<DistributionPlan> {
    const row = await db.queryOne<DistributionPlan>(
      'SELECT * FROM sp_distribution_plans_execute($1, $2, $3::inet, $4)',
      [plan_id, user_id, ip, user_agent],
    );
    if (!row) throw new Error('sp_distribution_plans_execute returned no row');
    return row;
  },
};
