import { db } from '../db/client';
import type { Donor, DonorType } from '../types/entities';

export interface CreateDonorInput {
  name: string;
  type: DonorType;
  contact: string;
  tax_id?: string | null;
}

export interface UpdateDonorInput {
  name?: string;
  type?: DonorType;
  contact?: string;
  tax_id?: string | null;
  is_active?: boolean;
}

export interface ListDonorFilters {
  type?: DonorType;
  is_active?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

interface DonorListRow {
  data: Donor[];
  total: string;
}

export const DonorModel = {
  async create(input: CreateDonorInput): Promise<Donor> {
    const row = await db.queryOne<Donor>(
      'SELECT * FROM fn_donors_create($1, $2::donor_type, $3, $4)',
      [input.name, input.type, input.contact, input.tax_id ?? null],
    );
    if (!row) throw new Error('fn_donors_create returned no row');
    return row;
  },

  async findById(id: number): Promise<Donor | null> {
    return db.queryOne<Donor>('SELECT * FROM fn_donors_find_by_id($1)', [id]);
  },

  async list(filters: ListDonorFilters): Promise<{ data: Donor[]; total: number }> {
    const row = await db.queryOne<DonorListRow>(
      'SELECT * FROM fn_donors_list($1::donor_type, $2, $3, $4, $5)',
      [
        filters.type ?? null,
        filters.is_active ?? null,
        filters.search ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async update(id: number, input: UpdateDonorInput): Promise<Donor> {
    const row = await db.queryOne<Donor>(
      'SELECT * FROM sp_donors_update($1, $2, $3::donor_type, $4, $5, $6)',
      [
        id,
        input.name ?? null,
        input.type ?? null,
        input.contact ?? null,
        input.tax_id ?? null,
        input.is_active ?? null,
      ],
    );
    if (!row) throw new Error('sp_donors_update returned no row');
    return row;
  },

  async softDelete(id: number): Promise<Donor> {
    const row = await db.queryOne<Donor>(
      'SELECT * FROM sp_donors_soft_delete($1)',
      [id],
    );
    if (!row) throw new Error('sp_donors_soft_delete returned no row');
    return row;
  },
};
