import * as donationsService from '../services/donations.service';
import { donationView, donationsView } from '../views/donation.view';
import type { DonationType } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { AppError } from '../utils/AppError';

export const create = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);

  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const donation = await donationsService.create(req.body, user.id, ip, userAgent);
  res.status(201).json({ success: true, data: donationView(donation) });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });

  const donor_id = req.query.donor_id ? Number(req.query.donor_id) : undefined;
  const warehouse_id = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;
  const type = req.query.type as DonationType | undefined;
  const date_from = req.query.date_from as string | undefined;
  const date_to = req.query.date_to as string | undefined;

  const { data, total } = await donationsService.list({
    page,
    limit,
    skip,
    ...(donor_id !== undefined ? { donor_id } : {}),
    ...(warehouse_id !== undefined ? { warehouse_id } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(date_from !== undefined ? { date_from } : {}),
    ...(date_to !== undefined ? { date_to } : {}),
  });

  res.json({
    success: true,
    data: donationsView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const donation = await donationsService.getById(id);
  res.json({ success: true, data: donationView(donation) });
});

export const listByDonor = asyncHandler(async (req, res) => {
  const donor_id = Number(req.params.id);
  const data = await donationsService.listByDonor(donor_id);
  res.json({ success: true, data: donationsView(data) });
});
