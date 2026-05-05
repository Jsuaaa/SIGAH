import type {
  Warehouse,
  WarehouseWithDistance,
  WarehouseWithOccupancy,
} from '../types/entities';

type AnyWarehouse = Warehouse | WarehouseWithOccupancy | WarehouseWithDistance;

export function warehouseView<T extends AnyWarehouse>(warehouse: T): T {
  return warehouse;
}

export function warehousesView<T extends AnyWarehouse>(warehouses: T[]): T[] {
  return warehouses.map(warehouseView);
}
