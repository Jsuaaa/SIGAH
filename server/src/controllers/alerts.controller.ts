import * as alertsService from '../services/alerts.service';
import type { ResourceCategory } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const listThresholds = asyncHandler(async (req, res) => {
  const category = req.query.category as ResourceCategory | undefined;
  const data = await alertsService.listThresholds(category);
  res.json({ success: true, data });
});

export const setThreshold = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const row = await alertsService.setThreshold(
    Number(req.body.resource_type_id),
    Number(req.body.min_quantity),
    user.id,
  );
  res.status(200).json({ success: true, data: row });
});

export const inventoryAlerts = asyncHandler(async (_req, res) => {
  const data = await alertsService.inventoryAlerts();
  res.json({ success: true, data });
});
