/**
 * Canonical API wire format for absolute instants: ISO 8601 in UTC with `Z` suffix.
 * Matches `Date.prototype.toISOString()` for valid Dates.
 */
export function toIsoUtcString(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError('Invalid date for toIsoUtcString');
  }
  return d.toISOString();
}
