import { db } from '../db/client';
import type {
  Relocation,
  RelocationEnriched,
  RelocationType,
} from '../types/entities';

export interface ApplyRelocationInput {
  family_id: number;
  destination_shelter_id: number;
  type: RelocationType;
  reason: string;
  notes?: string | null;
}

export interface ListRelocationFilters {
  family_id?: number;
  shelter_id?: number;
  type?: RelocationType;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
}

interface RelocationListRow {
  data: RelocationEnriched[];
  total: string;
}

export const RelocationModel = {
  async apply(
    input: ApplyRelocationInput,
    user_id: number,
    ip: string | null,
    user_agent: string | null,
  ): Promise<Relocation> {
    const requestJson = {
      family_id: input.family_id,
      destination_shelter_id: input.destination_shelter_id,
      type: input.type,
      reason: input.reason,
      notes: input.notes ?? null,
    };

    const row = await db.queryOne<Relocation>(
      'SELECT * FROM sp_relocation_apply($1::jsonb, $2, $3::inet, $4)',
      [JSON.stringify(requestJson), user_id, ip, user_agent],
    );
    if (!row) throw new Error('sp_relocation_apply returned no row');
    return row;
  },

  async list(
    filters: ListRelocationFilters,
  ): Promise<{ data: RelocationEnriched[]; total: number }> {
    const row = await db.queryOne<RelocationListRow>(
      'SELECT * FROM fn_relocations_list($1, $2, $3::relocation_type, $4::timestamptz, $5::timestamptz, $6, $7)',
      [
        filters.family_id ?? null,
        filters.shelter_id ?? null,
        filters.type ?? null,
        filters.date_from ?? null,
        filters.date_to ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async findById(id: number): Promise<RelocationEnriched | null> {
    const row = await db.queryOne<{ data: RelocationEnriched }>(
      'SELECT fn_relocations_find_by_id($1) AS data',
      [id],
    );
    return row?.data ?? null;
  },
};
