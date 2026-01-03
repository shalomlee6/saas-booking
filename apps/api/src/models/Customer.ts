import { Schema, model,Types, Document } from 'mongoose';

export interface ICustomer extends Document {
  businessId: Types.ObjectId;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  notes?: string;
  defaultTreatmentDurationMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

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
    defaultTreatmentDurationMinutes: Number,
  },
  { timestamps: true }
);

export const Customer = model<ICustomer>('Customer', CustomerSchema);
