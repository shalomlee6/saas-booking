import { Types } from 'mongoose';
import { CustomerServiceConfig } from '../models/CustomerServiceConfig';
import { Customer } from '../models/Customer';
import { Service } from '../models/Service';
import { ConflictError, NotFoundError } from '../errors/httpErrors';

export interface CustomerServiceConfigInput {
  customerId: string;
  serviceId: string;
  durationOverrideMinutes?: number;
  priceOverride?: number;
  notes?: string;
}

export interface CustomerServiceConfigUpdateInput {
  durationOverrideMinutes?: number | null;
  priceOverride?: number | null;
  notes?: string;
}

async function assertCustomerAndServiceBelongToTenant(
  businessId: string,
  customerId: string,
  serviceId: string
): Promise<void> {
  const [customer, service] = await Promise.all([
    Customer.findOne({ _id: customerId, businessId }).select('_id').lean(),
    Service.findOne({ _id: serviceId, businessId }).select('_id').lean(),
  ]);
  if (!customer) throw new NotFoundError('Customer not found');
  if (!service) throw new NotFoundError('Service not found');
}

export async function listCustomerServiceConfigsForTenant(
  businessId: string,
  filter: { customerId?: string; serviceId?: string }
) {
  const query: Record<string, unknown> = { businessId };
  if (filter.customerId) query.customerId = filter.customerId;
  if (filter.serviceId) query.serviceId = filter.serviceId;
  return CustomerServiceConfig.find(query).sort({ createdAt: -1 }).limit(500);
}

export async function createCustomerServiceConfigForTenant(
  businessId: string,
  input: CustomerServiceConfigInput
) {
  await assertCustomerAndServiceBelongToTenant(businessId, input.customerId, input.serviceId);
  try {
    return await CustomerServiceConfig.create({
      businessId,
      customerId: input.customerId,
      serviceId: input.serviceId,
      durationOverrideMinutes: input.durationOverrideMinutes,
      priceOverride: input.priceOverride,
      notes: input.notes,
    });
  } catch (e: any) {
    if (e?.code === 11000) {
      throw new ConflictError(
        'A service override already exists for this customer and service',
        'DUPLICATE_CUSTOMER_SERVICE_CONFIG'
      );
    }
    throw e;
  }
}

export async function getCustomerServiceConfigForTenant(businessId: string, id: string) {
  return CustomerServiceConfig.findOne({ _id: id, businessId });
}

export async function updateCustomerServiceConfigForTenant(
  businessId: string,
  id: string,
  body: CustomerServiceConfigUpdateInput
) {
  const update: Record<string, unknown> = {};
  if (body.durationOverrideMinutes !== undefined) {
    update.durationOverrideMinutes = body.durationOverrideMinutes ?? undefined;
  }
  if (body.priceOverride !== undefined) {
    update.priceOverride = body.priceOverride ?? undefined;
  }
  if (body.notes !== undefined) {
    update.notes = body.notes;
  }

  return CustomerServiceConfig.findOneAndUpdate(
    { _id: id, businessId },
    { $set: update },
    { new: true }
  );
}

export async function deleteCustomerServiceConfigForTenant(businessId: string, id: string) {
  return CustomerServiceConfig.findOneAndDelete({ _id: id, businessId });
}

// ─── Availability-engine wiring ─────────────────────────────────────────────

export interface ServiceOverrideLookup {
  durationOverrideMinutes?: number;
  priceOverride?: number;
}

/**
 * Looks up a customer+service override, if one exists. Returns null when `customerId` is
 * absent (e.g. anonymous public availability browsing, walk-in appointments with no
 * customer on file yet) — callers should fall back to the service's own default in that case.
 */
export async function getServiceOverrideForCustomer(
  businessId: Types.ObjectId | string,
  customerId: Types.ObjectId | string | null | undefined,
  serviceId: Types.ObjectId | string
): Promise<ServiceOverrideLookup | null> {
  if (!customerId) return null;
  return CustomerServiceConfig.findOne({ businessId, customerId, serviceId })
    .select('durationOverrideMinutes priceOverride')
    .lean();
}
