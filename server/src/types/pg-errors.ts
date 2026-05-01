import { AppError } from '../utils/AppError';

// Custom SQLSTATE prefix used by all SIGAH stored procedures. See
// db/README.md for the full table.
const SH_CODE_TO_STATUS: Record<string, number> = {
  SH401: 401,
  SH403: 403,
  SH404: 404,
  SH409: 409,
  SH422: 422,
  SH423: 423,
};

// Translate a pg driver error into an AppError when it carries a SIGAH custom
// SQLSTATE. Errors without a recognized code are returned unchanged so the
// global error handler can still inspect them.
export function mapPgError(err: unknown): unknown {
  if (!err || typeof err !== 'object') return err;
  const code = (err as { code?: string }).code;
  if (typeof code !== 'string') return err;
  const status = SH_CODE_TO_STATUS[code];
  if (!status) return err;
  const message = (err as { message?: string }).message ?? 'Database error';
  return new AppError(message, status);
}
