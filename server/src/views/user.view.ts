// Serializers for the User entity. Strip secrets and pick the fields that
// belong in the public API contract.

import type { User } from '../types/entities';

export type PublicUser = Omit<User, 'password_hash'>;

export function userView(user: User): PublicUser {
  const { password_hash: _omit, ...rest } = user;
  return rest;
}

// Used by the auth controller for register/getProfile responses, where we
// expose only id/email/role/created_at(/updated_at).
export interface BriefUser {
  id: number;
  email: string;
  role: User['role'];
  created_at: Date;
  updated_at?: Date;
}

export function briefUserView(user: User, withUpdatedAt = false): BriefUser {
  const out: BriefUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };
  if (withUpdatedAt) out.updated_at = user.updated_at;
  return out;
}
