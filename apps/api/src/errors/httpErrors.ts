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
  constructor(message: string = 'Validation failed', fieldErrors?: FieldError[]) {
    super(400, message, undefined, fieldErrors);
  }
}

/** 404 */
export class NotFoundError extends HttpError {
  constructor(message: string = 'Not found') {
    super(404, message);
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
  constructor(message: string = 'Forbidden') {
    super(403, message);
  }
}

/** 401 */
export class UnauthorizedError extends HttpError {
  constructor(message: string = 'Not authenticated') {
    super(401, message);
  }
}
