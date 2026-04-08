import { HttpErrorResponse } from '@angular/common/http';

/**
 * Parsed client-side view of an error payload. Backend shape is not fixed yet;
 * this supports common patterns so the UI can evolve without contract changes.
 */
export interface ParsedHttpClientError {
  /** Top-level or fallback message. */
  generalMessage: string | null;
  /**
   * First message per field key when the body uses a map of field → string | string[].
   */
  fieldMessages: Record<string, string>;
}

function firstStringFromFieldValue(val: unknown): string | null {
  if (typeof val === 'string' && val.trim()) return val.trim();
  if (Array.isArray(val)) {
    const first = val.find((x) => typeof x === 'string' && x.trim());
    return typeof first === 'string' ? first.trim() : null;
  }
  return null;
}

/**
 * Best-effort parse of JSON error bodies (400 validation, etc.) without assuming
 * a single backend contract. Extend mapping here when the API stabilizes.
 */
export function parseHttpErrorBody(body: unknown): ParsedHttpClientError {
  const fieldMessages: Record<string, string> = {};
  let generalMessage: string | null = null;

  if (body && typeof body === 'object' && body !== null) {
    const o = body as Record<string, unknown>;
    const msg = o['message'];
    if (typeof msg === 'string' && msg.trim()) {
      generalMessage = msg.trim();
    }

    const errNested = o['error'];
    const nested =
      o['errors'] ??
      o['fieldErrors'] ??
      o['fields'] ??
      (typeof errNested === 'object' && errNested !== null
        ? (errNested as Record<string, unknown>)['errors']
        : undefined);

    if (nested && typeof nested === 'object' && nested !== null) {
      for (const [key, val] of Object.entries(nested)) {
        const msg = firstStringFromFieldValue(val);
        if (msg) fieldMessages[key] = msg;
      }
    }
  }

  return { generalMessage, fieldMessages };
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
 * Single string for toasts / inline banners: prefers general message, else first field message.
 */
export function formatParsedErrorForUi(parsed: ParsedHttpClientError): string | null {
  if (parsed.generalMessage) return parsed.generalMessage;
  const keys = Object.keys(parsed.fieldMessages);
  if (keys.length === 0) return null;
  return keys.map((k) => `${k}: ${parsed.fieldMessages[k]}`).join(' · ');
}
