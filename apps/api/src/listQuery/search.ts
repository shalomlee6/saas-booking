/** Escapes a user string so it is matched literally inside a RegExp. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function literalSearchRegex(value: string): RegExp {
  return new RegExp(escapeRegex(value.trim()), 'i');
}

/**
 * `$or` across the entity's text fields and, when the query looks like a phone
 * number, its phone fields. Empty search returns null so it does not affect
 * an `$and` with filters.
 */
export function buildSearchClause(
  search: string,
  fields: { text?: readonly string[]; phone?: readonly string[] }
): Record<string, unknown> | null {
  const query = search.trim();
  if (!query) return null;

  const clauses: Record<string, unknown>[] = [];
  const textRegex = literalSearchRegex(query);
  for (const field of fields.text ?? []) {
    clauses.push({ [field]: textRegex });
  }

  const phoneRegex = buildPhoneSearchRegex(query);
  if (phoneRegex) {
    for (const field of fields.phone ?? []) {
      clauses.push({ [field]: phoneRegex });
    }
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return { $or: clauses };
}

/**
 * Search and filters combine with AND. Null/empty clauses are dropped.
 * A single remaining clause is returned as-is (no redundant `$and`).
 */
export function andFilters(
  ...parts: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const clauses = parts.filter(
    (part): part is Record<string, unknown> => !!part && Object.keys(part).length > 0
  );
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

/** Israeli mobile: trunk 05 plus 8 digits, after separators and a 972 prefix are stripped. */
const ISRAELI_MOBILE = /^05\d{8}$/;

/**
 * Canonical Israeli mobile (`0501234567`, `050-1234567`, `+972501234567`).
 * Landlines and any other 0-prefix are not canonical.
 * Returns null when the input is not that shape.
 */
export function canonicalLocalPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) {
    digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = `0${digits}`;
  }
  return ISRAELI_MOBILE.test(digits) ? digits : null;
}

/**
 * Digits-only value used by OTP, plus whether it is canonical.
 * Null when the input has no digits.
 */
export function resolveStoredPhone(input: string): { phone: string; canonical: boolean } | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  const canonical = canonicalLocalPhone(input);
  if (canonical) return { phone: canonical, canonical: true };
  return { phone: digits, canonical: false };
}

/**
 * Matches the same subscriber number whether it is stored with a trunk `0`,
 * `+972`, or separators (spaces, dashes, parentheses).
 */
export function buildPhoneSearchRegex(input: string): RegExp | null {
  const local = canonicalLocalPhone(input);
  if (!local) return null;
  const core = local.slice(1);
  const sep = '[^0-9]*';
  const body = core.split('').map((digit) => escapeRegex(digit)).join(sep);
  return new RegExp(`^[^0-9]*(?:\\+?972|0)${sep}${body}[^0-9]*$`, 'i');
}
