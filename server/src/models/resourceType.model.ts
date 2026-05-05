import { db } from '../db/client';
import type { ResourceCategory, ResourceType } from '../types/entities';

export interface CreateResourceTypeInput {
  name: string;
  category: ResourceCategory;
  unit_of_measure: string;
  unit_weight_kg: number;
}

export interface UpdateResourceTypeInput {
  name?: string;
  category?: ResourceCategory;
  unit_of_measure?: string;
  unit_weight_kg?: number;
  is_active?: boolean;
}

export interface ListResourceTypeFilters {
  category?: ResourceCategory;
  is_active?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

interface ResourceTypeListRow {
  data: ResourceType[];
  total: string;
}

export const ResourceTypeModel = {
  async create(input: CreateResourceTypeInput): Promise<ResourceType> {
    const row = await db.queryOne<ResourceType>(
      'SELECT * FROM fn_resource_types_create($1, $2::resource_category, $3, $4)',
      [input.name, input.category, input.unit_of_measure, input.unit_weight_kg],
    );
    if (!row) throw new Error('fn_resource_types_create returned no row');
    return row;
  },

  async findById(id: number): Promise<ResourceType | null> {
    return db.queryOne<ResourceType>(
      'SELECT * FROM fn_resource_types_find_by_id($1)',
      [id],
    );
  },

  async list(
    filters: ListResourceTypeFilters,
  ): Promise<{ data: ResourceType[]; total: number }> {
    const row = await db.queryOne<ResourceTypeListRow>(
      'SELECT * FROM fn_resource_types_list($1::resource_category, $2, $3, $4, $5)',
      [
        filters.category ?? null,
        filters.is_active ?? null,
        filters.search ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    if (!row) return { data: [], total: 0 };
    return { data: row.data ?? [], total: Number(row.total) };
  },

  async update(id: number, input: UpdateResourceTypeInput): Promise<ResourceType> {
    const row = await db.queryOne<ResourceType>(
      'SELECT * FROM fn_resource_types_update($1, $2, $3::resource_category, $4, $5, $6)',
      [
        id,
        input.name ?? null,
        input.category ?? null,
        input.unit_of_measure ?? null,
        input.unit_weight_kg ?? null,
        input.is_active ?? null,
      ],
    );
    if (!row) throw new Error('fn_resource_types_update returned no row');
    return row;
  },

  async deactivate(id: number): Promise<ResourceType> {
    const row = await db.queryOne<ResourceType>(
      'SELECT * FROM sp_resource_types_deactivate($1)',
      [id],
    );
    if (!row) throw new Error('sp_resource_types_deactivate returned no row');
    return row;
  },
};
