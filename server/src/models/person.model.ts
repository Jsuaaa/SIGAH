// Data-access layer for the `persons` table. Each method wraps a single SP.
// Aggregate counts on `families` are kept in sync inside the SPs themselves.

import { db } from '../db/client';
import type {
  Gender,
  Person,
  PersonWithFamily,
  Relationship,
  SpecialCondition,
} from '../types/entities';

export interface CreatePersonInput {
  family_id: number;
  name: string;
  document: string;
  birth_date: string;
  gender: Gender;
  relationship: Relationship;
  special_conditions?: SpecialCondition[];
  requires_medication?: boolean;
}

export interface UpdatePersonInput {
  family_id?: number;
  name?: string;
  document?: string;
  birth_date?: string;
  gender?: Gender;
  relationship?: Relationship;
  special_conditions?: SpecialCondition[];
  requires_medication?: boolean;
}

export const PersonModel = {
  async create(input: CreatePersonInput): Promise<Person> {
    const row = await db.queryOne<Person>(
      `SELECT * FROM sp_persons_create($1, $2, $3, $4::date, $5::gender, $6::relationship, $7::text[], $8)`,
      [
        input.family_id,
        input.name,
        input.document,
        input.birth_date,
        input.gender,
        input.relationship,
        input.special_conditions ?? [],
        input.requires_medication ?? false,
      ],
    );
    if (!row) throw new Error('sp_persons_create returned no row');
    return row;
  },

  async update(id: number, input: UpdatePersonInput): Promise<Person> {
    const row = await db.queryOne<Person>(
      `SELECT * FROM sp_persons_update($1, $2, $3, $4, $5::date, $6::gender, $7::relationship, $8::text[], $9)`,
      [
        id,
        input.family_id ?? null,
        input.name ?? null,
        input.document ?? null,
        input.birth_date ?? null,
        input.gender ?? null,
        input.relationship ?? null,
        input.special_conditions ?? null,
        input.requires_medication ?? null,
      ],
    );
    if (!row) throw new Error('sp_persons_update returned no row');
    return row;
  },

  async remove(id: number): Promise<void> {
    await db.query('SELECT sp_persons_delete($1)', [id]);
  },

  async listByFamily(family_id: number): Promise<Person[]> {
    const result = await db.query<Person>(
      'SELECT * FROM fn_persons_list_by_family($1)',
      [family_id],
    );
    return result.rows;
  },

  async findByDocument(document: string): Promise<PersonWithFamily | null> {
    return db.queryOne<PersonWithFamily>(
      'SELECT * FROM fn_persons_find_by_document($1)',
      [document],
    );
  },
};
