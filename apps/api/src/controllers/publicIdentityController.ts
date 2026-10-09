import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { recordAudit } from '../utils/recordAudit';
import {
  clearPublicSessionCookie,
  readPublicSessionId,
  renewPublicClientSession,
  revokePublicClientSession,
  setPublicSessionCookie,
} from '../utils/publicCustomerSession';
import type { RequestWithPublicCustomer } from '../types/publicCustomer';
import type { Birthday } from '../services/birthday';
import type { BirthdayField } from '../services/publicIdentityService';
import {
  completeIdentify,
  readPublicConfig,
  readSessionProfile,
  resolveBirthdayField,
  saveBirthdayField,
  startIdentify,
  verifyIdentify,
} from '../services/publicIdentityService';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';

function issueSession(res: Response, sessionId: string): void {
  setPublicSessionCookie(res, sessionId);
}

export async function getPublicConfig(req: RequestWithPublicCustomer, res: Response): Promise<void> {
  const config = await readPublicConfig(String(req.params.slug ?? ''));
  res.json(config);
}

export async function postIdentifyStart(req: RequestWithPublicCustomer, res: Response): Promise<void> {
  const { phone } = req.body as { phone?: unknown };
  const result = await startIdentify(String(req.params.slug ?? ''), phone, readPublicSessionId(req));
  if (result.session) issueSession(res, result.session.sessionId);
  res.json({ status: result.status });
}

export async function postIdentifyVerify(req: RequestWithPublicCustomer, res: Response): Promise<void> {
  const { phone, code } = req.body as { phone?: unknown; code?: unknown };
  const result = await verifyIdentify(
    String(req.params.slug ?? ''),
    phone,
    code,
    readPublicSessionId(req)
  );
  issueSession(res, result.session.sessionId);
  res.json({ status: result.status, verified: true, sessionId: result.session.sessionId });
}

export async function postIdentifyComplete(req: RequestWithPublicCustomer, res: Response): Promise<void> {
  const session = req.publicCustomer!;
  const body = req.body as { name?: string; birthday?: Birthday };
  await completeIdentify(session, body, String(req.params.slug ?? ''));
  const fresh = await renewPublicClientSession(session.sessionId);
  const profile = await readSessionProfile(fresh ?? session);
  res.json({ ok: true, needsBirthday: profile.needsBirthday });
}

export async function getSessionMe(req: RequestWithPublicCustomer, res: Response): Promise<void> {
  const profile = await readSessionProfile(req.publicCustomer!);
  res.json(profile);
}

export async function postSessionLogout(req: RequestWithPublicCustomer, res: Response): Promise<void> {
  const sessionId = readPublicSessionId(req);
  const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
  if (sessionId) {
    const result = await revokePublicClientSession(sessionId, slug || undefined);
    if (result === 'cleared') clearPublicSessionCookie(res);
  } else {
    clearPublicSessionCookie(res);
  }
  res.json({ ok: true });
}

export async function getBirthdayField(req: AuthRequest, res: Response): Promise<void> {
  const settings = await ensureBusinessSettings(req.effectiveBusinessId!);
  res.json({ birthdayField: resolveBirthdayField(settings.birthdayField) });
}

export async function updateBirthdayField(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { birthdayField } = req.body as { birthdayField: BirthdayField };
  const result = await saveBirthdayField(businessId, birthdayField);
  if (result.changed) {
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'business.birthday_field_updated',
      entity: 'BusinessSettings',
      entityId: result.settingsId,
      metadata: { businessId, before: result.previous, after: result.current },
    });
  }
  res.json({ birthdayField: result.current });
}
