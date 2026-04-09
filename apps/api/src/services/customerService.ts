import { Customer } from '../models/Customer';

export async function listCustomersForTenant(businessId: string, search: string) {
  const filter: Record<string, unknown> = { businessId };
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];
  }
  return Customer.find(filter).sort({ createdAt: -1 }).limit(200);
}

export async function createCustomerForTenant(
  businessId: string,
  input: { name: string; phone: string; email?: string; notes?: string }
) {
  return Customer.create({
    businessId,
    name: input.name,
    phone: input.phone,
    email: input.email === '' ? undefined : input.email,
    notes: input.notes,
  });
}

export async function getCustomerForTenant(businessId: string, customerId: string) {
  return Customer.findOne({ _id: customerId, businessId });
}

export async function updateCustomerForTenant(
  businessId: string,
  customerId: string,
  body: { name?: string; phone?: string; email?: string; notes?: string }
) {
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.email !== undefined) {
    update.email = body.email === '' ? undefined : body.email;
  }
  if (body.notes !== undefined) update.notes = body.notes;

  return Customer.findOneAndUpdate(
    { _id: customerId, businessId },
    { $set: update },
    { new: true }
  );
}
