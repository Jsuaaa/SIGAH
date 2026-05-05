import {
  InventoryModel,
  type AdjustInventoryInput,
  type UpsertInventoryInput,
} from '../models/inventory.model';
import type {
  InventoryRow,
  InventoryRowEnriched,
  InventorySummaryRow,
  ResourceCategory,
} from '../types/entities';

export type { AdjustInventoryInput, UpsertInventoryInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  warehouse_id?: number;
  resource_type_id?: number;
  category?: ResourceCategory;
  only_in_stock?: boolean;
}

export async function upsert(input: UpsertInventoryInput): Promise<InventoryRow> {
  return InventoryModel.upsert(input);
}

export async function adjust(id: number, input: AdjustInventoryInput): Promise<InventoryRow> {
  return InventoryModel.adjust(id, input);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: InventoryRowEnriched[]; total: number }> {
  return InventoryModel.list({
    warehouse_id: filters.warehouse_id,
    resource_type_id: filters.resource_type_id,
    category: filters.category,
    only_in_stock: filters.only_in_stock,
    limit: filters.limit,
    offset: filters.skip,
  });
}

export async function summary(warehouse_id?: number): Promise<InventorySummaryRow[]> {
  return InventoryModel.summary(warehouse_id);
}

export async function listByWarehouse(warehouse_id: number): Promise<InventoryRowEnriched[]> {
  return InventoryModel.listByWarehouse(warehouse_id);
}
