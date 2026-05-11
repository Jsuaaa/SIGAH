// auth.controller.ts — Handlers HTTP para el módulo Auth.
// Transporta HTTP; toda la lógica vive en auth.service.ts y los SPs.

import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../config/constants';

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({ success: true, data: user });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json({ success: true, data: result });
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user!.id);
  res.json({ success: true, data: user });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user!.id, req.body);
  res.json({ success: true, message: 'Password updated successfully' });
});

// -----------------------------------------------------------------------
// ADMIN: resetear contraseña de cualquier usuario
// POST /api/v1/auth/reset-password/:userId
// -----------------------------------------------------------------------
export const resetPassword = asyncHandler(async (req, res) => {
  const userId = parseInt(String(req.params.userId), 10);
  const result = await authService.resetPassword(userId, req.user!.id);
  res.json({ success: true, data: result });
});

// -----------------------------------------------------------------------
// ADMIN: activar / desactivar usuario
// PUT /api/v1/auth/users/:id  body: { is_active: boolean }
// -----------------------------------------------------------------------
export const setActive = asyncHandler(async (req, res) => {
  const userId = parseInt(String(req.params.id), 10);
  const { is_active } = req.body as { is_active: boolean };
  const user = await authService.setActive(userId, is_active, req.user!.id);
  res.json({ success: true, data: user });
});

// -----------------------------------------------------------------------
// ADMIN: listado paginado de usuarios
// GET /api/v1/auth/users?page=1&per_page=20&role=CENSADOR&is_active=true
// -----------------------------------------------------------------------
export const listUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string, 10) || DEFAULT_PAGE;
  const per_page = parseInt(req.query.per_page as string, 10) || DEFAULT_LIMIT;
  const role = (req.query.role as string) || undefined;
  const is_active =
    req.query.is_active !== undefined
      ? req.query.is_active === 'true'
      : undefined;

  const result = await authService.listUsers(page, per_page, role, is_active);
  res.json({ success: true, ...result });
});
