import { PrioritizationModel } from '../models/prioritization.model';
import { invalidateCache } from './scoringConfig.service';
import type { FamilyStatus, NextBatchRow, RankingRow } from '../types/entities';

export interface RankingFilters {
  page: number;
  limit: number;
  skip: number;
  zone_id?: number;
  status?: FamilyStatus;
}

export async function ranking(
  filters: RankingFilters,
): Promise<{ data: RankingRow[]; total: number }> {
  return PrioritizationModel.ranking({
    zone_id: filters.zone_id,
    status: filters.status,
    limit: filters.limit,
    offset: filters.skip,
  });
}

// Bulk recompute. Invalidates the scoring weight cache first so the SP runs
// with whatever the latest config is in the table — defensive in case the
// caller is updating weights and recomputing in close succession.
export async function recalculateAll(): Promise<number> {
  invalidateCache();
  return PrioritizationModel.recalculateAll();
}

export async function nextBatch(count: number): Promise<NextBatchRow[]> {
  return PrioritizationModel.nextBatch(count);
}
