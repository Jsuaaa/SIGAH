import { RiskLevel } from '@prisma/client';
import * as zonesService from '../services/zones.service';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';

export const create = asyncHandler(async (req, res) => {
  const zone = await zonesService.create(req.body);
  res.status(201).json({ success: true, data: zone });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, take, page, limit } = parsePagination(
    req.query as { page?: string; limit?: string },
  );

  const risk_level = req.query.risk_level as RiskLevel | undefined;
  const search = req.query.search as string | undefined;

  const { data, total } = await zonesService.list({
    page,
    limit,
    skip,
    ...(risk_level ? { risk_level } : {}),
    ...(search ? { search } : {}),
  });

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const zone = await zonesService.getById(id);
  res.json({ success: true, data: zone });
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const zone = await zonesService.update(id, req.body);
  res.json({ success: true, data: zone });
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await zonesService.remove(id);
  res.status(204).send();
});

// Nested stubs — real queries will be wired in their respective issues

export const listFamiliesByZone = asyncHandler(async (req, res) => {
  // TODO(#12): replace with prisma.family.findMany({ where: { zone_id: id } })
  // once the Family model exists.
  const id = Number(req.params.id);
  await zonesService.assertExists(id);
  res.json({ success: true, data: [] });
});

export const listSheltersByZone = asyncHandler(async (req, res) => {
  // TODO(#11): replace with prisma.shelter.findMany({ where: { zone_id: id } })
  // once the Shelter model exists.
  const id = Number(req.params.id);
  await zonesService.assertExists(id);
  res.json({ success: true, data: [] });
});

export const listWarehousesByZone = asyncHandler(async (req, res) => {
  // TODO(#15): replace with prisma.warehouse.findMany({ where: { zone_id: id } })
  // once the Warehouse model exists.
  const id = Number(req.params.id);
  await zonesService.assertExists(id);
  res.json({ success: true, data: [] });
});
