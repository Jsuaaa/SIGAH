import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../config/constants';

export function parsePagination(query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page || '', 10) || DEFAULT_PAGE);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit || '', 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
}
