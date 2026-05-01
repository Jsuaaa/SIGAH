// Data-access layer for the `users` table. Every method is a thin wrapper
// over a stored procedure declared in db/procedures/users/. No business logic.

import { db } from '../db/client';
import type { Role, User } from '../types/entities';

export interface CreateUserInput {
  email: string;
  password_hash: string;
  role: Role;
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
      'SELECT * FROM fn_users_create($1, $2, $3::role)',
      [input.email, input.password_hash, input.role],
    );
    if (!row) throw new Error('fn_users_create returned no row');
    return row;
  },

  async changePassword(id: number, newPasswordHash: string): Promise<void> {
    await db.query('SELECT sp_users_change_password($1, $2)', [id, newPasswordHash]);
  },
};
