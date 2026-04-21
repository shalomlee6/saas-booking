import { AuditLog } from '../models/AuditLog';

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
    console.error('recordAudit failed:', err);
  }
}
