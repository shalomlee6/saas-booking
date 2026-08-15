import { z } from 'zod';

export const authRegisterBodySchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  })
  .strict();

export const authLoginBodySchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  })
  .strict();

export const authForgotPasswordBodySchema = z
  .object({
    email: z.string().trim().email(),
  })
  .strict();

export const authResetPasswordBodySchema = z
  .object({
    token: z.string().min(16).max(256),
    password: z.string().min(8).max(128),
  })
  .strict();
