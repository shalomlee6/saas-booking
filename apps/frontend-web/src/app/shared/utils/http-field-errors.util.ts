import { HttpErrorResponse } from '@angular/common/http';

/**
 * Parsed client-side view of an error payload. Backend shape is not fixed yet;
 * this supports common patterns so the UI can evolve without contract changes.
 */
export interface ParsedHttpClientError {
  /** Top-level or fallback message. */
  generalMessage: string | null;
  /**
   * First message per field key when the body uses a map of field → string | string[],
   * or Zod-style `{ path, message }[]`.
   */
  fieldMessages: Record<string, string>;
  /** Machine code from API body when present (`AppointmentError`, etc.). */
  errorCode: string | null;
}

function firstStringFromFieldValue(val: unknown): string | null {
  if (typeof val === 'string' && val.trim()) return val.trim();
  if (Array.isArray(val)) {
    const first = val.find((x) => typeof x === 'string' && x.trim());
    return typeof first === 'string' ? first.trim() : null;
  }
  return null;
}

function pathKeyFromZodIssue(path: unknown): string {
  if (Array.isArray(path)) return path.map(String).join('.');
  if (typeof path === 'string' && path.length) return path;
  return 'field';
}

/**
 * Best-effort parse of JSON error bodies (400 validation, etc.) without assuming
 * a single backend contract. Extend mapping here when the API stabilizes.
 */
export function parseHttpErrorBody(body: unknown): ParsedHttpClientError {
  const fieldMessages: Record<string, string> = {};
  let generalMessage: string | null = null;
  let errorCode: string | null = null;

  if (body && typeof body === 'object' && body !== null) {
    const o = body as Record<string, unknown>;
    const msg = o['message'];
    if (typeof msg === 'string' && msg.trim()) {
      generalMessage = msg.trim();
    }
    const code = o['code'];
    if (typeof code === 'string' && code.trim()) {
      errorCode = code.trim();
    }

    const errNested = o['error'];
    const nested =
      o['errors'] ??
      o['fieldErrors'] ??
      o['fields'] ??
      (typeof errNested === 'object' && errNested !== null
        ? (errNested as Record<string, unknown>)['errors']
        : undefined);

    if (Array.isArray(nested)) {
      for (const item of nested) {
        if (item && typeof item === 'object' && item !== null) {
          const key = pathKeyFromZodIssue((item as { path?: unknown }).path);
          const m = (item as { message?: unknown }).message;
          if (typeof m === 'string' && m.trim()) {
            fieldMessages[key] = m.trim();
          }
        }
      }
    } else if (nested && typeof nested === 'object' && nested !== null) {
      for (const [key, val] of Object.entries(nested)) {
        const m = firstStringFromFieldValue(val);
        if (m) fieldMessages[key] = m;
      }
    }
  }

  return { generalMessage, fieldMessages, errorCode };
}

/**
 * Convenience: parse `HttpErrorResponse.error` or unknown throwables.
 */
export function parseHttpClientError(err: unknown): ParsedHttpClientError {
  if (err instanceof HttpErrorResponse) {
    return parseHttpErrorBody(err.error);
  }
  return parseHttpErrorBody(err);
}

/**
 * Single string for toasts / inline banners: prefers field details when the top-level
 * message is generic "Validation failed", else general message, else first field message.
 */
export function formatParsedErrorForUi(parsed: ParsedHttpClientError): string | null {
  const keys = Object.keys(parsed.fieldMessages);
  const generic =
    parsed.generalMessage === 'Validation failed' ||
    parsed.generalMessage === 'Internal server error';

  if (keys.length > 0 && generic) {
    return keys.map((k) => `${k}: ${parsed.fieldMessages[k]}`).join(' · ');
  }
  if (parsed.generalMessage) return parsed.generalMessage;
  if (keys.length === 0) return null;
  return keys.map((k) => `${k}: ${parsed.fieldMessages[k]}`).join(' · ');
}

/** Owner / dashboard (English) — maps stable API codes to clearer copy. */
const OWNER_ERROR_BY_CODE: Record<string, string> = {
  SLOT_TAKEN: 'That time slot is no longer available. Pick another time.',
  CLOSED_DAY: 'The business is closed on this date.',
  OUTSIDE_HOURS: 'That time is outside working hours.',
};

/** Public booking (Hebrew) — maps stable API codes to clearer copy. */
const PUBLIC_BOOKING_ERROR_BY_CODE: Record<string, string> = {
  SLOT_TAKEN: 'התור נתפס — בחרי שעה אחרת.',
  CLOSED_DAY: 'העסק סגור בתאריך זה.',
  OUTSIDE_HOURS: 'מחוץ לשעות הפעילות.',
};

/**
 * User-facing message for owner appointment APIs (create overlay, NgRx error).
 */
export function friendlyOwnerAppointmentError(err: unknown): string {
  const p = parseHttpClientError(err);
  if (p.errorCode && OWNER_ERROR_BY_CODE[p.errorCode]) {
    return OWNER_ERROR_BY_CODE[p.errorCode];
  }
  return formatParsedErrorForUi(p) ?? 'Something went wrong. Please try again.';
}

/**
 * User-facing message for public booking (`POST /api/public/appointments`), Hebrew UI.
 */
export function friendlyPublicBookingError(err: unknown): string {
  const p = parseHttpClientError(err);
  if (p.errorCode && PUBLIC_BOOKING_ERROR_BY_CODE[p.errorCode]) {
    return PUBLIC_BOOKING_ERROR_BY_CODE[p.errorCode];
  }
  return formatParsedErrorForUi(p) ?? 'שגיאה באישור התור';
}
