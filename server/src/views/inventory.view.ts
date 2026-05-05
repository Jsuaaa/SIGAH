import type {
  InventoryRow,
  InventoryRowEnriched,
  InventorySummaryRow,
  ResourceType,
} from '../types/entities';

export function resourceTypeView(row: ResourceType): ResourceType {
  return row;
}

export function resourceTypesView(rows: ResourceType[]): ResourceType[] {
  return rows.map(resourceTypeView);
}

export function inventoryView<T extends InventoryRow | InventoryRowEnriched>(row: T): T {
  return row;
}

export function inventoryListView<T extends InventoryRow | InventoryRowEnriched>(rows: T[]): T[] {
  return rows.map(inventoryView);
}

export function inventorySummaryView(rows: InventorySummaryRow[]): InventorySummaryRow[] {
  // pg returns BIGINT as string; surface it as number for consumers.
  return rows.map((r) => ({
    ...r,
    total_quantity: r.total_quantity, // keep as string per pg convention
  }));
}
