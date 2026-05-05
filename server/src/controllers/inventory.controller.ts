import * as service from '../services/inventory.service';
import {
  inventoryView,
  inventoryListView,
  inventorySummaryView,
} from '../views/inventory.view';
import type { ResourceCategory } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { AppError } from '../utils/AppError';

export const upsert = asyncHandler(async (req, res) => {
  const row = await service.upsert(req.body);
  res.status(201).json({ success: true, data: inventoryView(row) });
});

export const adjust = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const id = Number(req.params.id);
  const row = await service.adjust(id, { ...req.body, user_id: user.id });
  res.json({ success: true, data: inventoryView(row) });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });

  const warehouse_id = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;
  const resource_type_id = req.query.resource_type_id ? Number(req.query.resource_type_id) : undefined;
  const category = req.query.category as ResourceCategory | undefined;
  const only_in_stock = req.query.only_in_stock === 'true' ? true : undefined;

  const { data, total } = await service.list({
    page,
    limit,
    skip,
    ...(warehouse_id ? { warehouse_id } : {}),
    ...(resource_type_id ? { resource_type_id } : {}),
    ...(category ? { category } : {}),
    ...(only_in_stock !== undefined ? { only_in_stock } : {}),
  });

  res.json({
    success: true,
    data: inventoryListView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const summary = asyncHandler(async (req, res) => {
  const warehouse_id = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;
  const rows = await service.summary(warehouse_id);
  res.json({ success: true, data: inventorySummaryView(rows) });
});

export const listByWarehouse = asyncHandler(async (req, res) => {
  const warehouse_id = Number(req.params.id);
  const rows = await service.listByWarehouse(warehouse_id);
  res.json({ success: true, data: inventoryListView(rows) });
});
