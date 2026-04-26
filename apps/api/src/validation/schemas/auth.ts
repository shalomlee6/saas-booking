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
