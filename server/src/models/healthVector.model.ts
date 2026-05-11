import { db } from '../db/client';
import type {
  HealthVector,
  HealthVectorEnriched,
  HealthVectorStatus,
  RiskLevel,
  VectorType,
} from '../types/entities';

export interface CreateHealthVectorInput {
  vector_type: VectorType;
  risk_level: RiskLevel;
  description?: string | null;
  actions_taken?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zone_id?: number | null;
  shelter_id?: number | null;
  reported_date?: string | null;
}

export interface UpdateHealthVectorInput {
  description?: string | null;
  actions_taken?: string | null;
  risk_level?: RiskLevel;
  latitude?: number | null;
  longitude?: number | null;
  zone_id?: number | null;
  shelter_id?: number | null;
}

export interface ListHealthVectorFilters {
  zone_id?: number;
  shelter_id?: number;
  risk_level?: RiskLevel;
  vector_type?: VectorType;
  status?: HealthVectorStatus;
  limit: number;
  offset: number;
}

interface HealthVectorListRow {
  data: HealthVectorEnriched[];
  total: string;
}

export const HealthVectorModel = {
  async create(
    input: CreateHealthVectorInput,
    userId: number,
    ip: string | null,
    userAgent: string | null,
  ): Promise<HealthVector> {
    const row = await db.queryOne<HealthVector>(
      'SELECT * FROM fn_health_vectors_create($1::jsonb, $2, $3::inet, $4)',
      [JSON.stringify(input), userId, ip, userAgent],
    );
    if (!row) throw new Error('fn_health_vectors_create returned no row');
    return row;
  },

  async findById(id: number): Promise<HealthVectorEnriched | null> {
    const row = await db.queryOne<{ data: HealthVectorEnriched }>(
      'SELECT fn_health_vectors_find_by_id($1) AS data',
      [id],
    );
    return row?.data ?? null;
  },

  async list(
    filters: ListHealthVectorFilters,
  ): Promise<{ data: HealthVectorEnriched[]; total: number }> {
    const row = await db.queryOne<HealthVectorListRow>(
      `SELECT * FROM fn_health_vectors_list(
         $1::integer,
         $2::integer,
         $3::risk_level,
         $4::vector_type,
         $5::health_vector_status,
         $6,
         $7
       )`,
      [
        filters.zone_id ?? null,
        filters.shelter_id ?? null,
        filters.risk_level ?? null,
        filters.vector_type ?? null,
        filters.status ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async update(
    id: number,
    input: UpdateHealthVectorInput,
    userId: number,
    ip: string | null,
    userAgent: string | null,
  ): Promise<HealthVector> {
    const row = await db.queryOne<HealthVector>(
      'SELECT * FROM sp_health_vectors_update($1, $2::jsonb, $3, $4::inet, $5)',
      [id, JSON.stringify(input), userId, ip, userAgent],
    );
    if (!row) throw new Error('sp_health_vectors_update returned no row');
    return row;
  },

  async setStatus(
    id: number,
    newStatus: HealthVectorStatus,
    actionsTaken: string | null,
    userId: number,
    ip: string | null,
    userAgent: string | null,
  ): Promise<HealthVector> {
    const row = await db.queryOne<HealthVector>(
      'SELECT * FROM sp_health_vector_set_status($1, $2::health_vector_status, $3, $4, $5::inet, $6)',
      [id, newStatus, actionsTaken, userId, ip, userAgent],
    );
    if (!row) throw new Error('sp_health_vector_set_status returned no row');
    return row;
  },

  async delete(id: number, userId: number): Promise<void> {
    await db.query('SELECT sp_health_vectors_delete($1, $2)', [id, userId]);
  },
};
