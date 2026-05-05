import * as warehousesService from '../services/warehouses.service';
import * as inventoryService from '../services/inventory.service';
import { warehouseView, warehousesView } from '../views/warehouse.view';
import { inventoryListView } from '../views/inventory.view';
import type { WarehouseStatus } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';

export const create = asyncHandler(async (req, res) => {
  const warehouse = await warehousesService.create(req.body);
  res.status(201).json({ success: true, data: warehouseView(warehouse) });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(
    req.query as { page?: string; limit?: string },
  );

  const zone_id = req.query.zone_id ? Number(req.query.zone_id) : undefined;
  const status = req.query.status as WarehouseStatus | undefined;
  const search = req.query.search as string | undefined;

  const { data, total } = await warehousesService.list({
    page,
    limit,
    skip,
    ...(zone_id ? { zone_id } : {}),
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
  });

  res.json({
    success: true,
    data: warehousesView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const warehouse = await warehousesService.getById(id);
  res.json({ success: true, data: warehouseView(warehouse) });
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const warehouse = await warehousesService.update(id, req.body);
  res.json({ success: true, data: warehouseView(warehouse) });
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await warehousesService.remove(id);
  res.status(204).send();
});

export const inventory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  // assertExists by hitting findById; surfaces 404 for missing warehouse
  await warehousesService.getById(id);
  const rows = await inventoryService.listByWarehouse(id);
  res.json({ success: true, data: inventoryListView(rows) });
});

export const nearest = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const data = await warehousesService.nearest(lat, lng, limit);
  res.json({ success: true, data: warehousesView(data) });
});
