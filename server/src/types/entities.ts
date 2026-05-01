// Hand-written interfaces that mirror the PostgreSQL schema. They replace the
// types Prisma used to generate. Keep them in sync with `db/migrations/*.sql`.

export type Role = 'ADMIN' | 'COORDINATOR' | 'OPERATOR' | 'VIEWER';

export const ROLES: readonly Role[] = ['ADMIN', 'COORDINATOR', 'OPERATOR', 'VIEWER'] as const;

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const RISK_LEVELS: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
  created_at: Date;
  updated_at: Date;
}

export interface Zone {
  id: number;
  name: string;
  risk_level: RiskLevel;
  latitude: number;
  longitude: number;
  estimated_population: number;
  created_at: Date;
  updated_at: Date;
}
