import * as distributionPlansService from '../services/distributionPlans.service';
import {
  distributionPlanView,
  distributionPlanWithItemsView,
  distributionPlansView,
} from '../views/distributionPlan.view';
import type { DistributionPlanScope, DistributionPlanStatus } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { AppError } from '../utils/AppError';

/** POST /distribution-plans — crea plan priorizado (HU-21 CA1..CA5). */
export const create = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);

  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const plan = await distributionPlansService.create(
    req.body,
    user.id,
    ip,
    userAgent,
  );
  res.status(201).json({ success: true, data: distributionPlanView(plan) });
});

/** GET /distribution-plans — lista con filtros y paginación. */
export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });

  const status = req.query.status as DistributionPlanStatus | undefined;
  const scope = req.query.scope as DistributionPlanScope | undefined;
  const created_by = req.query.created_by ? Number(req.query.created_by) : undefined;

  const { data, total } = await distributionPlansService.list({
    page,
    limit,
    skip,
    ...(status !== undefined ? { status } : {}),
    ...(scope !== undefined ? { scope } : {}),
    ...(created_by !== undefined ? { created_by } : {}),
  });

  res.json({
    success: true,
    data: distributionPlansView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** GET /distribution-plans/:id — detalle con items. */
export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const plan = await distributionPlansService.getById(id);
  res.json({ success: true, data: distributionPlanWithItemsView(plan) });
});

/** PUT /distribution-plans/:id/cancel — cancela el plan. */
export const cancel = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);

  const id = Number(req.params.id);
  const plan = await distributionPlansService.cancel(id, user.id);
  res.json({ success: true, data: distributionPlanView(plan) });
});

/** POST /distribution-plans/:id/execute — materializa entregas. */
export const execute = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);

  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;
  const id = Number(req.params.id);

  const plan = await distributionPlansService.execute(id, user.id, ip, userAgent);
  res.json({ success: true, data: distributionPlanView(plan) });
});
