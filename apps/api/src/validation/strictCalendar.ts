const HAS_OFFSET = /Z$|[+-]\d{2}:\d{2}(:\d{2})?$/;

/**
 * True iff `s` is a real Gregorian calendar day YYYY-MM-DD.
 * Uses UTC date construction and rejects rollover (e.g. 2026-02-31, 2026-13-01).
 */
export function isValidYyyyMmDd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return false;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === mo && dt.getUTCDate() === d
  );
}

/**
 * ISO 8601 instant with explicit `Z` or numeric offset; rejects invalid written calendar dates
 * in the leading YYYY-MM-DD segment (no silent normalization of impossible dates).
 */
export function isValidIso8601InstantWithOffset(s: string): boolean {
  if (!HAS_OFFSET.test(s)) return false;
  const head = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head) && !isValidYyyyMmDd(head)) {
    return false;
  }
  const t = Date.parse(s);
  return !Number.isNaN(t);
}
