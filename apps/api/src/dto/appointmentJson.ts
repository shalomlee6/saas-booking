import type { Document } from 'mongoose';
import { toIsoUtcString } from './datetime';

/**
 * Mongoose document → plain JSON with `start` / `end` as ISO 8601 UTC strings (`...Z`).
 */
export function appointmentDocumentToResponseDto(
  doc: Document & { start: Date; end: Date }
): Record<string, unknown> {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    ...json,
    start: toIsoUtcString(doc.start),
    end: toIsoUtcString(doc.end),
  };
}
