import type { Donation, DonationEnriched } from '../types/entities';

type AnyDonation = Donation | DonationEnriched;

export function donationView<T extends AnyDonation>(donation: T): T {
  return donation;
}

export function donationsView<T extends AnyDonation>(donations: T[]): T[] {
  return donations.map(donationView);
}
