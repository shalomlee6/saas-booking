import type { Response } from 'express';
import { z } from 'zod';
import { hourToBucket } from '../services/customerStatsService';
import { requireOwner } from '../middleware/requireOwner';
import type { AuthRequest } from '../middleware/auth';
import {
  andFilters,
  buildCsv,
  buildPhoneSearchRegex,
  buildSearchClause,
  canonicalLocalPhone,
  commaSeparated,
  createEntityListQuerySchema,
  CSV_EXPORT_ROW_CAP,
  escapeRegex,
  hebrewNameCollation,
  optionalQueryNumber,
  queryListPage,
  resolveDateRange,
} from '../listQuery';

const PHONE_SAMPLES = ['050-1234567', '0501234567', '+972501234567', '972501234567'];

function calendarDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

describe('list query schema', () => {
  const schema = createEntityListQuerySchema({
    filters: {
      status: commaSeparated(z.enum(['active', 'inactive'])),
      visitsMin: optionalQueryNumber(),
      visitsMax: optionalQueryNumber(),
    },
    sortableFields: ['name', 'createdAt'],
    defaultSort: 'name',
    rangePairs: [{ min: 'visitsMin', max: 'visitsMax' }],
  });

  it('defaults page, limit, search, and sort', () => {
    const parsed = schema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(25);
    expect(parsed.search).toBe('');
    expect(parsed.sort).toBe('name');
    expect(parsed.order).toBe('asc');
    expect(parsed.status).toEqual([]);
  });

  it('accepts 25, 50, and 100 and rejects any other limit', () => {
    expect(schema.parse({ limit: '50' }).limit).toBe(50);
    expect(schema.parse({ limit: '100' }).limit).toBe(100);
    expect(schema.safeParse({ limit: '10' }).success).toBe(false);
    expect(schema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('parses comma-separated filters and rejects values outside the enum', () => {
    expect(schema.parse({ status: 'active,inactive' }).status).toEqual(['active', 'inactive']);
    expect(schema.safeParse({ status: 'active,nope' }).success).toBe(false);
  });

  it('treats numeric ranges as half-open [min, max)', () => {
    const open = schema.parse({ visitsMin: '1', visitsMax: '5' });
    expect(open.visitsMin).toBe(1);
    expect(open.visitsMax).toBe(5);
    expect(schema.safeParse({ visitsMin: '5', visitsMax: '5' }).success).toBe(false);
    expect(schema.safeParse({ visitsMin: '6', visitsMax: '5' }).success).toBe(false);
    expect(schema.parse({ visitsMin: '3' }).visitsMin).toBe(3);
  });

  it('rejects sort fields outside the allowlist', () => {
    const sorted = schema.parse({ sort: 'createdAt', order: 'desc' });
    expect(sorted.sort).toBe('createdAt');
    expect(sorted.order).toBe('desc');
    expect(schema.safeParse({ sort: 'password' }).success).toBe(false);
    expect(schema.safeParse({ sort: '$where' }).success).toBe(false);
  });
});

describe('search and phone normalization', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.b+c')).toBe('a\\.b\\+c');
    const clause = buildSearchClause('a.b', { text: ['name'] });
    expect(clause).toEqual({ name: /a\.b/i });
    expect((clause?.name as RegExp).test('axb')).toBe(false);
    expect((clause?.name as RegExp).test('a.b')).toBe(true);
  });

  it('treats local, dashed, and +972 phones as the same number', () => {
    const canonical = PHONE_SAMPLES.map((sample) => canonicalLocalPhone(sample));
    expect(new Set(canonical)).toEqual(new Set(['0501234567']));

    for (const query of PHONE_SAMPLES) {
      const regex = buildPhoneSearchRegex(query);
      expect(regex).not.toBeNull();
      for (const stored of PHONE_SAMPLES) {
        expect(regex!.test(stored)).toBe(true);
      }
      expect(regex!.test('0509999999')).toBe(false);
      expect(regex!.test('(050) 123-4567')).toBe(true);
    }
  });

  it('ORs text and phone fields, and ANDs that clause with filters', () => {
    const search = buildSearchClause('050-1234567', { text: ['name'], phone: ['phone'] });
    expect(search !== null && '$or' in search).toBe(true);
    const combined = andFilters(search, { isActive: true });
    expect(combined).toEqual({ $and: [search, { isActive: true }] });
    expect(andFilters(null, {}, undefined)).toEqual({});
    expect(buildSearchClause('   ', { text: ['name'] })).toBeNull();
    expect(canonicalLocalPhone('chen')).toBeNull();
    expect(canonicalLocalPhone('02-1234567')).toBeNull();
    expect(canonicalLocalPhone('0721234567')).toBeNull();
    expect(canonicalLocalPhone('+97231234567')).toBeNull();
    expect(canonicalLocalPhone('041234567')).toBeNull();
    expect(canonicalLocalPhone('051234567')).toBeNull();
    expect(canonicalLocalPhone('05123456789')).toBeNull();
    expect(canonicalLocalPhone('0501234567')).toBe('0501234567');
    expect(canonicalLocalPhone('+972501234567')).toBe('0501234567');
  });
});

describe('date ranges', () => {
  const now = new Date('2026-10-03T10:22:37.000Z');
  const zone = 'Asia/Jerusalem';

  it('builds half-open calendar ranges in the business timezone', () => {
    const today = resolveDateRange({ preset: 'today', now, timezone: zone });
    expect(calendarDay(today.start, zone)).toBe('2026-10-03');
    expect(calendarDay(today.end, zone)).toBe('2026-10-04');
    expect(today.end.getTime()).toBeGreaterThan(today.start.getTime());

    const last7 = resolveDateRange({ preset: 'last7Days', now, timezone: zone });
    expect(calendarDay(last7.start, zone)).toBe('2026-09-27');
    expect(calendarDay(last7.end, zone)).toBe('2026-10-04');

    const last30 = resolveDateRange({ preset: 'last30Days', now, timezone: zone });
    expect(calendarDay(last30.start, zone)).toBe('2026-09-04');
    expect(calendarDay(last30.end, zone)).toBe('2026-10-04');

    const thisMonth = resolveDateRange({ preset: 'thisMonth', now, timezone: zone });
    expect(calendarDay(thisMonth.start, zone)).toBe('2026-10-01');
    expect(calendarDay(thisMonth.end, zone)).toBe('2026-11-01');

    const previous = resolveDateRange({ preset: 'previousMonth', now, timezone: zone });
    expect(calendarDay(previous.start, zone)).toBe('2026-09-01');
    expect(calendarDay(previous.end, zone)).toBe('2026-10-01');
  });

  it('defaults the timezone to Asia/Jerusalem and accepts a custom half-open range', () => {
    const custom = resolveDateRange({
      preset: 'custom',
      now,
      from: '2026-01-01',
      to: '2026-01-15',
    });
    expect(calendarDay(custom.start, zone)).toBe('2026-01-01');
    expect(calendarDay(custom.end, zone)).toBe('2026-01-15');
    expect(() => resolveDateRange({ preset: 'custom', now, from: '2026-02-01', to: '2026-02-01' })).toThrow(
      /half-open/
    );
  });
});

describe('hebrew collation and facet page', () => {
  it('uses the Hebrew locale at primary strength', () => {
    expect(hebrewNameCollation()).toEqual({ locale: 'he', strength: 1, numericOrdering: true });
  });

  it('returns { items, total, page, limit } from one $facet', async () => {
    const rows = [{ items: [{ name: 'ב' }, { name: 'א' }], total: [{ count: 40 }] }];
    const collation = jest.fn().mockResolvedValue(rows);
    const aggregate = jest.fn().mockReturnValue({ collation, then: Promise.resolve(rows).then.bind(Promise.resolve(rows)) });

    const page = await queryListPage(
      { aggregate },
      { businessId: 'b1' },
      { page: 2, limit: 25, sortField: 'name', order: 'asc' },
      { collation: hebrewNameCollation() }
    );

    expect(page).toEqual({
      items: [{ name: 'ב' }, { name: 'א' }],
      total: 40,
      page: 2,
      limit: 25,
    });
    expect(collation).toHaveBeenCalledWith(hebrewNameCollation());
    const pipeline = aggregate.mock.calls[0][0] as Record<string, unknown>[];
    expect(pipeline[0]).toEqual({ $match: { businessId: 'b1' } });
    expect(pipeline[1]).toEqual({
      $facet: {
        items: [{ $sort: { name: 1 } }, { $skip: 25 }, { $limit: 25 }],
        total: [{ $count: 'count' }],
      },
    });
  });

  it('counts zero when the facet total is empty and rejects unsafe sort fields', async () => {
    const rows = [{ items: [], total: [] }];
    const aggregate = jest.fn().mockResolvedValue(rows);
    const page = await queryListPage({ aggregate }, {}, { page: 1, limit: 25, sortField: 'createdAt', order: 'desc' });
    expect(page.total).toBe(0);
    const pipeline = aggregate.mock.calls[0][0] as { $facet: { items: { $sort: Record<string, number> }[] } }[];
    expect(pipeline[1].$facet.items[0].$sort).toEqual({ createdAt: -1 });
    let threw = false;
    try {
      await queryListPage({ aggregate }, {}, { page: 1, limit: 25, sortField: '$where', order: 'asc' });
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/Invalid sort field/);
    }
    expect(threw).toBe(true);
  });
});

describe('csv export', () => {
  it('writes a UTF-8 BOM, escapes formula prefixes, and forces phones to text', () => {
    const result = buildCsv(
      [
        { key: 'name', header: 'Name' },
        { key: 'phone', header: 'Phone', phone: true },
      ],
      [
        { name: '=HYPERLINK("http://evil")', phone: '0501234567' },
        { name: '+sum', phone: null },
        { name: '-1', phone: '@cmd' },
        { name: 'say "hi"', phone: '050-1234567' },
      ]
    );

    expect(result.body.startsWith('\uFEFF')).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.rowCount).toBe(4);
    const lines = result.body.slice(1).split('\r\n');
    expect(lines[0]).toBe('Name,Phone');
    expect(lines[1]).toContain(`'=HYPERLINK(""http://evil"")`);
    expect(lines[1]).toContain("'0501234567");
    expect(lines[2]).toContain("'+sum");
    expect(lines[3]).toContain("'-1");
    expect(lines[3]).toContain("'@cmd");
    expect(lines[4]).toBe('"say ""hi""",\'050-1234567');
  });

  it('caps the number of data rows', () => {
    const rows = Array.from({ length: CSV_EXPORT_ROW_CAP + 2 }, (_, index) => ({ name: `n${index}` }));
    const result = buildCsv([{ key: 'name', header: 'Name' }], rows, 2);
    expect(result.truncated).toBe(true);
    expect(result.rowCount).toBe(2);
    expect(result.body.slice(1).split('\r\n').length).toBe(3);
  });
});

describe('hourToBucket', () => {
  it('keeps the customer-stats boundaries', () => {
    expect(hourToBucket(4)).toBe('night');
    expect(hourToBucket(5)).toBe('morning');
    expect(hourToBucket(11)).toBe('morning');
    expect(hourToBucket(12)).toBe('afternoon');
    expect(hourToBucket(16)).toBe('afternoon');
    expect(hourToBucket(17)).toBe('evening');
    expect(hourToBucket(21)).toBe('evening');
    expect(hourToBucket(22)).toBe('night');
    expect(hourToBucket(0)).toBe('night');
  });
});

describe('requireOwner', () => {
  function run(user: AuthRequest['user']) {
    const req = { user } as AuthRequest;
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    const next = jest.fn();
    requireOwner(req, res as unknown as Response, next);
    return { res, next };
  }

  it('allows the owner and an impersonating super-admin', () => {
    const owner = run({ userId: '1', role: 'owner' });
    expect(owner.next).toHaveBeenCalledTimes(1);

    const impersonating = run({ userId: '2', role: 'super_admin', impersonating: true });
    expect(impersonating.next).toHaveBeenCalledTimes(1);
  });

  it('rejects staff, admin, a signed-out caller, and a super-admin who is not impersonating', () => {
    const staff = run({ userId: '3', role: 'staff' });
    expect(staff.next).not.toHaveBeenCalled();
    expect(staff.res.statusCode).toBe(403);

    const admin = run({ userId: '4', role: 'admin' });
    expect(admin.res.statusCode).toBe(403);

    const outsider = run({ userId: '5', role: 'super_admin', impersonating: false });
    expect(outsider.res.statusCode).toBe(403);

    const anonymous = run(undefined);
    expect(anonymous.res.statusCode).toBe(401);
  });
});
