import * as donorsService from '../services/donors.service';
import * as donationsService from '../services/donations.service';
import { donorView, donorsView } from '../views/donor.view';
import { donationsView } from '../views/donation.view';
import type { DonorType } from '../types/entities';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';

export const create = asyncHandler(async (req, res) => {
  const donor = await donorsService.create(req.body);
  res.status(201).json({ success: true, data: donorView(donor) });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });
  const type = req.query.type as DonorType | undefined;
  const search = req.query.search as string | undefined;
  const is_active =
    req.query.is_active === 'true'
      ? true
      : req.query.is_active === 'false'
      ? false
      : undefined;

  const { data, total } = await donorsService.list({
    page,
    limit,
    skip,
    ...(type ? { type } : {}),
    ...(is_active !== undefined ? { is_active } : {}),
    ...(search ? { search } : {}),
  });

  res.json({
    success: true,
    data: donorsView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const donor = await donorsService.getById(id);
  res.json({ success: true, data: donorView(donor) });
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const donor = await donorsService.update(id, req.body);
  res.json({ success: true, data: donorView(donor) });
});

// Hybrid delete: hard if no donations attached, soft otherwise.
export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const donor = await donorsService.softDelete(id);
  res.json({ success: true, data: donorView(donor) });
});

// HU-20 — historical donations for a donor, ordered by date desc.
export const listDonations = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await donorsService.getById(id); // surfaces 404 if missing
  const data = await donationsService.listByDonor(id);
  res.json({ success: true, data: donationsView(data) });
});
