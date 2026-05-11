import {
  DonationModel,
  type CreateDonationInput,
  type ListDonationFilters,
} from '../models/donation.model';
import type { Donation, DonationEnriched, DonationType } from '../types/entities';
import { AppError } from '../utils/AppError';

export type { CreateDonationInput };

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  donor_id?: number;
  warehouse_id?: number;
  type?: DonationType;
  date_from?: string;
  date_to?: string;
}

export async function create(
  input: CreateDonationInput,
  user_id: number,
  ip: string | null,
  user_agent: string | null,
): Promise<Donation> {
  return DonationModel.create(input, user_id, ip, user_agent);
}

export async function list(
  filters: ListFilters,
): Promise<{ data: DonationEnriched[]; total: number }> {
  const modelFilters: ListDonationFilters = {
    limit: filters.limit,
    offset: filters.skip,
    ...(filters.donor_id !== undefined ? { donor_id: filters.donor_id } : {}),
    ...(filters.warehouse_id !== undefined ? { warehouse_id: filters.warehouse_id } : {}),
    ...(filters.type !== undefined ? { type: filters.type } : {}),
    ...(filters.date_from !== undefined ? { date_from: filters.date_from } : {}),
    ...(filters.date_to !== undefined ? { date_to: filters.date_to } : {}),
  };
  return DonationModel.list(modelFilters);
}

export async function getById(id: number): Promise<DonationEnriched> {
  const row = await DonationModel.findById(id);
  if (!row) throw new AppError('Donation not found', 404);
  return row;
}

export async function listByDonor(donor_id: number): Promise<DonationEnriched[]> {
  return DonationModel.listByDonor(donor_id);
}
