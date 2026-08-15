import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { generateSlug } from '../utils/slug';
import { auth } from '../middleware/auth';
import { getMe } from '../controllers/authController';
import { validateBody } from '../middleware/validateRequest';
import { asyncHandler } from '../utils/asyncHandler';
import {
  authForgotPasswordBodySchema,
  authLoginBodySchema,
  authRegisterBodySchema,
  authResetPasswordBodySchema,
} from '../validation/schemas/auth';
import { forgotPassword, resetPassword } from '../controllers/passwordResetController';
import {
  STAFF_COOKIE_NAME,
  clearStaffAuthCookieOptions,
  signStaffSessionToken,
  staffAuthCookieOptions,
} from '../utils/staffSession';

export const authRouter = Router();

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

    const token = signStaffSessionToken({
      userId: user._id,
      role: user.role,
      email: user.email,
      businessId: user.businessId,
    });

    res.cookie(STAFF_COOKIE_NAME, token, staffAuthCookieOptions());

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

    const token = signStaffSessionToken(payload);

    res.cookie(STAFF_COOKIE_NAME, token, staffAuthCookieOptions());

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

authRouter.post('/forgot-password', validateBody(authForgotPasswordBodySchema), asyncHandler(forgotPassword));
authRouter.post('/reset-password', validateBody(authResetPasswordBodySchema), asyncHandler(resetPassword));

// GET /api/auth/me
authRouter.get('/me', auth, getMe);

// logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie(STAFF_COOKIE_NAME, clearStaffAuthCookieOptions());
  return res.json({ success: true });
});
