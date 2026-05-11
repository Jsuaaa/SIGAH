import { db } from '../db/client';
import type { FamilyStatus, NextBatchRow, RankingRow } from '../types/entities';

export interface RankingFilters {
  zone_id?: number;
  status?: FamilyStatus;
  limit: number;
  offset: number;
}

interface RankingListRow {
  data: RankingRow[];
  total: string;
}

interface NextBatchDataRow {
  data: NextBatchRow;
}

export const PrioritizationModel = {
  async ranking(
    filters: RankingFilters,
  ): Promise<{ data: RankingRow[]; total: number }> {
    const row = await db.queryOne<RankingListRow>(
      'SELECT * FROM fn_prioritization_ranking($1, $2::family_status, $3, $4)',
      [
        filters.zone_id ?? null,
        filters.status ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async recalculateAll(): Promise<number> {
    const row = await db.queryOne<{ sp_prioritization_recalculate_all: number }>(
      'SELECT sp_prioritization_recalculate_all()',
    );
    return row?.sp_prioritization_recalculate_all ?? 0;
  },

  async nextBatch(count: number): Promise<NextBatchRow[]> {
    const result = await db.query<NextBatchDataRow>(
      'SELECT data FROM fn_prioritization_next_batch($1)',
      [count],
    );
    return result.rows.map((r) => r.data);
  },
};
