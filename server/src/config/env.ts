import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const required = ['DATABASE_URL', 'JWT_SECRET'] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const DATABASE_URL = process.env.DATABASE_URL!;
export const JWT_SECRET = process.env.JWT_SECRET!;
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sigah.gov.co';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
