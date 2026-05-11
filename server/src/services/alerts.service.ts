import { AlertThresholdModel } from '../models/alertThreshold.model';
import type {
  AlertThreshold,
  AlertThresholdEnriched,
  InventoryAlert,
  ResourceCategory,
} from '../types/entities';

export async function listThresholds(
  category?: ResourceCategory,
): Promise<AlertThresholdEnriched[]> {
  return AlertThresholdModel.list(category);
}

export async function setThreshold(
  resource_type_id: number,
  min_quantity: number,
  user_id: number,
): Promise<AlertThreshold> {
  return AlertThresholdModel.set(resource_type_id, min_quantity, user_id);
}

export async function inventoryAlerts(): Promise<InventoryAlert[]> {
  return AlertThresholdModel.alerts();
}
