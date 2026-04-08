import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodType } from 'zod';

export type FieldError = {
  path: string;
  message: string;
  code?: string;
};

function formatZodError(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

function sendValidationFailed(res: Response, zodError: ZodError): void {
  res.status(400).json({
    message: 'Validation failed',
    errors: formatZodError(zodError),
  });
}

/**
 * Validates `req.body` and replaces it with the parsed output (stripped unknown keys if schema uses `.strict()`).
 */
export function validateBody<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      sendValidationFailed(res, result.error);
      return;
    }
    req.body = result.data as Request['body'];
    next();
  };
}

/**
 * Validates `req.query` (coerces query-string arrays to a single value for known keys via schema preprocess).
 */
export function validateQuery<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      sendValidationFailed(res, result.error);
      return;
    }
    req.query = result.data as Request['query'];
    next();
  };
}

/**
 * Validates `req.params` and replaces with parsed output.
 */
export function validateParams<T extends ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      sendValidationFailed(res, result.error);
      return;
    }
    req.params = result.data as Request['params'];
    next();
  };
}
