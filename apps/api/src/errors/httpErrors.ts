/** Single field issue (aligned with Zod-style `errors` in validateRequest). */
export type FieldError = {
  path: string;
  message: string;
  code?: string;
};

/** Base for typed HTTP errors handled by `errorHandler`. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly fieldErrors?: FieldError[]
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 400 — optional structured field errors (same shape as Zod validation responses). */
export class ValidationError extends HttpError {
  constructor(message: string = 'Validation failed', fieldErrors?: FieldError[], code?: string) {
    super(400, message, code, fieldErrors);
  }
}

/** 404 */
export class NotFoundError extends HttpError {
  constructor(message: string = 'Not found', code?: string) {
    super(404, message, code);
  }
}

/** 409 — optional machine-readable code (e.g. domain conflict). */
export class ConflictError extends HttpError {
  constructor(message: string, code?: string) {
    super(409, message, code);
  }
}

/** 403 */
export class ForbiddenError extends HttpError {
  constructor(message: string = 'Forbidden', code?: string) {
    super(403, message, code);
  }
}

/** 401 */
export class UnauthorizedError extends HttpError {
  constructor(message: string = 'Not authenticated', code?: string) {
    super(401, message, code);
  }
}
