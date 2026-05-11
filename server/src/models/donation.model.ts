import { db } from '../db/client';
import type {
  Donation,
  DonationDetailInput,
  DonationEnriched,
  DonationType,
} from '../types/entities';

export interface CreateDonationInput {
  donor_id: number;
  destination_warehouse_id?: number | null;
  donation_type: DonationType;
  monetary_amount?: number | string | null;
  date?: string | null;
  notes?: string | null;
  details?: DonationDetailInput[];
}

export interface ListDonationFilters {
  donor_id?: number;
  warehouse_id?: number;
  type?: DonationType;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
}

interface DonationListRow {
  data: DonationEnriched[];
  total: string;
}

interface DonationDataRow {
  data: DonationEnriched;
}

export const DonationModel = {
  async create(
    input: CreateDonationInput,
    user_id: number,
    ip: string | null,
    user_agent: string | null,
  ): Promise<Donation> {
    const donationJson = {
      donor_id: input.donor_id,
      destination_warehouse_id: input.destination_warehouse_id ?? null,
      donation_type: input.donation_type,
      monetary_amount: input.monetary_amount ?? null,
      date: input.date ?? null,
      notes: input.notes ?? null,
    };
    const detailsJson = input.details ?? [];

    const row = await db.queryOne<Donation>(
      'SELECT * FROM sp_donations_create($1::jsonb, $2::jsonb, $3, $4::inet, $5)',
      [
        JSON.stringify(donationJson),
        JSON.stringify(detailsJson),
        user_id,
        ip,
        user_agent,
      ],
    );
    if (!row) throw new Error('sp_donations_create returned no row');
    return row;
  },

  async findById(id: number): Promise<DonationEnriched | null> {
    const row = await db.queryOne<DonationDataRow>(
      'SELECT data FROM fn_donations_find_by_id($1)',
      [id],
    );
    return row?.data ?? null;
  },

  async list(
    filters: ListDonationFilters,
  ): Promise<{ data: DonationEnriched[]; total: number }> {
    const row = await db.queryOne<DonationListRow>(
      'SELECT * FROM fn_donations_list($1, $2, $3::donation_type, $4::timestamptz, $5::timestamptz, $6, $7)',
      [
        filters.donor_id ?? null,
        filters.warehouse_id ?? null,
        filters.type ?? null,
        filters.date_from ?? null,
        filters.date_to ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async listByDonor(donor_id: number): Promise<DonationEnriched[]> {
    const result = await db.query<DonationDataRow>(
      'SELECT data FROM fn_donations_by_donor($1)',
      [donor_id],
    );
    return result.rows.map((r) => r.data);
  },
};
