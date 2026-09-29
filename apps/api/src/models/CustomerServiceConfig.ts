import { Schema, model, Types, Document } from 'mongoose';

/**
 * Per-customer, per-service overrides (e.g. "this customer's gel manicure always runs
 * 90 minutes, not the catalog default of 60"). Does not touch the global Service model —
 * one row per (businessId, customerId, serviceId) triple.
 */
export interface ICustomerServiceConfig extends Document {
  businessId: Types.ObjectId;
  customerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  durationOverrideMinutes?: number;
  priceOverride?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerServiceConfigSchema = new Schema<ICustomerServiceConfig>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    durationOverrideMinutes: Number,
    priceOverride: Number,
    notes: String,
  },
  { timestamps: true }
);

// One config per customer+service within a business.
CustomerServiceConfigSchema.index(
  { businessId: 1, customerId: 1, serviceId: 1 },
  { unique: true }
);

export const CustomerServiceConfig = model<ICustomerServiceConfig>(
  'CustomerServiceConfig',
  CustomerServiceConfigSchema
);
