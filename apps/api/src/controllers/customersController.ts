import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  createCustomerForTenant,
  getCustomerForTenant,
  listCustomersForTenant,
  updateCustomerForTenant,
} from '../services/customerService';

export async function listCustomers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businessId = req.effectiveBusinessId!;
    const q = req.query as { search?: string };
    const search = q.search ?? '';
    const customers = await listCustomersForTenant(businessId, search);
    res.json(customers);
  } catch (err) {
    console.error('Error GET /customers:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createCustomer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businessId = req.effectiveBusinessId!;
    const body = req.body as {
      name: string;
      phone: string;
      email?: string;
      notes?: string;
    };
    const customer = await createCustomerForTenant(businessId, body);
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error POST /customers:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getCustomer(req: AuthRequest, res: Response): Promise<void> {
  try {
    const businessId = req.effectiveBusinessId!;
    const { id } = req.params;
    const customer = await getCustomerForTenant(businessId, id);
    if (!customer) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }
    res.json(customer);
  } catch (err) {
    console.error('Error GET /customers/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateCustomer(req: AuthRequest, res: Response): Promise<void> {
  try {
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
      res.status(404).json({ message: 'Customer not found' });
      return;
    }
    res.json(customer);
  } catch (err) {
    console.error('Error PUT /customers/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
