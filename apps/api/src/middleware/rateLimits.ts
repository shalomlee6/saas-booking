import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

const jsonMessage = { message: 'Too many requests, please try again later.' };

/** Auth routes: login, register, refresh, etc. */
export const authRouteLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage,
});

/** All `/api/public/*` traffic. */
export const publicRouteLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage,
});

/** Authenticated backoffice routes (business, appointments, customers, etc.) */
export const apiRouteLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage,
});

/** Admin/super-admin routes. */
export const adminRouteLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage,
});
