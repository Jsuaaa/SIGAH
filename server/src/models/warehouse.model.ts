// Data-access layer for the `warehouses` table. Every method wraps a single
// SP. Capacity invariants (RN-03) are enforced inside the SPs and surface as
// SH422.

import { db } from '../db/client';
import type {
  Warehouse,
  WarehouseStatus,
  WarehouseWithDistance,
  WarehouseWithOccupancy,
} from '../types/entities';

export interface CreateWarehouseInput {
  name: string;
  address: string;
  zone_id: number;
  max_capacity_kg: number;
  current_weight_kg?: number;
  status?: WarehouseStatus;
  latitude: number;
  longitude: number;
}

export type UpdateWarehouseInput = Partial<CreateWarehouseInput>;

export interface ListWarehouseFilters {
  zone_id?: number;
  status?: WarehouseStatus;
  search?: string;
  limit: number;
  offset: number;
}

interface WarehouseListRow {
  data: WarehouseWithOccupancy[];
  total: string; // BIGINT
}

interface WarehouseDataRow {
  data: WarehouseWithOccupancy;
}

interface WarehouseDistanceRow {
  data: WarehouseWithDistance;
}

export const WarehouseModel = {
  async create(input: CreateWarehouseInput): Promise<Warehouse> {
    const row = await db.queryOne<Warehouse>(
      'SELECT * FROM fn_warehouses_create($1, $2, $3, $4, $5, $6::warehouse_status, $7, $8)',
      [
        input.name,
        input.address,
        input.zone_id,
        input.max_capacity_kg,
        input.current_weight_kg ?? null,
        input.status ?? null,
        input.latitude,
        input.longitude,
      ],
    );
    if (!row) throw new Error('fn_warehouses_create returned no row');
    return row;
  },

  async findById(id: number): Promise<WarehouseWithOccupancy | null> {
    const row = await db.queryOne<WarehouseDataRow>(
      'SELECT data FROM fn_warehouses_find_by_id($1)',
      [id],
    );
    return row?.data ?? null;
  },

  async list(
    filters: ListWarehouseFilters,
  ): Promise<{ data: WarehouseWithOccupancy[]; total: number }> {
    const row = await db.queryOne<WarehouseListRow>(
      'SELECT * FROM fn_warehouses_list($1, $2::warehouse_status, $3, $4, $5)',
      [
        filters.zone_id ?? null,
        filters.status ?? null,
        filters.search ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async update(id: number, input: UpdateWarehouseInput): Promise<Warehouse> {
    const row = await db.queryOne<Warehouse>(
      'SELECT * FROM fn_warehouses_update($1, $2, $3, $4, $5, $6, $7::warehouse_status, $8, $9)',
      [
        id,
        input.name ?? null,
        input.address ?? null,
        input.zone_id ?? null,
        input.max_capacity_kg ?? null,
        input.current_weight_kg ?? null,
        input.status ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
      ],
    );
    if (!row) throw new Error('fn_warehouses_update returned no row');
    return row;
  },

  async remove(id: number): Promise<void> {
    await db.query('SELECT sp_warehouses_delete($1)', [id]);
  },

  async nearest(
    latitude: number,
    longitude: number,
    limit: number,
  ): Promise<WarehouseWithDistance[]> {
    const result = await db.query<WarehouseDistanceRow>(
      'SELECT data FROM fn_warehouses_nearest($1, $2, $3)',
      [latitude, longitude, limit],
    );
    return result.rows.map((r) => r.data);
  },

  async listByZone(zone_id: number): Promise<WarehouseWithOccupancy[]> {
    const result = await db.query<WarehouseDataRow>(
      'SELECT data FROM fn_zones_warehouses($1)',
      [zone_id],
    );
    return result.rows.map((r) => r.data);
  },
};
