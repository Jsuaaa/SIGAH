// auth.service.ts — Lógica de negocio del módulo Auth.
// La mayor parte de las reglas (lockout, counters, is_active) reside en el SP
// sp_auth_login. Este service orquesta bcrypt, JWT y delega al SP.

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { briefUserView, userView, type BriefUser, type PublicUser } from '../views/user.view';
import type { Role } from '../types/entities';
import { ROLES } from '../types/entities';
import { JWT_SECRET } from '../config/env';
import { JWT_EXPIRATION } from '../config/constants';
import { AppError } from '../utils/AppError';

interface RegisterInput {
  email: string;
  password: string;
  role: Role;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

// -----------------------------------------------------------------------
// register — HU-01 CA1..CA5
// -----------------------------------------------------------------------
export async function register({
  email,
  password,
  role,
  name,
}: RegisterInput): Promise<BriefUser> {
  // RF-01: rol debe pertenecer al enum de 6 valores del PDF
  if (!ROLES.includes(role)) {
    throw new AppError(`Invalid role: ${role}`, 422);
  }

  const password_hash = await bcrypt.hash(password, 10);
  // fn_users_create lanza SH409 en email duplicado; seteará password_must_change=true
  const user = await UserModel.create({ email, password_hash, role, name });
  return briefUserView(user);
}

// -----------------------------------------------------------------------
// login — HU-03 CA1..CA5 (lockout, is_active, last_login_at)
// -----------------------------------------------------------------------
export async function login({ email, password }: LoginInput): Promise<{ token: string }> {
  // Paso 1: buscar el usuario para poder comparar el hash
  const user = await UserModel.findByEmail(email);
  if (!user) {
    // Anti-enumeración: mismo mensaje que credenciales incorrectas
    throw new AppError('Invalid credentials', 401);
  }

  // Paso 2: comparar la contraseña en Node (bcrypt)
  const valid = await bcrypt.compare(password, user.password_hash);

  // Paso 3: delegar el manejo de counters/lockout al SP
  // El SP puede lanzar SH401, SH403 (is_active=false) o SH423 (locked).
  // mapPgError en db/client.ts convierte SHxxx → AppError con el status HTTP.
  const updatedUser = await UserModel.login(email, valid, new Date());

  if (!updatedUser) {
    // No debería llegar aquí (el SP siempre lanza o retorna fila), pero TypeScript
    throw new AppError('Invalid credentials', 401);
  }

  const token = jwt.sign(
    { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role, name: updatedUser.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION },
  );

  return { token };
}

// -----------------------------------------------------------------------
// getProfile
// -----------------------------------------------------------------------
export async function getProfile(userId: number): Promise<BriefUser> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return briefUserView(user, true);
}

// -----------------------------------------------------------------------
// changePassword — HU-03 CA4 (password_must_change=false tras éxito)
// -----------------------------------------------------------------------
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
  // sp_users_change_password seteará password_must_change=false
  await UserModel.changePassword(userId, password_hash);
}

// -----------------------------------------------------------------------
// resetPassword — ADMIN: genera contraseña temporal, la devuelve en texto
//                plano una sola vez (HU-01 CA5, ADMIN endpoint)
// -----------------------------------------------------------------------
export async function resetPassword(
  userId: number,
  adminId: number,
): Promise<{ temporary_password: string }> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Generar contraseña temporal aleatoria de 12 caracteres hex (= 24 hex chars)
  const temporary_password = crypto.randomBytes(12).toString('hex');
  const new_hash = await bcrypt.hash(temporary_password, 10);

  // sp_users_reset_password seteará password_must_change=true
  await UserModel.resetPassword(userId, new_hash, adminId);

  return { temporary_password };
}

// -----------------------------------------------------------------------
// setActive — ADMIN: activar / desactivar cuenta (kept for backward compat)
// -----------------------------------------------------------------------
export async function setActive(
  userId: number,
  active: boolean,
  adminId: number,
): Promise<PublicUser> {
  await UserModel.setActive(userId, active, adminId);
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return userView(user);
}

// -----------------------------------------------------------------------
// updateUser — ADMIN: editar role, name y/o is_active (HU-01 CA1)
// Al menos uno de los tres campos debe estar presente (validado en el validator).
// -----------------------------------------------------------------------
export async function updateUser(
  userId: number,
  input: { role?: Role; name?: string; is_active?: boolean },
  adminId: number,
): Promise<PublicUser> {
  // RF-01: si se envía role, debe pertenecer al enum de 6 valores del PDF
  if (input.role !== undefined && !ROLES.includes(input.role)) {
    throw new AppError(`Invalid role: ${input.role}`, 422);
  }

  await UserModel.update(userId, input, adminId);

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return userView(user);
}

// -----------------------------------------------------------------------
// listUsers — ADMIN: listado paginado
// -----------------------------------------------------------------------
export async function listUsers(
  page: number,
  perPage: number,
  role?: string,
  isActive?: boolean,
): Promise<{ data: Omit<import('../models/user.model').UserListRow, 'total_count'>[]; total: number; page: number; per_page: number }> {
  const rows = await UserModel.list(page, perPage, role, isActive);
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  // Strip total_count de la respuesta pública (password_hash ya está omitido en UserListRow)
  const data = rows.map(({ total_count: _tc, ...rest }) => rest);

  return { data, total, page, per_page: perPage };
}
