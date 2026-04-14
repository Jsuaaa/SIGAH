const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../config/env');
const { JWT_EXPIRATION } = require('../config/constants');
const AppError = require('../utils/AppError');

async function register({ email, password, role }) {
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

async function login({ email, password }) {
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

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, created_at: true, updated_at: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
}

async function changePassword(userId, { oldPassword, newPassword }) {
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

module.exports = { register, login, getProfile, changePassword };
