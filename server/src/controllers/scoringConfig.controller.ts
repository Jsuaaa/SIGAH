import * as service from '../services/scoringConfig.service';
import type { ScoringConfigKey } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const list = asyncHandler(async (_req, res) => {
  const rows = await service.getAll();
  res.json({ success: true, data: rows });
});

export const set = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);
  const row = await service.set(
    req.body.key as ScoringConfigKey,
    Number(req.body.value),
    user.id,
  );
  res.json({ success: true, data: row });
});
