// Data-access layer for the `zones` table. Each method wraps one SP call.

import { db } from '../db/client';
import type { RiskLevel, Zone } from '../types/entities';

export interface CreateZoneInput {
  name: string;
  risk_level: RiskLevel;
  latitude: number;
  longitude: number;
  estimated_population: number;
}

export type UpdateZoneInput = Partial<CreateZoneInput>;

export interface ListZoneFilters {
  risk_level?: RiskLevel;
  search?: string;
  limit: number;
  offset: number;
}

// fn_zones_list returns a single row { data: jsonb, total: bigint } so the
// service can build pagination without a second round-trip.
interface ZoneListRow {
  data: Zone[];
  total: string; // pg returns BIGINT as string
}

export const ZoneModel = {
  async create(input: CreateZoneInput): Promise<Zone> {
    const row = await db.queryOne<Zone>(
      'SELECT * FROM fn_zones_create($1, $2::risk_level, $3, $4, $5)',
      [
        input.name,
        input.risk_level,
        input.latitude,
        input.longitude,
        input.estimated_population,
      ],
    );
    if (!row) throw new Error('fn_zones_create returned no row');
    return row;
  },

  async findById(id: number): Promise<Zone | null> {
    return db.queryOne<Zone>('SELECT * FROM fn_zones_find_by_id($1)', [id]);
  },

  async list(
    filters: ListZoneFilters,
  ): Promise<{ data: Zone[]; total: number }> {
    const row = await db.queryOne<ZoneListRow>(
      'SELECT * FROM fn_zones_list($1::risk_level, $2, $3, $4)',
      [
        filters.risk_level ?? null,
        filters.search ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return {
      data: row.data ?? [],
      total: Number(row.total),
    };
  },

  async update(id: number, input: UpdateZoneInput): Promise<Zone> {
    const row = await db.queryOne<Zone>(
      'SELECT * FROM fn_zones_update($1, $2, $3::risk_level, $4, $5, $6)',
      [
        id,
        input.name ?? null,
        input.risk_level ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.estimated_population ?? null,
      ],
    );
    if (!row) throw new Error('fn_zones_update returned no row');
    return row;
  },

  async remove(id: number): Promise<void> {
    await db.query('SELECT sp_zones_delete($1)', [id]);
  },
};
