import type { RequestHandler } from 'express';

/**
 * Wraps an async Express handler so rejected promises are passed to `next(err)`
 * and reach the global error middleware.
 */
export function asyncHandler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
