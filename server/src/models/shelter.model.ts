// Data-access layer for the `shelters` table. Each method wraps one SP call.

import { db } from '../db/client';
import type { Shelter, ShelterType, ShelterWithOccupancy } from '../types/entities';

export interface CreateShelterInput {
  name: string;
  address: string;
  zone_id: number;
  max_capacity: number;
  current_occupancy?: number;
  type: ShelterType;
  latitude: number;
  longitude: number;
}

export type UpdateShelterInput = Partial<CreateShelterInput>;

export interface ListShelterFilters {
  zone_id?: number;
  type?: ShelterType;
  search?: string;
  limit: number;
  offset: number;
}

// fn_shelters_list returns a single row { data: jsonb, total: bigint }.
interface ShelterListRow {
  data: ShelterWithOccupancy[];
  total: string; // pg returns BIGINT as string
}

interface ShelterDataRow {
  data: ShelterWithOccupancy;
}

export const ShelterModel = {
  async create(input: CreateShelterInput): Promise<Shelter> {
    const row = await db.queryOne<Shelter>(
      'SELECT * FROM fn_shelters_create($1, $2, $3, $4, $5, $6::shelter_type, $7, $8)',
      [
        input.name,
        input.address,
        input.zone_id,
        input.max_capacity,
        input.current_occupancy ?? null,
        input.type,
        input.latitude,
        input.longitude,
      ],
    );
    if (!row) throw new Error('fn_shelters_create returned no row');
    return row;
  },

  async findById(id: number): Promise<ShelterWithOccupancy | null> {
    const row = await db.queryOne<ShelterDataRow>(
      'SELECT data FROM fn_shelters_find_by_id($1)',
      [id],
    );
    return row?.data ?? null;
  },

  async list(
    filters: ListShelterFilters,
  ): Promise<{ data: ShelterWithOccupancy[]; total: number }> {
    const row = await db.queryOne<ShelterListRow>(
      'SELECT * FROM fn_shelters_list($1, $2::shelter_type, $3, $4, $5)',
      [
        filters.zone_id ?? null,
        filters.type ?? null,
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

  async update(id: number, input: UpdateShelterInput): Promise<Shelter> {
    const row = await db.queryOne<Shelter>(
      'SELECT * FROM fn_shelters_update($1, $2, $3, $4, $5, $6, $7::shelter_type, $8, $9)',
      [
        id,
        input.name ?? null,
        input.address ?? null,
        input.zone_id ?? null,
        input.max_capacity ?? null,
        input.current_occupancy ?? null,
        input.type ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
      ],
    );
    if (!row) throw new Error('fn_shelters_update returned no row');
    return row;
  },

  async setOccupancy(id: number, current_occupancy: number): Promise<Shelter> {
    const row = await db.queryOne<Shelter>(
      'SELECT * FROM sp_shelters_set_occupancy($1, $2)',
      [id, current_occupancy],
    );
    if (!row) throw new Error('sp_shelters_set_occupancy returned no row');
    return row;
  },

  async remove(id: number): Promise<void> {
    await db.query('SELECT sp_shelters_delete($1)', [id]);
  },

  async listByZone(zone_id: number): Promise<ShelterWithOccupancy[]> {
    const result = await db.query<ShelterDataRow>(
      'SELECT data FROM fn_zones_shelters($1)',
      [zone_id],
    );
    return result.rows.map((r) => r.data);
  },
};
