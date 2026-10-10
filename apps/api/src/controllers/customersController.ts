import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { isOwnerAccess } from '../middleware/requireOwner';
import { NotFoundError } from '../errors/httpErrors';
import { Customer } from '../models/Customer';
import { recordAudit } from '../utils/recordAudit';
import {
  customersToCsv,
  listCustomersForExport,
  listCustomersPage,
  type CustomersPagedQuery,
} from '../services/customerListService';
import {
  createCustomerForTenant,
  getCustomerForTenant,
  listCustomersForTenant,
  setCustomersActiveForTenant,
  updateCustomerForTenant,
  type CustomerPreferencesInput,
} from '../services/customerService';
import { listAppointmentsForCustomer } from '../services/appointmentQueryService';
import { computeCustomerInsights, computeCustomerStats } from '../services/customerStatsService';
import {
  countCustomerNoShows,
  excuseAllNoShows,
  normalizeBookingOverride,
  readNoShowControl,
  readNoShowPolicy,
  resolveBookingBlock,
  resolveNoShowPolicy,
  saveNoShowPolicy,
  setBookingOverride,
  setNoShowExcused,
  type BookingOverride,
} from '../services/customerNoShows';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';

export async function listCustomers(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  if ((req as AuthRequest & { customerListPaged?: boolean }).customerListPaged) {
    const page = await listCustomersPage(
      businessId,
      req.query as unknown as CustomersPagedQuery,
      isOwnerAccess(req)
    );
    res.json(page);
    return;
  }
  const q = req.query as { search?: string };
  const search = q.search ?? '';
  const customers = await listCustomersForTenant(businessId, search);
  res.json(
    customers.map((c) => ({
      _id: c._id,
      fullName: c.name,
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      notes: c.notes,
      isActive: c.isActive !== false,
      preferences: c.preferences,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  );
}

export async function exportCustomers(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const rows = await listCustomersForExport(businessId, req.query as unknown as CustomersPagedQuery);
  const csv = customersToCsv(rows);
  await recordAudit({
    actorUserId: req.user?.userId,
    actorEmail: req.user?.email,
    action: 'customer.exported',
    entity: 'Customer',
    metadata: { businessId, rowCount: csv.rowCount },
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
  res.send(csv.body);
}

function actorOf(req: AuthRequest) {
  return { userId: req.user?.userId, email: req.user?.email };
}

export async function getNoShowControl(req: AuthRequest, res: Response): Promise<void> {
  const control = await readNoShowControl(req.effectiveBusinessId!, req.params.id);
  res.json(control);
}

export async function excuseCustomerNoShows(req: AuthRequest, res: Response): Promise<void> {
  const { reason } = req.body as { reason?: string };
  const control = await excuseAllNoShows(req.effectiveBusinessId!, req.params.id, reason, actorOf(req));
  res.json(control);
}

export async function excuseCustomerNoShow(req: AuthRequest, res: Response): Promise<void> {
  const { excused, reason } = req.body as { excused: boolean; reason?: string };
  const control = await setNoShowExcused(
    req.effectiveBusinessId!,
    req.params.id,
    req.params.appointmentId,
    excused,
    reason,
    actorOf(req)
  );
  res.json(control);
}

export async function updateBookingOverride(req: AuthRequest, res: Response): Promise<void> {
  const { override, reason } = req.body as { override: BookingOverride; reason?: string };
  const control = await setBookingOverride(
    req.effectiveBusinessId!,
    req.params.id,
    override,
    reason,
    actorOf(req)
  );
  res.json(control);
}

export async function createCustomer(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const body = req.body as {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
    birthday?: { day: number; month: number };
    preferences?: CustomerPreferencesInput;
  };
  const customer = await createCustomerForTenant(businessId, body);
  res.status(201).json(customer);
}

export async function getCustomer(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;
  const customer = await getCustomerForTenant(businessId, id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }
  const settings = await ensureBusinessSettings(businessId);
  const noShowCount = await countCustomerNoShows(businessId, customer._id.toString());
  const block = resolveBookingBlock(
    normalizeBookingOverride(customer.bookingOverride),
    resolveNoShowPolicy(settings),
    noShowCount
  );
  res.json({
    ...customer.toObject(),
    noShowCount,
    blocked: block.blocked,
    blockReason: block.reason,
    bookingOverride: normalizeBookingOverride(customer.bookingOverride),
  });
}

export async function getNoShowPolicy(req: AuthRequest, res: Response): Promise<void> {
  const policy = await readNoShowPolicy(req.effectiveBusinessId!);
  res.json(policy);
}

export async function updateNoShowPolicy(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const body = req.body as { enabled: boolean; threshold: number };
  const result = await saveNoShowPolicy(businessId, body);
  if (result.changed) {
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: 'customer.no_show_policy_updated',
      entity: 'BusinessSettings',
      entityId: result.settingsId,
      metadata: { businessId, before: result.previous, after: result.current },
    });
  }
  res.json(result.current);
}

export async function updateCustomer(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;
  const body = req.body as {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    birthday?: { day: number; month: number } | null;
    preferences?: CustomerPreferencesInput;
    isActive?: boolean;
  };
  const customer = await updateCustomerForTenant(businessId, id, body);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }
  res.json(customer);
}

/** POST /api/customers/bulk-status — sets Active/Inactive for the selected customers. */
export async function bulkSetCustomerStatus(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { ids, isActive } = req.body as { ids: string[]; isActive: boolean };
  const existing = await Customer.find({ businessId, _id: { $in: ids } }).select('_id');
  const updated = await setCustomersActiveForTenant(businessId, ids, isActive);
  for (const customer of existing) {
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: isActive ? 'customer.activated' : 'customer.deactivated',
      entity: 'Customer',
      entityId: customer._id.toString(),
      metadata: { businessId },
    });
  }
  res.json({ updated });
}

/** GET /api/customers/:id/appointments — full past+upcoming history for the Client Card. */
export async function getCustomerAppointmentHistory(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;

  const customer = await getCustomerForTenant(businessId, id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  const history = await listAppointmentsForCustomer(businessId, id);
  res.json(history);
}

/**
 * GET /api/customers/:id/stats — auto-derived stats + rule-based insights for the Client Card.
 * Everything here is computed live from the Appointment collection, never stored on Customer.
 */
export async function getCustomerCardStats(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;

  const customer = await getCustomerForTenant(businessId, id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  const stats = await computeCustomerStats({
    businessId: new Types.ObjectId(businessId),
    customerId: new Types.ObjectId(id),
  });
  const insights = computeCustomerInsights(stats);

  res.json({ stats, insights });
}
