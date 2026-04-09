import { Customer } from '../models/Customer';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listCustomersForTenant(businessId: string, search: string) {
  const normalizedSearch = search.trim();
  const filter: Record<string, unknown> = { businessId };
  if (normalizedSearch) {
    const safePattern = escapeRegex(normalizedSearch);
    filter.$or = [
      { name: new RegExp(safePattern, 'i') },
      { phone: new RegExp(safePattern, 'i') },
    ];
  }
  return Customer.find(filter).sort({ createdAt: -1 }).limit(200);
}

export async function createCustomerForTenant(
  businessId: string,
  input: { name: string; phone: string; email?: string; notes?: string }
) {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = typeof input.email === 'string' ? input.email.trim() : input.email;
  const notes = typeof input.notes === 'string' ? input.notes.trim() : input.notes;
  return Customer.create({
    businessId,
    name,
    phone,
    email: email === '' ? undefined : email,
    notes,
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
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.phone !== undefined) update.phone = body.phone.trim();
  if (body.email !== undefined) {
    const email = body.email.trim();
    update.email = email === '' ? undefined : email;
  }
  if (body.notes !== undefined) update.notes = body.notes.trim();

  return Customer.findOneAndUpdate(
    { _id: customerId, businessId },
    { $set: update },
    { new: true }
  );
}
