import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { ValidationError } from '../errors/httpErrors';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';
import { getResetStatus, resetSettings, restoreSettings } from '../services/settingsReset';
import type { SettingsResetBody } from '../validation/schemas/bookingSettings';

/** The words an owner may type to confirm a full factory reset. */
export const FACTORY_RESET_CONFIRM_WORDS = ['איפוס', 'reset'] as const;

function requireBusinessId(req: AuthRequest): string {
  const businessId = getEffectiveBusinessId(req);
  if (!businessId) throw new ValidationError('Business ID not found');
  return businessId;
}

function actorOf(req: AuthRequest) {
  return { userId: req.user?.userId, email: req.user?.email };
}

/** POST /api/settings/me/reset — reset one section, or everything with `scope: "all"` (typed confirmation). */
export async function postSettingsReset(req: AuthRequest, res: Response): Promise<void> {
  const businessId = requireBusinessId(req);
  const { scope, confirm } = req.body as SettingsResetBody;
  if (scope === 'all') {
    const typed = (confirm ?? '').trim().toLowerCase();
    if (!(FACTORY_RESET_CONFIRM_WORDS as readonly string[]).includes(typed)) {
      throw new ValidationError('Type the confirmation word to reset everything', undefined, 'CONFIRMATION_REQUIRED');
    }
  }
  const result = await resetSettings({ businessId, scope, actor: actorOf(req) });
  res.json({ ...result, status: await getResetStatus(businessId) });
}

/** GET /api/settings/me/reset/status — is there a snapshot to restore? */
export async function getSettingsResetStatus(req: AuthRequest, res: Response): Promise<void> {
  res.json(await getResetStatus(requireBusinessId(req)));
}

/** POST /api/settings/me/reset/restore — put the snapshot back (until the next change to those settings). */
export async function postSettingsRestore(req: AuthRequest, res: Response): Promise<void> {
  const businessId = requireBusinessId(req);
  const result = await restoreSettings({ businessId, actor: actorOf(req) });
  res.json({ ...result, status: await getResetStatus(businessId) });
}
