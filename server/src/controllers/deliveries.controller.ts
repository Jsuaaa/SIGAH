import * as deliveriesService from '../services/deliveries.service';
import { deliveryView, deliveriesView } from '../views/delivery.view';
import type { DeliveryStatus } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { AppError } from '../utils/AppError';

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });
  const family_id = req.query.family_id ? Number(req.query.family_id) : undefined;
  const warehouse_id = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;
  const status = req.query.status as DeliveryStatus | undefined;
  const date_from = req.query.date_from as string | undefined;
  const date_to = req.query.date_to as string | undefined;

  const { data, total } = await deliveriesService.list({
    page,
    limit,
    skip,
    ...(family_id !== undefined ? { family_id } : {}),
    ...(warehouse_id !== undefined ? { warehouse_id } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(date_from !== undefined ? { date_from } : {}),
    ...(date_to !== undefined ? { date_to } : {}),
  });

  res.json({
    success: true,
    data: deliveriesView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const row = await deliveriesService.getById(id);
  res.json({ success: true, data: deliveryView(row) });
});

export const eligibility = asyncHandler(async (req, res) => {
  const family_id = Number(req.query.family_id);
  const data = await deliveriesService.checkEligibility(family_id);
  res.json({ success: true, data });
});

export const createException = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const delivery = await deliveriesService.createException(
    req.body,
    user.id,
    ip,
    userAgent,
  );
  res.status(201).json({ success: true, data: deliveryView(delivery) });
});

// Used by GET /families/:id/deliveries (mounted on the families router).
export const listByFamily = asyncHandler(async (req, res) => {
  const family_id = Number(req.params.id);
  const data = await deliveriesService.listByFamily(family_id);
  res.json({ success: true, data: deliveriesView(data) });
});

// POST /deliveries — regular delivery (#24 CA1/CA2/CA3/CA5).
// Reads optional Idempotency-Key header and passes it as client_op_id.
export const create = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  // CA5 — idempotency via header.
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined) ?? null;

  const delivery = await deliveriesService.create(
    {
      ...req.body,
      client_op_id: idempotencyKey ?? (req.body.client_op_id ?? null),
    },
    user.id,
    ip,
    userAgent,
  );
  res.status(201).json({ success: true, data: deliveryView(delivery) });
});

// PUT /deliveries/:id/status — status transition (#24 CA6).
export const updateStatus = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const id = Number(req.params.id);
  const { status } = req.body as { status: string };
  const delivery = await deliveriesService.updateStatus(
    id,
    status as import('../types/entities').DeliveryStatus,
    user.id,
  );
  res.json({ success: true, data: deliveryView(delivery) });
});

// POST /deliveries/batch — batch creation (#24 CA4).
export const createBatch = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;
  const count = Number(req.body.count);
  const result = await deliveriesService.createBatch(count, user.id, ip, userAgent);
  res.status(201).json({ success: true, data: result });
});
