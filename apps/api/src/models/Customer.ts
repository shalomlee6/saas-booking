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
  /** Day and month only. February 29 is allowed because the year is not stored. */
  birthday?: { day: number; month: number };
  notes?: string;
  /** Missing on older documents — treated as active. */
  isActive?: boolean;
  /**
   * `auto` follows the business no-show policy.
   * `allow` is never blocked. `block` is always blocked.
   */
  bookingOverride?: 'auto' | 'allow' | 'block';
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
    birthday: {
      type: new Schema(
        {
          day: { type: Number, min: 1, max: 31 },
          month: { type: Number, min: 1, max: 12 },
        },
        { _id: false }
      ),
    },
    notes: String,
    isActive: { type: Boolean, default: true },
    bookingOverride: { type: String, enum: ['auto', 'allow', 'block'], default: 'auto' },
    preferences: CustomerPreferencesSchema,
    defaultTreatmentDurationMinutes: Number,
  },
  { timestamps: true }
);

export const Customer = model<ICustomer>('Customer', CustomerSchema);
