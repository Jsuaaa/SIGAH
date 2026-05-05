// Data-access layer for the `families` table.
// Each method wraps a single SP call. Aggregate counts (num_*) are not
// touched here: issue #14 wires them to person mutations.

import { db } from '../db/client';
import type { Family, FamilyStatus } from '../types/entities';

export interface CreateFamilyInput {
  head_document: string;
  zone_id: number;
  shelter_id?: number | null;
  num_members: number;
  num_children_under_5?: number;
  num_adults_over_65?: number;
  num_pregnant?: number;
  num_disabled?: number;
  status?: FamilyStatus;
  latitude?: number | null;
  longitude?: number | null;
  reference_address?: string | null;
  privacy_consent_accepted: boolean;
}

export interface UpdateFamilyInput {
  head_document?: string;
  zone_id?: number;
  shelter_id?: number | null;
  status?: FamilyStatus;
  latitude?: number | null;
  longitude?: number | null;
  reference_address?: string | null;
}

export type FamilyOrderBy =
  | 'priority_score_desc'
  | 'created_at_desc'
  | 'family_code_asc';

export interface ListFamilyFilters {
  zone_id?: number;
  shelter_id?: number;
  status?: FamilyStatus;
  order_by?: FamilyOrderBy;
  limit: number;
  offset: number;
}

export interface SearchFamilyFilters {
  query: string;
  limit: number;
  offset: number;
}

interface FamilyListRow {
  data: Family[];
  total: string; // BIGINT
}

export interface FamilyEligibility {
  family_id: number;
  family_code: string;
  is_eligible: boolean;
  reason: string;
  next_eligible_at: Date | null;
}

export const FamilyModel = {
  async createWithConsent(
    input: CreateFamilyInput,
    user_id: number,
    ip: string | null,
    user_agent: string | null,
  ): Promise<Family> {
    const familyJson = {
      head_document: input.head_document,
      zone_id: input.zone_id,
      shelter_id: input.shelter_id ?? null,
      num_members: input.num_members,
      num_children_under_5: input.num_children_under_5 ?? 0,
      num_adults_over_65: input.num_adults_over_65 ?? 0,
      num_pregnant: input.num_pregnant ?? 0,
      num_disabled: input.num_disabled ?? 0,
      status: input.status ?? 'ACTIVO',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      reference_address: input.reference_address ?? null,
    };
    const consentJson = {
      privacy_consent_accepted: input.privacy_consent_accepted,
    };

    const row = await db.queryOne<Family>(
      'SELECT * FROM sp_families_create_with_consent($1::jsonb, $2::jsonb, $3, $4::inet, $5)',
      [
        JSON.stringify(familyJson),
        JSON.stringify(consentJson),
        user_id,
        ip,
        user_agent,
      ],
    );
    if (!row) throw new Error('sp_families_create_with_consent returned no row');
    return row;
  },

  async findById(id: number): Promise<Family | null> {
    return db.queryOne<Family>('SELECT * FROM fn_families_find_by_id($1)', [id]);
  },

  async list(
    filters: ListFamilyFilters,
  ): Promise<{ data: Family[]; total: number }> {
    const row = await db.queryOne<FamilyListRow>(
      'SELECT * FROM fn_families_list($1, $2, $3::family_status, $4, $5, $6)',
      [
        filters.zone_id ?? null,
        filters.shelter_id ?? null,
        filters.status ?? null,
        filters.order_by ?? 'priority_score_desc',
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async search(
    filters: SearchFamilyFilters,
  ): Promise<{ data: Family[]; total: number }> {
    const row = await db.queryOne<FamilyListRow>(
      'SELECT * FROM fn_families_search($1, $2, $3)',
      [filters.query, filters.limit, filters.offset],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async update(id: number, input: UpdateFamilyInput): Promise<Family> {
    const row = await db.queryOne<Family>(
      'SELECT * FROM sp_families_update($1, $2, $3, $4, $5::family_status, $6, $7, $8)',
      [
        id,
        input.head_document ?? null,
        input.zone_id ?? null,
        input.shelter_id ?? null,
        input.status ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.reference_address ?? null,
      ],
    );
    if (!row) throw new Error('sp_families_update returned no row');
    return row;
  },

  async remove(id: number): Promise<void> {
    await db.query('SELECT sp_families_delete($1)', [id]);
  },

  async getEligibility(id: number): Promise<FamilyEligibility | null> {
    return db.queryOne<FamilyEligibility>(
      'SELECT * FROM fn_families_get_eligibility($1)',
      [id],
    );
  },

  async listByZone(zone_id: number): Promise<Family[]> {
    const result = await db.query<{ data: Family }>(
      'SELECT data FROM fn_zones_families($1)',
      [zone_id],
    );
    return result.rows.map((r) => r.data);
  },
};
