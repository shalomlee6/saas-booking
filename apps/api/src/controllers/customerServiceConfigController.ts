import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../errors/httpErrors';
import {
  createCustomerServiceConfigForTenant,
  deleteCustomerServiceConfigForTenant,
  getCustomerServiceConfigForTenant,
  listCustomerServiceConfigsForTenant,
  updateCustomerServiceConfigForTenant,
  type CustomerServiceConfigInput,
  type CustomerServiceConfigUpdateInput,
} from '../services/customerServiceConfigService';

export async function listCustomerServiceConfigs(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const q = req.query as { customerId?: string; serviceId?: string };
  const configs = await listCustomerServiceConfigsForTenant(businessId, {
    customerId: q.customerId,
    serviceId: q.serviceId,
  });
  res.json(configs);
}

export async function createCustomerServiceConfig(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const body = req.body as CustomerServiceConfigInput;
  const config = await createCustomerServiceConfigForTenant(businessId, body);
  res.status(201).json(config);
}

export async function getCustomerServiceConfig(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;
  const config = await getCustomerServiceConfigForTenant(businessId, id);
  if (!config) {
    throw new NotFoundError('Service override not found');
  }
  res.json(config);
}

export async function updateCustomerServiceConfig(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;
  const body = req.body as CustomerServiceConfigUpdateInput;
  const config = await updateCustomerServiceConfigForTenant(businessId, id, body);
  if (!config) {
    throw new NotFoundError('Service override not found');
  }
  res.json(config);
}

export async function deleteCustomerServiceConfig(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { id } = req.params;
  const config = await deleteCustomerServiceConfigForTenant(businessId, id);
  if (!config) {
    throw new NotFoundError('Service override not found');
  }
  res.json({ ok: true });
}
