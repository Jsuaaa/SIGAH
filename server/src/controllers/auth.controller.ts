import * as authService from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

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
