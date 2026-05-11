import type { Donor } from '../types/entities';

export function donorView(donor: Donor): Donor {
  return donor;
}

export function donorsView(donors: Donor[]): Donor[] {
  return donors.map(donorView);
}
