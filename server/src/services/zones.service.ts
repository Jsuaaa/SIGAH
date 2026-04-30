import { Prisma, RiskLevel, Zone } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import prisma from '../config/prisma';
import { AppError } from '../utils/AppError';

export interface CreateZoneInput {
  name: string;
  risk_level: RiskLevel;
  latitude: number;
  longitude: number;
  estimated_population: number;
}

export type UpdateZoneInput = Partial<CreateZoneInput>;

export interface ListFilters {
  page: number;
  limit: number;
  skip: number;
  risk_level?: RiskLevel;
  search?: string;
}

export async function create(input: CreateZoneInput): Promise<Zone> {
  try {
    return await prisma.zone.create({ data: input });
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('Zone name already exists', 409);
    }
    throw err;
  }
}

export async function list(filters: ListFilters): Promise<{ data: Zone[]; total: number }> {
  const where: Prisma.ZoneWhereInput = {};

  if (filters.risk_level) {
    where.risk_level = filters.risk_level;
  }

  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const [data, total] = await prisma.$transaction([
    prisma.zone.findMany({
      where,
      skip: filters.skip,
      take: filters.limit,
      orderBy: { id: 'asc' },
    }),
    prisma.zone.count({ where }),
  ]);

  return { data, total };
}

export async function getById(id: number): Promise<Zone> {
  const zone = await prisma.zone.findUnique({ where: { id } });
  if (!zone) {
    throw new AppError('Zone not found', 404);
  }
  return zone;
}

export async function update(id: number, input: UpdateZoneInput): Promise<Zone> {
  await assertExists(id);
  try {
    return await prisma.zone.update({ where: { id }, data: input });
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('Zone name already exists', 409);
    }
    throw err;
  }
}

export async function remove(id: number): Promise<void> {
  await assertExists(id);
  // audit:#28
  await prisma.zone.delete({ where: { id } });
}

export async function assertExists(id: number): Promise<void> {
  const zone = await prisma.zone.findUnique({ where: { id } });
  if (!zone) {
    throw new AppError('Zone not found', 404);
  }
}
