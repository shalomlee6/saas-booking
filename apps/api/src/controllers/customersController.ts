import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../errors/httpErrors';
import {
  createCustomerForTenant,
  getCustomerForTenant,
  listCustomersForTenant,
  updateCustomerForTenant,
} from '../services/customerService';

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
  };
  const customer = await updateCustomerForTenant(businessId, id, body);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }
  res.json(customer);
}
