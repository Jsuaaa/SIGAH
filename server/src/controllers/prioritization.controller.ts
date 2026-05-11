import * as service from '../services/prioritization.service';
import type { FamilyStatus } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';

export const ranking = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });
  const zone_id = req.query.zone_id ? Number(req.query.zone_id) : undefined;
  const status = req.query.status as FamilyStatus | undefined;

  const { data, total } = await service.ranking({
    page,
    limit,
    skip,
    ...(zone_id !== undefined ? { zone_id } : {}),
    ...(status !== undefined ? { status } : {}),
  });

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const recalculate = asyncHandler(async (_req, res) => {
  const count = await service.recalculateAll();
  res.json({ success: true, data: { recalculated: count } });
});

export const nextBatch = asyncHandler(async (req, res) => {
  const count = req.query.count ? Number(req.query.count) : 10;
  const data = await service.nextBatch(count);
  res.json({ success: true, data });
});
