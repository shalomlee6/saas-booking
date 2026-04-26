import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import {
  ConflictError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/httpErrors';
import { AppointmentError } from '../services/appointmentErrors';

/**
 * Express error-handling middleware. Mount last, after all routes.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppointmentError) {
    const body: Record<string, unknown> = { message: err.message };
    if (err.code) {
      body.code = err.code;
    }
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ValidationError) {
    const body: Record<string, unknown> = { message: err.message };
    if (err.fieldErrors?.length) {
      body.errors = err.fieldErrors;
    }
    res.status(400).json(body);
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ message: err.message });
    return;
  }

  if (err instanceof ConflictError) {
    const body: Record<string, unknown> = { message: err.message };
    if (err.code) {
      body.code = err.code;
    }
    res.status(409).json(body);
    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(403).json({ message: err.message });
    return;
  }

  if (err instanceof UnauthorizedError) {
    res.status(401).json({ message: err.message });
    return;
  }

  if (err instanceof HttpError) {
    const body: Record<string, unknown> = { message: err.message };
    if (err.code) {
      body.code = err.code;
    }
    if (err.fieldErrors?.length) {
      body.errors = err.fieldErrors;
    }
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      message: 'Invalid id',
      field: err.path,
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      message: 'Validation failed',
      details,
    });
    return;
  }

  logger.error('unhandled_error', {
    error: err instanceof Error ? err.message : String(err),
  });
  res.status(500).json({ message: 'Internal server error' });
}
