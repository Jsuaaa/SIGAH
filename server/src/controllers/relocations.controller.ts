import * as relocationsService from '../services/relocations.service';
import { relocationView, relocationsView } from '../views/relocation.view';
import type { RelocationType } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { AppError } from '../utils/AppError';

// GET /api/v1/relocations — listado paginado con filtros (HU-24 CA4)
export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });
  const family_id = req.query.family_id ? Number(req.query.family_id) : undefined;
  const shelter_id = req.query.shelter_id ? Number(req.query.shelter_id) : undefined;
  const type = req.query.type as RelocationType | undefined;
  const date_from = req.query.date_from as string | undefined;
  const date_to = req.query.date_to as string | undefined;

  const { data, total } = await relocationsService.list({
    page,
    limit,
    skip,
    ...(family_id !== undefined ? { family_id } : {}),
    ...(shelter_id !== undefined ? { shelter_id } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(date_from !== undefined ? { date_from } : {}),
    ...(date_to !== undefined ? { date_to } : {}),
  });

  res.json({
    success: true,
    data: relocationsView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// GET /api/v1/relocations/:id
export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const row = await relocationsService.getById(id);
  res.json({ success: true, data: relocationView(row) });
});

// POST /api/v1/relocations — aplica traslado atómico (HU-24 CA1/CA2/CA3)
export const apply = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const relocation = await relocationsService.apply(
    {
      family_id: req.body.family_id,
      destination_shelter_id: req.body.destination_shelter_id,
      type: req.body.type,
      reason: req.body.reason,
      notes: req.body.notes ?? null,
    },
    user.id,
    ip,
    userAgent,
  );

  res.status(201).json({ success: true, data: relocationView(relocation) });
});
