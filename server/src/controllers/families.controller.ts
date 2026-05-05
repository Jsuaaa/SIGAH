import * as familiesService from '../services/families.service';
import * as personsService from '../services/persons.service';
import { familyView, familiesView } from '../views/family.view';
import { personsView } from '../views/person.view';
import type { FamilyStatus } from '../types/entities';
import type { FamilyOrderBy } from '../models/family.model';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { AppError } from '../utils/AppError';

export const create = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) throw new AppError('Authentication required', 401);

  const ip = req.ip ?? null;
  const userAgent = req.headers['user-agent'] ?? null;

  const family = await familiesService.create(req.body, user.id, ip, userAgent);
  res.status(201).json({ success: true, data: familyView(family) });
});

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(
    req.query as { page?: string; limit?: string },
  );

  const zone_id = req.query.zone_id ? Number(req.query.zone_id) : undefined;
  const shelter_id = req.query.shelter_id ? Number(req.query.shelter_id) : undefined;
  const status = req.query.status as FamilyStatus | undefined;
  const order_by = req.query.order_by as FamilyOrderBy | undefined;

  const { data, total } = await familiesService.list({
    page,
    limit,
    skip,
    ...(zone_id ? { zone_id } : {}),
    ...(shelter_id ? { shelter_id } : {}),
    ...(status ? { status } : {}),
    ...(order_by ? { order_by } : {}),
  });

  res.json({
    success: true,
    data: familiesView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const search = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(
    req.query as { page?: string; limit?: string },
  );
  const q = (req.query.q as string).trim();

  const { data, total } = await familiesService.search({ page, limit, skip, query: q });

  res.json({
    success: true,
    data: familiesView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const getById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const family = await familiesService.getById(id);
  res.json({ success: true, data: familyView(family) });
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const family = await familiesService.update(id, req.body);
  res.json({ success: true, data: familyView(family) });
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await familiesService.remove(id);
  res.status(204).send();
});

export const getEligibility = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const eligibility = await familiesService.getEligibility(id);
  res.json({ success: true, data: eligibility });
});

export const listPersons = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const persons = await personsService.listByFamily(id);
  res.json({ success: true, data: personsView(persons) });
});
