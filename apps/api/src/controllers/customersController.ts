import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../errors/httpErrors';
import {
  createCustomerForTenant,
  deleteCustomerForTenant,
  getCustomerForTenant,
  listCustomersForTenant,
  updateCustomerForTenant,
  type CustomerPreferencesInput,
} from '../services/customerService';
import { ConflictError } from '../errors/httpErrors';
import { listAppointmentsForCustomer } from '../services/appointmentQueryService';
import { computeCustomerInsights, computeCustomerStats } from '../services/customerStatsService';

export async function listCustomers(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
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
      preferences: c.preferences,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  );
}

export async function createCustomer(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const body = req.body as {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
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
  res.json(customer);
}

export async function updateCustomer(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;
  const body = req.body as {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    preferences?: CustomerPreferencesInput;
  };
  const customer = await updateCustomerForTenant(businessId, id, body);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }
  res.json(customer);
}

/** DELETE /api/customers/:id — refuses (409) when the customer has appointment history. */
export async function deleteCustomer(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;
  const customer = await deleteCustomerForTenant(businessId, id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }
  res.json({ ok: true });
}

/**
 * POST /api/customers/bulk-delete — best-effort delete over a set of ids.
 * Customers with appointment history are skipped (not an all-or-nothing failure)
 * so a mixed selection still deletes what it safely can.
 */
export async function bulkDeleteCustomers(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { ids } = req.body as { ids: string[] };

  const deleted: string[] = [];
  const blocked: { id: string; name: string }[] = [];

  for (const id of ids) {
    try {
      const customer = await deleteCustomerForTenant(businessId, id);
      if (customer) deleted.push(id);
    } catch (err) {
      if (err instanceof ConflictError) {
        const customer = await getCustomerForTenant(businessId, id);
        blocked.push({ id, name: customer?.name ?? id });
      } else {
        throw err;
      }
    }
  }

  res.json({ deleted, blocked });
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
