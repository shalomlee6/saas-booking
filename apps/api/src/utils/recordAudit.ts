import { AuditLog } from '../models/AuditLog';
import { logger } from './logger';

export type AuditPayload = {
  actorUserId?: string;
  actorEmail?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function recordAudit(payload: AuditPayload): Promise<void> {
  try {
    await AuditLog.create({
      actorUserId: payload.actorUserId,
      actorEmail: payload.actorEmail,
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId,
      metadata: payload.metadata,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.error('record_audit_failed', { error: err instanceof Error ? err.message : String(err) });
  }
}
