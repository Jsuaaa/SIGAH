// Data-access layer for the `users` table. Every method is a thin wrapper
// over a stored procedure declared in db/procedures/users/. No business logic.

import { db } from '../db/client';
import type { Role, User } from '../types/entities';

export interface CreateUserInput {
  email: string;
  password_hash: string;
  role: Role;
  name: string;
}

// Row returned by fn_users_list (includes total_count for pagination).
export interface UserListRow extends Omit<User, 'password_hash'> {
  total_count: string; // BIGINT → string from pg driver
}

export const UserModel = {
  async findByEmail(email: string): Promise<User | null> {
    return db.queryOne<User>('SELECT * FROM fn_users_find_by_email($1)', [email]);
  },

  async findById(id: number): Promise<User | null> {
    return db.queryOne<User>('SELECT * FROM fn_users_find_by_id($1)', [id]);
  },

  async create(input: CreateUserInput): Promise<User> {
    const row = await db.queryOne<User>(
      'SELECT * FROM fn_users_create($1, $2, $3::role, $4)',
      [input.email, input.password_hash, input.role, input.name],
    );
    if (!row) throw new Error('fn_users_create returned no row');
    return row;
  },

  async changePassword(id: number, newPasswordHash: string): Promise<void> {
    await db.query('SELECT sp_users_change_password($1, $2)', [id, newPasswordHash]);
  },

  async login(email: string, passwordMatch: boolean, now: Date): Promise<User | null> {
    return db.queryOne<User>(
      'SELECT * FROM sp_auth_login($1, $2, $3)',
      [email, passwordMatch, now],
    );
  },

  async resetPassword(userId: number, newHash: string, adminId: number): Promise<void> {
    await db.query(
      'SELECT sp_users_reset_password($1, $2, $3)',
      [userId, newHash, adminId],
    );
  },

  async setActive(userId: number, active: boolean, adminId: number): Promise<void> {
    await db.query(
      'SELECT sp_users_set_active($1, $2, $3)',
      [userId, active, adminId],
    );
  },

  async update(
    userId: number,
    input: { role?: Role; name?: string; is_active?: boolean },
    adminId: number,
  ): Promise<void> {
    await db.query(
      'SELECT sp_users_update($1, $2::role, $3, $4, $5)',
      [
        userId,
        input.role ?? null,
        input.name ?? null,
        input.is_active ?? null,
        adminId,
      ],
    );
  },

  async list(
    page: number,
    perPage: number,
    role?: string,
    isActive?: boolean,
  ): Promise<UserListRow[]> {
    const result = await db.query<UserListRow>(
      'SELECT * FROM fn_users_list($1, $2, $3, $4)',
      [page, perPage, role ?? null, isActive ?? null],
    );
    return result.rows;
  },
};
