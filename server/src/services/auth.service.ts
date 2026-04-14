import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { JWT_SECRET } from '../config/env';
import { JWT_EXPIRATION } from '../config/constants';
import { AppError } from '../utils/AppError';

interface RegisterInput {
  email: string;
  password: string;
  role: Role;
}

interface LoginInput {
  email: string;
  password: string;
}

interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

export async function register({ email, password, role }: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const password_hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, password_hash, role },
    select: { id: true, email: true, role: true, created_at: true },
  });

  return user;
}

export async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid credentials', 401);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION },
  );

  return { token };
}

export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, created_at: true, updated_at: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
}

export async function changePassword(userId: number, { oldPassword, newPassword }: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) {
    throw new AppError('Current password is incorrect', 401);
  }

  const password_hash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password_hash },
  });
}
