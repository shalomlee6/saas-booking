import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateEnv } from '../config/env';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { generateSlug } from '../utils/slug';
import { auth, AuthRequest } from '../middleware/auth';
import { getMe } from '../controllers/authController';
import { validateBody } from '../middleware/validateRequest';
import { asyncHandler } from '../utils/asyncHandler';
import { authLoginBodySchema, authRegisterBodySchema } from '../validation/schemas/auth';

export const authRouter = Router();

const authCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const clearAuthCookieOptions = () => ({
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
});

/** Public self-serve registration: allowed when ALLOW_PUBLIC_REGISTER=true, or when unset in non-production. */
function isPublicRegistrationAllowed(): boolean {
  const v = process.env.ALLOW_PUBLIC_REGISTER;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

// POST /api/auth/register
authRouter.post(
  '/register',
  validateBody(authRegisterBodySchema),
  asyncHandler(async (req, res) => {
    if (!isPublicRegistrationAllowed()) {
      return res.status(403).json({ message: 'Public registration is disabled' });
    }

    const { email, password } = req.body as { email: string; password: string };

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create User
    const user = await User.create({
      email,
      passwordHash,
      role: 'owner',
    });

    // Create User business
    const business = await Business.create({
      ownerId: user._id,
      name: email.split('@')[0] + "'s business",
      slug: generateSlug(email.split('@')[0] + '-' + user._id.toString()),
    });

    // לעדכן את ה-user עם ה-businessId
    user.businessId = business._id;
    await user.save();

    const env = validateEnv();
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
        businessId: user.businessId,
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('sb_token', token, authCookieOptions());

    return res.status(201).json({
      token,
      business,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: user.businessId,
      },
    });
  })
);

// POST /api/auth/login
authRouter.post(
  '/login',
  validateBody(authLoginBodySchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ message: 'Account is disabled' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload: Record<string, unknown> = {
      userId: user._id,
      role: user.role,
      email: user.email,
    };
    // Super-admin session must not carry tenant scope; use impersonation JWT for that.
    if (user.role !== 'super_admin' && user.businessId) {
      payload.businessId = user.businessId;
    }

    const env = validateEnv();
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('sb_token', token, authCookieOptions());

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: user?.businessId,
      },
    });
  })
);

// GET /api/auth/me
authRouter.get('/me', auth, getMe);

// logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie('sb_token', clearAuthCookieOptions());
  return res.json({ success: true });
});
