import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppointmentError } from '../services/createAppointmentAtomic';

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

  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
}
