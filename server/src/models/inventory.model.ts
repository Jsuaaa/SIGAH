import { db } from '../db/client';
import type {
  AdjustmentReason,
  InventoryRow,
  InventoryRowEnriched,
  InventorySummaryRow,
  ResourceCategory,
} from '../types/entities';

export interface UpsertInventoryInput {
  warehouse_id: number;
  resource_type_id: number;
  quantity: number;
  batch?: string | null;
  expiration_date?: string | null;
}

export interface AdjustInventoryInput {
  delta: number;
  reason: AdjustmentReason;
  reason_note: string;
  user_id: number;
}

export interface ListInventoryFilters {
  warehouse_id?: number;
  resource_type_id?: number;
  category?: ResourceCategory;
  only_in_stock?: boolean;
  limit: number;
  offset: number;
}

interface InventoryListRow {
  data: InventoryRowEnriched[];
  total: string;
}

interface InventoryDataRow {
  data: InventoryRowEnriched;
}

export const InventoryModel = {
  async upsert(input: UpsertInventoryInput): Promise<InventoryRow> {
    const row = await db.queryOne<InventoryRow>(
      'SELECT * FROM sp_inventory_upsert($1, $2, $3, $4, $5::date)',
      [
        input.warehouse_id,
        input.resource_type_id,
        input.quantity,
        input.batch ?? null,
        input.expiration_date ?? null,
      ],
    );
    if (!row) throw new Error('sp_inventory_upsert returned no row');
    return row;
  },

  async adjust(id: number, input: AdjustInventoryInput): Promise<InventoryRow> {
    const row = await db.queryOne<InventoryRow>(
      'SELECT * FROM sp_inventory_adjust($1, $2, $3::adjustment_reason, $4, $5)',
      [id, input.delta, input.reason, input.reason_note, input.user_id],
    );
    if (!row) throw new Error('sp_inventory_adjust returned no row');
    return row;
  },

  async list(
    filters: ListInventoryFilters,
  ): Promise<{ data: InventoryRowEnriched[]; total: number }> {
    const row = await db.queryOne<InventoryListRow>(
      'SELECT * FROM fn_inventory_list($1, $2, $3::resource_category, $4, $5, $6)',
      [
        filters.warehouse_id ?? null,
        filters.resource_type_id ?? null,
        filters.category ?? null,
        filters.only_in_stock ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async summary(warehouse_id?: number): Promise<InventorySummaryRow[]> {
    const result = await db.query<InventorySummaryRow>(
      'SELECT * FROM fn_inventory_summary($1)',
      [warehouse_id ?? null],
    );
    return result.rows;
  },

  async listByWarehouse(warehouse_id: number): Promise<InventoryRowEnriched[]> {
    const result = await db.query<InventoryDataRow>(
      'SELECT data FROM fn_warehouses_inventory($1)',
      [warehouse_id],
    );
    return result.rows.map((r) => r.data);
  },
};
