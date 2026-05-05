import * as sheltersService from '../services/shelters.service';
import { shelterView, sheltersView } from '../views/shelter.view';
import type { ShelterType } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';

export const create = asyncHandler(async (req, res) => {
  const shelter = await sheltersService.create(req.body);
  res.status(201).json({ success: true, data: shelterView(shelter) });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(
    req.query as { page?: string; limit?: string },
  );

  const zone_id_raw = req.query.zone_id as string | undefined;
  const zone_id = zone_id_raw ? Number(zone_id_raw) : undefined;
  const type = req.query.type as ShelterType | undefined;
  const search = req.query.search as string | undefined;

  const { data, total } = await sheltersService.list({
    page,
    limit,
    skip,
    ...(zone_id ? { zone_id } : {}),
    ...(type ? { type } : {}),
    ...(search ? { search } : {}),
  });

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: sheltersView(data),
    pagination: { page, limit, total, totalPages },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const shelter = await sheltersService.getById(id);
  res.json({ success: true, data: shelterView(shelter) });
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const shelter = await sheltersService.update(id, req.body);
  res.json({ success: true, data: shelterView(shelter) });
});

export const setOccupancy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const occupancy = Number(req.body.current_occupancy);
  const shelter = await sheltersService.setOccupancy(id, occupancy);
  res.json({ success: true, data: shelterView(shelter) });
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await sheltersService.remove(id);
  res.status(204).send();
});
