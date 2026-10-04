import { z } from 'zod';
import { yyyyMmDd } from '../validation/primitives';

/** Allowed page sizes for every entity list. */
export const LIST_PAGE_SIZES = [25, 50, 100] as const;
export type ListPageSize = (typeof LIST_PAGE_SIZES)[number];

export const LIST_PAGE_SIZE_MAX = 100;
export const LIST_SEARCH_MAX = 200;

const SORT_FIELD = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function blankToUndefined(value: unknown): unknown {
  const raw = firstQueryValue(value);
  if (raw === undefined || raw === null || raw === '') return undefined;
  return raw;
}

export const listQueryBaseSchema = z.object({
  page: z.preprocess(
    (value) => {
      const raw = blankToUndefined(value);
      return raw === undefined ? 1 : raw;
    },
    z.coerce.number().int().min(1)
  ),
  limit: z.preprocess(
    (value) => {
      const raw = blankToUndefined(value);
      return raw === undefined ? 25 : raw;
    },
    z.coerce.number().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]))
  ),
  search: z.preprocess((value) => {
    if (value === undefined || value === null) return '';
    const raw = firstQueryValue(value);
    return typeof raw === 'string' ? raw : '';
  }, z.string().trim().max(LIST_SEARCH_MAX)),
  sort: z.preprocess((value) => {
    const raw = blankToUndefined(value);
    return typeof raw === 'string' ? raw.trim() : undefined;
  }, z.string().regex(SORT_FIELD, 'Sort field contains unsupported characters').optional()),
  order: z.preprocess(
    (value) => {
      const raw = blankToUndefined(value);
      return raw === undefined ? 'asc' : raw;
    },
    z.enum(['asc', 'desc'])
  ),
});

export type ListQueryBase = z.infer<typeof listQueryBaseSchema>;

/**
 * Comma-separated multi-value query param. `a,b` and repeated Express values
 * both become an array. Empty input becomes `[]`.
 */
export function commaSeparated<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return [];
    const raw = Array.isArray(value) ? value.map((part) => String(part)).join(',') : String(value);
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }, z.array(item));
}

/** Optional flat query string. Blank becomes undefined. */
export function optionalQueryString(max = LIST_SEARCH_MAX) {
  return z.preprocess((value) => {
    const raw = blankToUndefined(value);
    return typeof raw === 'string' ? raw : undefined;
  }, z.string().trim().max(max).optional());
}

/** Optional flat query number. Blank becomes undefined. */
export function optionalQueryNumber() {
  return z.preprocess((value) => {
    const raw = blankToUndefined(value);
    return raw === undefined ? undefined : raw;
  }, z.coerce.number().finite().optional());
}

/** Optional YYYY-MM-DD query param. */
export function optionalYyyyMmDd() {
  return z.preprocess((value) => {
    const raw = blankToUndefined(value);
    return raw === undefined ? undefined : raw;
  }, yyyyMmDd.optional());
}

/** Half-open range check: when both bounds are present, `min < max`. */
export function isHalfOpen(min: string | number, max: string | number): boolean {
  return min < max;
}

export interface ListQueryRangePair {
  min: string;
  max: string;
}

export interface EntityListQueryOptions<F extends z.ZodRawShape> {
  filters: F;
  /** Allowlist. Anything else is a validation error, never a Mongo key. */
  sortableFields: readonly string[];
  defaultSort: string;
  /** Flat `min`/`max` query params treated as a half-open range `[min, max)`. */
  rangePairs?: readonly ListQueryRangePair[];
}

/**
 * Base list params plus entity filters. `sort` is filled with `defaultSort`
 * when the client omits it, and rejected when it is outside the allowlist.
 */
export function createEntityListQuerySchema<F extends z.ZodRawShape>(
  options: EntityListQueryOptions<F>
) {
  if (!options.sortableFields.includes(options.defaultSort)) {
    throw new Error(`defaultSort "${options.defaultSort}" is not an allowed sort field`);
  }

  return listQueryBaseSchema
    .extend(options.filters)
    .superRefine((data, ctx) => {
      const record = data as Record<string, unknown>;
      const sort = typeof record.sort === 'string' ? record.sort : options.defaultSort;
      if (!options.sortableFields.includes(sort)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sort'],
          message: 'Sort field is not allowed',
        });
      }
      for (const pair of options.rangePairs ?? []) {
        const min = record[pair.min];
        const max = record[pair.max];
        const minOk = typeof min === 'number' || typeof min === 'string';
        const maxOk = typeof max === 'number' || typeof max === 'string';
        if (!minOk || !maxOk) continue;
        if (!isHalfOpen(min, max)) {
          ctx.addIssue({
            code: 'custom',
            path: [pair.max],
            message: 'Range must be half-open [min, max)',
          });
        }
      }
    })
    .transform((data) => {
      const record = data as typeof data & { sort?: string };
      return {
        ...record,
        sort: record.sort ?? options.defaultSort,
      };
    });
}
