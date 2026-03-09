import { PaginationQueryDto } from '../dto/pagination-query.dto';

export function getPagination(query: PaginationQueryDto) {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
