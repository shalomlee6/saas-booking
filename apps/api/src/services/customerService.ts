import { Customer, type ICustomerPreferences } from '../models/Customer';
import { Appointment } from '../models/Appointment';
import { CustomerServiceConfig } from '../models/CustomerServiceConfig';
import { ConflictError, ValidationError } from '../errors/httpErrors';
import { canonicalLocalPhone } from '../listQuery/search';

function canonicalCustomerPhone(raw: string): string {
  const phone = canonicalLocalPhone(raw);
  if (!phone) {
    throw new ValidationError('Enter an Israeli mobile (05 and 8 digits)');
  }
  return phone;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CustomerPreferencesInput {
  preferredStaffId?: string;
  preferredTimeOfDay?: ICustomerPreferences['preferredTimeOfDay'];
  allergies?: string;
  tags?: string[];
}

/** Builds `$set` entries for the fields actually provided, so a partial update never wipes
 *  sibling preference fields the caller didn't mention (Mongoose would otherwise replace the
 *  whole embedded `preferences` subdocument on a plain `{ preferences: {...} }` $set). */
function buildPreferencesSet(preferences: CustomerPreferencesInput): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  if (preferences.preferredStaffId !== undefined) {
    set['preferences.preferredStaffId'] = preferences.preferredStaffId || undefined;
  }
  if (preferences.preferredTimeOfDay !== undefined) {
    set['preferences.preferredTimeOfDay'] = preferences.preferredTimeOfDay;
  }
  if (preferences.allergies !== undefined) {
    set['preferences.allergies'] = preferences.allergies.trim();
  }
  if (preferences.tags !== undefined) {
    set['preferences.tags'] = preferences.tags;
  }
  return set;
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
  input: {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
    preferences?: CustomerPreferencesInput;
    isActive?: boolean;
  }
) {
  const name = input.name.trim();
  const phone = canonicalCustomerPhone(input.phone);
  const email = typeof input.email === 'string' ? input.email.trim() : input.email;
  const notes = typeof input.notes === 'string' ? input.notes.trim() : input.notes;
  return Customer.create({
    businessId,
    name,
    phone,
    email: email === '' ? undefined : email,
    notes,
    preferences: input.preferences,
    ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
  });
}

export async function getCustomerForTenant(businessId: string, customerId: string) {
  return Customer.findOne({ _id: customerId, businessId });
}

export async function updateCustomerForTenant(
  businessId: string,
  customerId: string,
  body: {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    preferences?: CustomerPreferencesInput;
    isActive?: boolean;
  }
) {
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.phone !== undefined) update.phone = canonicalCustomerPhone(body.phone);
  if (body.email !== undefined) {
    const email = body.email.trim();
    update.email = email === '' ? undefined : email;
  }
  if (body.notes !== undefined) update.notes = body.notes.trim();
  if (body.isActive !== undefined) update.isActive = body.isActive;
  if (body.preferences !== undefined) {
    Object.assign(update, buildPreferencesSet(body.preferences));
  }

  return Customer.findOneAndUpdate(
    { _id: customerId, businessId },
    { $set: update },
    { new: true }
  );
}

/**
 * Deletes a customer, refusing when they have any appointment history — that history
 * feeds revenue/analytics and must not silently disappear. Their service-config
 * overrides (duration/price overrides) are cleaned up since those are meaningless
 * without the customer they belong to.
 */
export async function deleteCustomerForTenant(businessId: string, customerId: string) {
  const appointmentCount = await Appointment.countDocuments({ businessId, customerId });
  if (appointmentCount > 0) {
    throw new ConflictError(
      'This customer has appointment history and cannot be deleted.',
      'CUSTOMER_HAS_APPOINTMENTS'
    );
  }

  const customer = await Customer.findOneAndDelete({ _id: customerId, businessId });
  if (!customer) return null;

  await CustomerServiceConfig.deleteMany({ businessId, customerId });
  return customer;
}

export async function setCustomersActiveForTenant(
  businessId: string,
  ids: string[],
  isActive: boolean
) {
  const result = await Customer.updateMany(
    { businessId, _id: { $in: ids } },
    { $set: { isActive } }
  );
  return result.matchedCount;
}
