import { db } from '../db/client';
import type {
  Delivery,
  DeliveryDetailInput,
  DeliveryEligibility,
  DeliveryEnriched,
  DeliveryStatus,
} from '../types/entities';

export interface CreateExceptionInput {
  family_id: number;
  source_warehouse_id: number;
  coverage_days: number;
  exception_reason: string;
  exception_authorized_by: number;
  received_by_document?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  notes?: string | null;
  client_op_id?: string | null;
  details: DeliveryDetailInput[];
}

export interface CreateDeliveryInput {
  family_id: number;
  source_warehouse_id: number;
  coverage_days: number;
  received_by_document?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  notes?: string | null;
  client_op_id?: string | null;
  details: DeliveryDetailInput[];
}

export interface BatchResult {
  created: number;
  skipped: number;
  skipped_families: unknown[];
}

export interface ListDeliveryFilters {
  family_id?: number;
  warehouse_id?: number;
  status?: DeliveryStatus;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
}

interface DeliveryListRow {
  data: DeliveryEnriched[];
  total: string;
}

interface DeliveryDataRow {
  data: DeliveryEnriched;
}

export const DeliveryModel = {
  async list(
    filters: ListDeliveryFilters,
  ): Promise<{ data: DeliveryEnriched[]; total: number }> {
    const row = await db.queryOne<DeliveryListRow>(
      'SELECT * FROM fn_deliveries_list($1, $2, $3::delivery_status, $4::timestamptz, $5::timestamptz, $6, $7)',
      [
        filters.family_id ?? null,
        filters.warehouse_id ?? null,
        filters.status ?? null,
        filters.date_from ?? null,
        filters.date_to ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async findById(id: number): Promise<DeliveryEnriched | null> {
    const row = await db.queryOne<DeliveryDataRow>(
      'SELECT data FROM fn_deliveries_find_by_id($1)',
      [id],
    );
    return row?.data ?? null;
  },

  async listByFamily(family_id: number): Promise<DeliveryEnriched[]> {
    const result = await db.query<DeliveryDataRow>(
      'SELECT data FROM fn_deliveries_by_family($1)',
      [family_id],
    );
    return result.rows.map((r) => r.data);
  },

  async checkEligibility(family_id: number): Promise<DeliveryEligibility | null> {
    return db.queryOne<DeliveryEligibility>(
      'SELECT * FROM fn_delivery_check_eligibility($1)',
      [family_id],
    );
  },

  async createException(
    input: CreateExceptionInput,
    user_id: number,
    ip: string | null,
    user_agent: string | null,
  ): Promise<Delivery> {
    const requestJson = {
      family_id: input.family_id,
      source_warehouse_id: input.source_warehouse_id,
      coverage_days: input.coverage_days,
      exception_reason: input.exception_reason,
      exception_authorized_by: input.exception_authorized_by,
      received_by_document: input.received_by_document ?? null,
      delivery_latitude: input.delivery_latitude ?? null,
      delivery_longitude: input.delivery_longitude ?? null,
      notes: input.notes ?? null,
      client_op_id: input.client_op_id ?? null,
    };

    const row = await db.queryOne<Delivery>(
      'SELECT * FROM sp_delivery_create_exception($1::jsonb, $2::jsonb, $3, $4::inet, $5)',
      [
        JSON.stringify(requestJson),
        JSON.stringify(input.details ?? []),
        user_id,
        ip,
        user_agent,
      ],
    );
    if (!row) throw new Error('sp_delivery_create_exception returned no row');
    return row;
  },

  async create(
    input: CreateDeliveryInput,
    user_id: number,
    ip: string | null,
    user_agent: string | null,
  ): Promise<Delivery> {
    const requestJson = {
      family_id: input.family_id,
      source_warehouse_id: input.source_warehouse_id,
      coverage_days: input.coverage_days,
      received_by_document: input.received_by_document ?? null,
      delivery_latitude: input.delivery_latitude ?? null,
      delivery_longitude: input.delivery_longitude ?? null,
      notes: input.notes ?? null,
      client_op_id: input.client_op_id ?? null,
    };

    const row = await db.queryOne<Delivery>(
      'SELECT * FROM sp_delivery_create($1::jsonb, $2::jsonb, $3, $4::inet, $5)',
      [
        JSON.stringify(requestJson),
        JSON.stringify(input.details ?? []),
        user_id,
        ip,
        user_agent,
      ],
    );
    if (!row) throw new Error('sp_delivery_create returned no row');
    return row;
  },

  async updateStatus(
    id: number,
    status: DeliveryStatus,
    user_id: number,
  ): Promise<Delivery> {
    const row = await db.queryOne<Delivery>(
      'SELECT * FROM sp_delivery_update_status($1, $2::delivery_status, $3)',
      [id, status, user_id],
    );
    if (!row) throw new Error('sp_delivery_update_status returned no row');
    return row;
  },

  async createBatch(
    count: number,
    user_id: number,
    ip: string | null,
    user_agent: string | null,
  ): Promise<BatchResult> {
    const row = await db.queryOne<{ created: number; skipped: number; skipped_families: unknown[] }>(
      'SELECT * FROM sp_delivery_create_batch($1, $2, $3::inet, $4)',
      [count, user_id, ip, user_agent],
    );
    if (!row) throw new Error('sp_delivery_create_batch returned no row');
    return {
      created: Number(row.created),
      skipped: Number(row.skipped),
      skipped_families: Array.isArray(row.skipped_families) ? row.skipped_families : [],
    };
  },
};
