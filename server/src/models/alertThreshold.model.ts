import { db } from '../db/client';
import type {
  AlertThreshold,
  AlertThresholdEnriched,
  InventoryAlert,
  ResourceCategory,
} from '../types/entities';

interface ThresholdDataRow {
  data: AlertThresholdEnriched;
}

export const AlertThresholdModel = {
  async list(category?: ResourceCategory): Promise<AlertThresholdEnriched[]> {
    const result = await db.query<ThresholdDataRow>(
      'SELECT data FROM fn_alert_thresholds_list($1::resource_category)',
      [category ?? null],
    );
    return result.rows.map((r) => r.data);
  },

  async set(
    resource_type_id: number,
    min_quantity: number,
    user_id: number,
  ): Promise<AlertThreshold> {
    const row = await db.queryOne<AlertThreshold>(
      'SELECT * FROM sp_alert_thresholds_set($1, $2, $3)',
      [resource_type_id, min_quantity, user_id],
    );
    if (!row) throw new Error('sp_alert_thresholds_set returned no row');
    return row;
  },

  async alerts(): Promise<InventoryAlert[]> {
    const result = await db.query<InventoryAlert>('SELECT * FROM fn_inventory_alerts()');
    return result.rows;
  },
};
