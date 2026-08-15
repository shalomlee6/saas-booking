import type { Request, Response } from 'express';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { isEmailConfigured } from '../services/emailService';
import {
  GENERIC_FORGOT_MESSAGE,
  EmailNotConfiguredError,
  consumePasswordResetToken,
  deliverPasswordResetEmail,
  issuePasswordResetToken,
} from '../services/passwordResetService';
import type { AuthRequest } from '../middleware/auth';
import { recordAudit } from '../utils/recordAudit';

const GENERIC_RESET_INVALID = 'This reset link is invalid or has expired.';

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };

  try {
    if (!isEmailConfigured() && process.env.NODE_ENV === 'production') {
      res.status(503).json({
        message: 'Email provider is not configured. Set SENDGRID_API_KEY and FROM_EMAIL.',
      });
      return;
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || user.status === 'disabled') {
      res.json({ message: GENERIC_FORGOT_MESSAGE });
      return;
    }

    const raw = await issuePasswordResetToken(user._id.toString());
    try {
      await deliverPasswordResetEmail(user.email, raw);
    } catch (err) {
      if (err instanceof EmailNotConfiguredError) {
        res.status(503).json({ message: err.message });
        return;
      }
      logger.error('forgot_password_send_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(502).json({ message: 'Failed to send reset email. Please try again.' });
      return;
    }

    res.json({ message: GENERIC_FORGOT_MESSAGE });
  } catch (err) {
    logger.error('forgot_password_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };

  try {
    const result = await consumePasswordResetToken(token, password);
    if (!result.ok) {
      res.status(400).json({ message: GENERIC_RESET_INVALID });
      return;
    }
    res.json({ message: 'Password updated. You can sign in with your new password.' });
  } catch (err) {
    logger.error('reset_password_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}

/** POST /api/admin/users/:id/reset-password */
export async function adminResetUserPassword(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (user.status === 'disabled') {
      res.status(400).json({ message: 'Cannot reset password for a disabled account' });
      return;
    }

    const raw = await issuePasswordResetToken(user._id.toString());
    try {
      await deliverPasswordResetEmail(user.email, raw);
    } catch (err) {
      if (err instanceof EmailNotConfiguredError) {
        res.status(503).json({ message: err.message });
        return;
      }
      logger.error('admin_reset_password_send_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(502).json({ message: 'Failed to send reset email. Please try again.' });
      return;
    }

    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'user.password_reset',
      entity: 'User',
      entityId: user._id.toString(),
      metadata: { targetEmail: user.email },
    });

    res.json({ message: 'A password reset link was sent to the user.' });
  } catch (err) {
    logger.error('admin_reset_password_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}
