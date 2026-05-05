import * as service from '../services/resourceTypes.service';
import { resourceTypeView, resourceTypesView } from '../views/inventory.view';
import type { ResourceCategory } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';

export const create = asyncHandler(async (req, res) => {
  const row = await service.create(req.body);
  res.status(201).json({ success: true, data: resourceTypeView(row) });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });
  const category = req.query.category as ResourceCategory | undefined;
  const search = req.query.search as string | undefined;
  const is_active =
    req.query.is_active === 'true'
      ? true
      : req.query.is_active === 'false'
      ? false
      : undefined;

  const { data, total } = await service.list({
    page,
    limit,
    skip,
    ...(category ? { category } : {}),
    ...(is_active !== undefined ? { is_active } : {}),
    ...(search ? { search } : {}),
  });

  res.json({
    success: true,
    data: resourceTypesView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const row = await service.getById(id);
  res.json({ success: true, data: resourceTypeView(row) });
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const row = await service.update(id, req.body);
  res.json({ success: true, data: resourceTypeView(row) });
});

// Soft-delete: keeps historical references valid (HU-14 CA4).
export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const row = await service.deactivate(id);
  res.json({ success: true, data: resourceTypeView(row) });
});
