import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { briefUserView, type BriefUser } from '../views/user.view';
import type { Role } from '../types/entities';
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

export async function register({
  email,
  password,
  role,
}: RegisterInput): Promise<BriefUser> {
  const password_hash = await bcrypt.hash(password, 10);
  // fn_users_create raises SH409 on duplicate email; mapped to AppError(409)
  // by the db client.
  const user = await UserModel.create({ email, password_hash, role });
  return briefUserView(user);
}

export async function login({ email, password }: LoginInput): Promise<{ token: string }> {
  const user = await UserModel.findByEmail(email);
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

export async function getProfile(userId: number): Promise<BriefUser> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return briefUserView(user, true);
}

export async function changePassword(
  userId: number,
  { oldPassword, newPassword }: ChangePasswordInput,
): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) {
    throw new AppError('Current password is incorrect', 401);
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await UserModel.changePassword(userId, password_hash);
}
