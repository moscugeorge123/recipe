import { describe, expect, it } from 'vitest';

import {
  buildPaginationMeta,
  MAX_PAGE_SIZE,
  paginationQuerySchema,
  toOffsetLimit,
} from './pagination.js';

describe('paginationQuerySchema', () => {
  it('defaults to the first page', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('coerces query string values to numbers', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it.each([
    ['page below the minimum', { page: '0' }],
    ['negative page', { page: '-1' }],
    ['fractional page', { page: '1.5' }],
    ['non-numeric page', { page: 'abc' }],
    ['pageSize below the minimum', { pageSize: '0' }],
    ['pageSize above the maximum', { pageSize: String(MAX_PAGE_SIZE + 1) }],
  ])('rejects %s', (_name, input) => {
    expect(paginationQuerySchema.safeParse(input).success).toBe(false);
  });

  it('accepts the maximum page size', () => {
    expect(paginationQuerySchema.parse({ pageSize: String(MAX_PAGE_SIZE) }).pageSize).toBe(
      MAX_PAGE_SIZE,
    );
  });
});

describe('toOffsetLimit', () => {
  it('maps the first page to a zero offset', () => {
    expect(toOffsetLimit({ page: 1, pageSize: 20 })).toEqual({ offset: 0, limit: 20 });
  });

  it('maps later pages to the matching offset', () => {
    expect(toOffsetLimit({ page: 4, pageSize: 25 })).toEqual({ offset: 75, limit: 25 });
  });
});

describe('buildPaginationMeta', () => {
  it('rounds the page count up', () => {
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 41)).toEqual({
      page: 1,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
  });

  it('reports zero pages for an empty result set', () => {
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 0)).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  });
});
