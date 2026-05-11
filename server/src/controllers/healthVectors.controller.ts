import * as healthVectorsService from '../services/healthVectors.service';
import { healthVectorView, healthVectorsView } from '../views/healthVector.view';
import type { HealthVectorStatus, RiskLevel, VectorType } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { AppError } from '../utils/AppError';

export const create = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const hv = await healthVectorsService.create(req.body, user.id, ip, userAgent);
  res.status(201).json({ success: true, data: healthVectorView(hv) });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });

  const zone_id    = req.query.zone_id    ? Number(req.query.zone_id)    : undefined;
  const shelter_id = req.query.shelter_id ? Number(req.query.shelter_id) : undefined;
  const risk_level  = req.query.risk_level  as RiskLevel | undefined;
  const vector_type = req.query.vector_type as VectorType | undefined;
  const status      = req.query.status      as HealthVectorStatus | undefined;

  const { data, total } = await healthVectorsService.list({
    page,
    limit,
    skip,
    ...(zone_id    !== undefined ? { zone_id }    : {}),
    ...(shelter_id !== undefined ? { shelter_id } : {}),
    ...(risk_level  ? { risk_level }  : {}),
    ...(vector_type ? { vector_type } : {}),
    ...(status      ? { status }      : {}),
  });

  res.json({
    success: true,
    data: healthVectorsView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const hv = await healthVectorsService.getById(id);
  res.json({ success: true, data: healthVectorView(hv) });
});

export const update = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const id = Number(req.params.id);
  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const hv = await healthVectorsService.update(id, req.body, user.id, ip, userAgent);
  res.json({ success: true, data: healthVectorView(hv) });
});

export const setStatus = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const id = Number(req.params.id);
  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const { status, actions_taken } = req.body as {
    status: HealthVectorStatus;
    actions_taken?: string | null;
  };

  const hv = await healthVectorsService.setStatus(
    id,
    status,
    actions_taken ?? null,
    user.id,
    ip,
    userAgent,
  );
  res.json({ success: true, data: healthVectorView(hv) });
});

export const remove = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const id = Number(req.params.id);

  await healthVectorsService.remove(id, user.id);
  res.status(204).end();
});
