import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedService } from './helpers/seed';
import { Appointment } from '../models/Appointment';
import { AuditLog } from '../models/AuditLog';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '../dto/enums';
import {
  isAllowedAppointmentStatusTransition,
} from '../services/appointmentStatusPolicy';
import {
  AUTO_COMPLETE_BATCH_SIZE,
  AUTO_COMPLETE_GRACE_MS,
  autoCompleteConfirmedAppointments,
} from '../services/autoCompleteAppointments';

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

const HOUR_MS = 60 * 60 * 1000;

describe('appointment status policy', () => {
  const allowed: Array<[AppointmentStatus, AppointmentStatus]> = [
    ['pending', 'pending'],
    ['pending', 'confirmed'],
    ['pending', 'cancelled'],
    ['confirmed', 'confirmed'],
    ['confirmed', 'completed'],
    ['confirmed', 'cancelled'],
    ['confirmed', 'no_show'],
    ['completed', 'completed'],
    ['completed', 'no_show'],
    ['no_show', 'no_show'],
    ['no_show', 'completed'],
    ['cancelled', 'cancelled'],
  ];

  const rejected: Array<[AppointmentStatus, AppointmentStatus]> = [
    ['pending', 'completed'],
    ['pending', 'no_show'],
    ['confirmed', 'pending'],
    ['completed', 'cancelled'],
    ['completed', 'pending'],
    ['completed', 'confirmed'],
    ['no_show', 'cancelled'],
    ['no_show', 'pending'],
    ['no_show', 'confirmed'],
    ['cancelled', 'confirmed'],
    ['cancelled', 'completed'],
    ['cancelled', 'pending'],
    ['cancelled', 'no_show'],
  ];

  it('allows identity and the approved next statuses', () => {
    for (const [from, to] of allowed) {
      expect(isAllowedAppointmentStatusTransition(from, to)).toBe(true);
    }
  });

  it('rejects every other cross-status move', () => {
    for (const [from, to] of rejected) {
      expect(isAllowedAppointmentStatusTransition(from, to)).toBe(false);
    }
  });

  it('covers every stored status', () => {
    expect(APPOINTMENT_STATUSES).toEqual([
      'pending',
      'confirmed',
      'completed',
      'cancelled',
      'no_show',
    ]);
  });
});

describe('autoCompleteConfirmedAppointments', () => {
  const now = new Date('2026-10-03T12:00:00.000Z');
  const cutoff = new Date(now.getTime() - AUTO_COMPLETE_GRACE_MS);

  async function createApt(
    businessId: unknown,
    serviceId: unknown,
    status: AppointmentStatus,
    end: Date
  ) {
    return Appointment.create({
      businessId,
      serviceId,
      start: new Date(end.getTime() - HOUR_MS),
      end,
      status,
      source: 'owner',
    });
  }

  it('completes only confirmed appointments strictly older than the 24h grace', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);

    const onBoundary = await createApt(business._id, service._id, 'confirmed', cutoff);
    const justOver = await createApt(
      business._id,
      service._id,
      'confirmed',
      new Date(cutoff.getTime() - 1)
    );
    const withinGrace = await createApt(
      business._id,
      service._id,
      'confirmed',
      new Date(now.getTime() - 23 * HOUR_MS)
    );
    const pending = await createApt(
      business._id,
      service._id,
      'pending',
      new Date(cutoff.getTime() - 7 * 24 * HOUR_MS)
    );

    const first = await autoCompleteConfirmedAppointments(now);
    expect(first.completed).toBe(1);

    const second = await autoCompleteConfirmedAppointments(now);
    expect(second.completed).toBe(0);

    const rows = await Appointment.find().lean();
    const byId = new Map(rows.map((row) => [row._id.toString(), row.status]));
    expect(byId.get(onBoundary._id.toString())).toBe('confirmed');
    expect(byId.get(justOver._id.toString())).toBe('completed');
    expect(byId.get(withinGrace._id.toString())).toBe('confirmed');
    expect(byId.get(pending._id.toString())).toBe('pending');

    const audits = await AuditLog.find({ action: 'appointment.auto_completed' }).lean();
    expect(audits.length).toBe(1);
    expect(audits[0].actorEmail).toBe('system');
    expect(audits[0].entityId).toBe(justOver._id.toString());
    expect(audits[0].metadata).toEqual({ businessId: business._id.toString() });
  });

  it('keeps tenants separate and writes one audit per changed row', async () => {
    const a = await seedOwner({ email: 'a@test.com' });
    const b = await seedOwner({ email: 'b@test.com' });
    const serviceA = await seedService(a.business._id);
    const serviceB = await seedService(b.business._id);
    const oldEnd = new Date(cutoff.getTime() - HOUR_MS);

    const aConfirmed = await createApt(a.business._id, serviceA._id, 'confirmed', oldEnd);
    const bConfirmed = await createApt(b.business._id, serviceB._id, 'confirmed', oldEnd);
    const bPending = await createApt(b.business._id, serviceB._id, 'pending', oldEnd);

    const result = await autoCompleteConfirmedAppointments(now);
    expect(result.completed).toBe(2);
    expect((await Appointment.findById(bPending._id))?.status).toBe('pending');

    const audits = await AuditLog.find({ action: 'appointment.auto_completed' }).lean();
    expect(audits.length).toBe(2);
    const byEntity = new Map(audits.map((row) => [row.entityId, row.metadata]));
    expect(byEntity.get(aConfirmed._id.toString())).toEqual({
      businessId: a.business._id.toString(),
    });
    expect(byEntity.get(bConfirmed._id.toString())).toEqual({
      businessId: b.business._id.toString(),
    });
  });

  it('writes a single audit when two runners overlap', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    const apt = await createApt(
      business._id,
      service._id,
      'confirmed',
      new Date(cutoff.getTime() - HOUR_MS)
    );

    const [left, right] = await Promise.all([
      autoCompleteConfirmedAppointments(now),
      autoCompleteConfirmedAppointments(now),
    ]);
    expect(left.completed + right.completed).toBe(1);
    expect((await Appointment.findById(apt._id))?.status).toBe('completed');
    const audits = await AuditLog.find({ action: 'appointment.auto_completed' }).lean();
    expect(audits.length).toBe(1);
  });

  it('walks more than one batch', async () => {
    const { business } = await seedOwner();
    const service = await seedService(business._id);
    const oldEnd = new Date(cutoff.getTime() - HOUR_MS);
    const count = AUTO_COMPLETE_BATCH_SIZE + 1;
    await Appointment.insertMany(
      Array.from({ length: count }, () => ({
        businessId: business._id,
        serviceId: service._id,
        start: new Date(oldEnd.getTime() - HOUR_MS),
        end: oldEnd,
        status: 'confirmed' as const,
        source: 'owner' as const,
      }))
    );

    const result = await autoCompleteConfirmedAppointments(now);
    expect(result.completed).toBe(count);
    expect(await Appointment.countDocuments({ status: 'confirmed' })).toBe(0);
    expect(await Appointment.countDocuments({ status: 'completed' })).toBe(count);
    expect(await AuditLog.countDocuments({ action: 'appointment.auto_completed' })).toBe(count);
  });
});
