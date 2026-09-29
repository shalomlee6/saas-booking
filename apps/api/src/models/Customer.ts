import { Schema, model,Types, Document } from 'mongoose';
import { TIME_OF_DAY_BUCKETS, type TimeOfDayBucket } from '../dto/enums';

export interface ICustomerPreferences {
  /** Manually set by the owner — "this customer likes being helped by X". Not derived. */
  preferredStaffId?: Types.ObjectId;
  /** Manually set by the owner. See customerStatsService for the derived (booking-history) version. */
  preferredTimeOfDay?: TimeOfDayBucket;
  allergies?: string;
  tags?: string[];
}

export interface ICustomer extends Document {
  businessId: Types.ObjectId;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  notes?: string;
  preferences?: ICustomerPreferences;
  defaultTreatmentDurationMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerPreferencesSchema = new Schema<ICustomerPreferences>(
  {
    preferredStaffId: { type: Schema.Types.ObjectId, ref: 'User' },
    preferredTimeOfDay: { type: String, enum: TIME_OF_DAY_BUCKETS },
    allergies: String,
    tags: { type: [String], default: undefined },
  },
  { _id: false }
);

const CustomerSchema = new Schema<ICustomer>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    firstName: String,
    lastName: String,
    phone: { type: String, required: true },
    email: String,
    notes: String,
    preferences: CustomerPreferencesSchema,
    defaultTreatmentDurationMinutes: Number,
  },
  { timestamps: true }
);

export const Customer = model<ICustomer>('Customer', CustomerSchema);
