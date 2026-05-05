// Shelters have no sensitive fields; the view is currently a passthrough but
// the indirection is kept so future fields only affect this file.

import type { Shelter, ShelterWithOccupancy } from '../types/entities';

export function shelterView<T extends Shelter | ShelterWithOccupancy>(shelter: T): T {
  return shelter;
}

export function sheltersView<T extends Shelter | ShelterWithOccupancy>(shelters: T[]): T[] {
  return shelters.map(shelterView);
}
