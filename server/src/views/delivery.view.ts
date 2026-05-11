import type { Delivery, DeliveryEnriched } from '../types/entities';

type AnyDelivery = Delivery | DeliveryEnriched;

export function deliveryView<T extends AnyDelivery>(d: T): T {
  return d;
}

export function deliveriesView<T extends AnyDelivery>(rows: T[]): T[] {
  return rows.map(deliveryView);
}
