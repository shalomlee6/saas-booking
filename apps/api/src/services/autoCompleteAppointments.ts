import { Appointment } from '../models/Appointment';
import { recordAudit } from '../utils/recordAudit';

/** Confirmed appointments become completed this long after `end`. */
export const AUTO_COMPLETE_GRACE_MS = 24 * 60 * 60 * 1000;

/** How many candidates are loaded per pass. The historical backlog walks this in a loop. */
export const AUTO_COMPLETE_BATCH_SIZE = 500;

export interface AutoCompleteResult {
  completed: number;
}

/**
 * Marks `confirmed` appointments completed when `end + 24h < now`.
 * Pending appointments are never selected.
 * Each row is updated only if it is still `confirmed`, so two runners can overlap.
 * An audit row is written only when that update changes the document.
 * The caller decides when to run this (in-process interval, EventBridge, a script).
 */
export async function autoCompleteConfirmedAppointments(
  now: Date = new Date()
): Promise<AutoCompleteResult> {
  const cutoff = new Date(now.getTime() - AUTO_COMPLETE_GRACE_MS);
  let completed = 0;

  for (;;) {
    const batch = await Appointment.find({
      status: 'confirmed',
      end: { $lt: cutoff },
    })
      .select('_id businessId')
      .limit(AUTO_COMPLETE_BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;

    let changedInBatch = 0;
    for (const row of batch) {
      const result = await Appointment.updateOne(
        { _id: row._id, status: 'confirmed' },
        { $set: { status: 'completed' } }
      );
      if (result.modifiedCount !== 1) continue;
      changedInBatch += 1;
      completed += 1;
      await recordAudit({
        actorEmail: 'system',
        action: 'appointment.auto_completed',
        entity: 'Appointment',
        entityId: row._id.toString(),
        metadata: { businessId: row.businessId.toString() },
      });
    }

    if (changedInBatch === 0) break;
    if (batch.length < AUTO_COMPLETE_BATCH_SIZE) break;
  }

  return { completed };
}
