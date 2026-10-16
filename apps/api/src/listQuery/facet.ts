export interface ListPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

interface FacetRow<T> {
  items: T[];
  total: { count: number }[];
}

export interface ListAggregateCursor<T> {
  then: Promise<FacetRow<T>[]>['then'];
  collation(collation: object): Promise<FacetRow<T>[]>;
}

export interface ListAggregateSource {
  aggregate(pipeline: Record<string, unknown>[]): ListAggregateCursor<unknown>;
}

export interface FacetListQuery {
  page: number;
  limit: number;
  sortField: string;
  order: 'asc' | 'desc';
}

export interface FacetListOptions {
  collation?: object;
  /** Stages inserted after `$match` and before `$facet` (lookups, projections). */
  beforeFacet?: Record<string, unknown>[];
}

function assertSafeSortField(sortField: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(sortField)) {
    throw new Error('Invalid sort field');
  }
}

/**
 * One round-trip list: the match (search AND filters) is counted and paged
 * together via `$facet`, so `total` is the filtered total.
 */
export async function queryListPage<T>(
  source: ListAggregateSource,
  match: Record<string, unknown>,
  query: FacetListQuery,
  options?: FacetListOptions
): Promise<ListPage<T>> {
  assertSafeSortField(query.sortField);
  const skip = (query.page - 1) * query.limit;
  const pipeline: Record<string, unknown>[] = [
    { $match: match },
    ...(options?.beforeFacet ?? []),
    {
      $facet: {
        items: [
          { $sort: { [query.sortField]: query.order === 'asc' ? 1 : -1 } },
          { $skip: skip },
          { $limit: query.limit },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const cursor = source.aggregate(pipeline);
  const rows = options?.collation
    ? await cursor.collation(options.collation)
    : await cursor;
  const row = (rows[0] ?? { items: [], total: [] }) as FacetRow<T>;

  return {
    items: row.items ?? [],
    total: row.total[0]?.count ?? 0,
    page: query.page,
    limit: query.limit,
  };
}
